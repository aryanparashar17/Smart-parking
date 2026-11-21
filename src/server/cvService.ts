import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DetectedVehicle } from '../utils/cameraTypes';
import { detectVehiclesWithOnnx, isOnnxModelAvailable } from './yoloOnnxDetector';

const execFileAsync = promisify(execFile);

export interface CVDetectionResponse {
  engine: 'python-ultralytics-yolo' | 'onnx-yolov8n';
  imageWidth: number;
  imageHeight: number;
  inferenceMs: number;
  vehicles: DetectedVehicle[];
}

let pythonAvailableCache: boolean | null = null;

/**
 * Checks whether Python 3 + OpenCV + Ultralytics YOLO are installed on this host.
 */
export async function isPythonYoloAvailable(): Promise<boolean> {
  if (pythonAvailableCache !== null) return pythonAvailableCache;
  try {
    await execFileAsync('python3', ['-c', 'import cv2, ultralytics'], {
      timeout: 5000,
    });
    pythonAvailableCache = true;
  } catch {
    pythonAvailableCache = false;
  }
  return pythonAvailableCache;
}

export async function getActiveCvEngine(): Promise<{
  available: boolean;
  engine: 'python-ultralytics-yolo' | 'onnx-yolov8n' | 'unavailable';
  pythonReady: boolean;
  onnxReady: boolean;
}> {
  const pythonReady = await isPythonYoloAvailable();
  const onnxReady = isOnnxModelAvailable();
  if (pythonReady) {
    return { available: true, engine: 'python-ultralytics-yolo', pythonReady, onnxReady };
  }
  if (onnxReady) {
    return { available: true, engine: 'onnx-yolov8n', pythonReady, onnxReady };
  }
  return { available: false, engine: 'unavailable', pythonReady, onnxReady };
}

async function runPythonDetector(imageBuffer: Buffer, conf: number): Promise<CVDetectionResponse> {
  const tmpFile = path.join(
    os.tmpdir(),
    `parking-frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  );
  const scriptPath = path.resolve(process.cwd(), 'python_cv', 'detector.py');
  await fs.writeFile(tmpFile, imageBuffer);

  try {
    const { stdout } = await execFileAsync(
      'python3',
      [scriptPath, '--image', tmpFile, '--conf', String(conf)],
      { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout.trim());
    if (parsed.error) {
      throw new Error(parsed.message || 'Python YOLOv8 execution failed.');
    }
    return parsed as CVDetectionResponse;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

/**
 * Runs genuine vehicle detection using Python OpenCV + Ultralytics YOLO when installed,
 * or the real YOLOv8n ONNX Runtime engine otherwise.
 * Never fabricates or randomizes results if no real YOLO model is available.
 */
export async function detectVehiclesInImage(
  imageBuffer: Buffer,
  confidenceThreshold = 0.25
): Promise<CVDetectionResponse> {
  if (await isPythonYoloAvailable()) {
    return runPythonDetector(imageBuffer, confidenceThreshold);
  }

  if (isOnnxModelAvailable()) {
    return detectVehiclesWithOnnx(imageBuffer, confidenceThreshold);
  }

  const err = new Error(
    'YOLO detection model is unavailable on the server. Install Python OpenCV + Ultralytics (pip install -r python_cv/requirements.txt) or place yolov8n.onnx inside /models.'
  );
  (err as Error & { code?: string }).code = 'MODEL_UNAVAILABLE';
  throw err;
}
