import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PUBLIC_CAMERAS_DIR = path.resolve(process.cwd(), 'public', 'cameras');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Masks any embedded username/password in HTTP/RTSP camera URLs so credentials
 * are never exposed in frontend API responses or UI labels.
 */
export function maskUrlCredentials(rawUrl: string): string {
  if (rawUrl.startsWith('/cameras/')) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/\/\/[^/@]+@/, '//***:***@');
  }
}

/**
 * Blocks loopback, link-local, metadata, and RFC1918 private addresses on outbound HTTP(S) requests.
 */
function isPrivateOrRestrictedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    lower === 'localhost' ||
    lower === 'localhost.localdomain' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '::' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = net.isIP(lower);
  if (ipVersion === 4) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 127) return true; // 127.0.0.0/8 loopback
    if (parts[0] === 10) return true; // 10.0.0.0/8 private
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 cloud metadata / link-local
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12 private
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16 private
    if (parts[0] === 0) return true;
  } else if (ipVersion === 6) {
    if (
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80') ||
      lower.startsWith('::ffff:127.') ||
      lower.startsWith('::ffff:10.') ||
      lower.startsWith('::ffff:169.254.') ||
      lower.startsWith('::ffff:192.168.')
    ) {
      return true;
    }
  }
  return false;
}

export function validateCameraUrl(rawUrl: string): {
  valid: boolean;
  sourceType?: 'url' | 'rtsp';
  error?: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: 'Please enter a valid http://, https://, or rtsp:// URL.' };
  }

  if (parsed.protocol === 'rtsp:' || parsed.protocol === 'rtsps:') {
    if (!parsed.hostname) {
      return { valid: false, error: 'RTSP URL must include a valid host.' };
    }
    return { valid: true, sourceType: 'rtsp' };
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    if (isPrivateOrRestrictedHost(parsed.hostname)) {
      return {
        valid: false,
        error:
          'Localhost, link-local, and private network HTTP URLs are blocked for security. Use a public camera snapshot URL or upload an image directly.',
      };
    }
    return { valid: true, sourceType: 'url' };
  }

  return {
    valid: false,
    error: 'Unsupported URL scheme. Only http://, https://, and rtsp:// are supported.',
  };
}

/**
 * Validates image magic bytes (JPEG or PNG).
 */
export function isValidImageBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true;
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }
  return false;
}

/**
 * Captures a single JPEG/PNG frame buffer from:
 * - Local bundled demo camera (/cameras/*.jpg, strictly confined to public/cameras/)
 * - External HTTP/HTTPS camera snapshot URL (SSRF-checked)
 * - RTSP stream via backend ffmpeg process (execFile, zero shell interpolation)
 */
export async function captureCameraFrame(sourceType: 'demo' | 'url' | 'rtsp', rawUrl: string): Promise<Buffer> {
  if (sourceType === 'demo') {
    const filename = path.basename(rawUrl);
    const resolved = path.resolve(PUBLIC_CAMERAS_DIR, filename);
    if (!resolved.startsWith(PUBLIC_CAMERAS_DIR + path.sep)) {
      throw new Error('Invalid local camera asset path.');
    }
    const buf = await fs.readFile(resolved);
    if (!isValidImageBuffer(buf)) {
      throw new Error('Demo camera image is corrupt or unsupported.');
    }
    return buf;
  }

  if (sourceType === 'url') {
    const check = validateCameraUrl(rawUrl);
    if (!check.valid) {
      throw new Error(check.error || 'Invalid camera URL.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(rawUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { Accept: 'image/jpeg,image/png,image/webp,*/*' },
      });
      if (!res.ok) {
        throw new Error(`Camera endpoint responded with HTTP ${res.status}.`);
      }
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.startsWith('image/')) {
        throw new Error(
          `Camera URL returned "${contentType}" instead of an image snapshot (JPG/PNG).`
        );
      }
      const arr = await res.arrayBuffer();
      if (arr.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('Camera snapshot exceeded the 10 MB size limit.');
      }
      const buf = Buffer.from(arr);
      if (!isValidImageBuffer(buf)) {
        throw new Error('Camera URL did not return a valid JPG/PNG image frame.');
      }
      return buf;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Timed out connecting to camera URL (8s limit). Check stream availability.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  if (sourceType === 'rtsp') {
    const check = validateCameraUrl(rawUrl);
    if (!check.valid || check.sourceType !== 'rtsp') {
      throw new Error(check.error || 'Invalid RTSP URL.');
    }

    try {
      const { stdout } = await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-rtsp_transport',
          'tcp',
          '-i',
          rawUrl,
          '-frames:v',
          '1',
          '-f',
          'image2pipe',
          '-vcodec',
          'mjpeg',
          'pipe:1',
        ],
        {
          encoding: 'buffer',
          timeout: 10000,
          maxBuffer: MAX_IMAGE_BYTES,
        }
      );

      if (!stdout || !isValidImageBuffer(stdout)) {
        throw new Error('RTSP camera connected but failed to yield a valid JPEG frame.');
      }
      return stdout;
    } catch (err) {
      const msg = (err as Error).message || 'RTSP capture failed.';
      throw new Error(
        `Unable to capture RTSP frame via backend FFmpeg bridge: ${maskUrlCredentials(msg)}`
      );
    }
  }

  throw new Error('Unsupported camera source type.');
}
