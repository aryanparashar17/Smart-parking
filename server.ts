import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import type {
  CameraAnalysisResult,
  DetectionHistoryItem,
  ParkingAlertItem,
  ParkingSpacePolygon,
} from './src/utils/cameraTypes';
import { arbitrateSlotStatus, calculateLotStats, type ParkingSlot } from './src/utils/fusionEngine';
import { evaluateParkingSpaces, reconcileCameraWithSlot } from './src/utils/parkingGeometry';
import {
  captureCameraFrame,
  isValidImageBuffer,
  validateCameraUrl,
} from './src/server/cameraCapture';
import { detectVehiclesInImage, getActiveCvEngine } from './src/server/cvService';
import {
  loadStore,
  resetSlotsInStore,
  sanitizeCameraForClient,
  saveStore,
  type StoredCamera,
} from './src/server/storage';

const PORT = 3000;
const SLOT_CODE_PATTERN = /^[A-Z]-\d{2}$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, and PNG images are supported.'));
    }
  },
});

// Active backend periodic camera analysis timers (cameraId -> NodeJS.Timeout)
const activeStreamTimers = new Map<string, ReturnType<typeof setInterval>>();

function nowTimeStr(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function validatePolygons(raw: unknown): { valid: boolean; spaces?: ParkingSpacePolygon[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { valid: false, error: 'Parking spaces must be provided as an array.' };
  }
  if (raw.length > 60) {
    return { valid: false, error: 'Maximum of 60 calibrated spaces per camera.' };
  }

  const sanitized: ParkingSpacePolygon[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Partial<ParkingSpacePolygon>;
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Invalid space object at index ${i}.` };
    }
    const slotCode = String(item.slotCode || '').trim().toUpperCase();
    if (!SLOT_CODE_PATTERN.test(slotCode)) {
      return {
        valid: false,
        error: `Invalid slot ID "${slotCode}". Expected format like A-01, B-02, C-04.`,
      };
    }
    if (!Array.isArray(item.points) || item.points.length < 3 || item.points.length > 12) {
      return {
        valid: false,
        error: `Space ${slotCode} must contain between 3 and 12 polygon vertices.`,
      };
    }

    const points = item.points.map((pt) => ({
      x: Number(pt?.x),
      y: Number(pt?.y),
    }));
    for (const pt of points) {
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y) || pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1) {
        return {
          valid: false,
          error: `Space ${slotCode} has out-of-range coordinates (must be normalized 0..1).`,
        };
      }
    }

    sanitized.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 64) : `sp-${slotCode.toLowerCase()}-${i}`,
      slotCode,
      points,
    });
  }

  return { valid: true, spaces: sanitized };
}

/**
 * Reconciles space-level camera detections with the store's 12-bay ESP32 slots,
 * records history entries, occupancy trend points, and discrepancy/capacity alerts.
 */
function syncDetectionToDashboard(
  cameraId: string,
  cameraName: string,
  cvResult: Awaited<ReturnType<typeof detectVehiclesInImage>>,
  spacesToEvaluate: ParkingSpacePolygon[],
  syncSlots: boolean
): CameraAnalysisResult {
  const store = loadStore();
  const spaceResults = evaluateParkingSpaces(spacesToEvaluate, cvResult.vehicles);

  const totalSpaces = spaceResults.length;
  const occupiedSpaces = spaceResults.filter((s) => s.status === 'occupied').length;
  const availableSpaces = totalSpaces - occupiedSpaces;
  const occupancyPercentage = totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0;

  const discrepancySlots: string[] = [];
  const timestamp = nowTimeStr();

  if (syncSlots && spaceResults.length > 0) {
    const newHistoryItems: DetectionHistoryItem[] = [];
    const newAlerts: ParkingAlertItem[] = [];

    for (const spaceRes of spaceResults) {
      const slotIdx = store.slots.findIndex((s) => s.code === spaceRes.slotCode);
      if (slotIdx === -1) continue;

      const existingSlot = store.slots[slotIdx];
      const reconciled = reconcileCameraWithSlot(existingSlot, spaceRes);
      store.slots[slotIdx] = reconciled.updatedSlot;

      if (reconciled.disagreed) {
        discrepancySlots.push(existingSlot.code);
        newAlerts.push({
          id: `alert-${Date.now()}-${existingSlot.code}`,
          severity: 'warning',
          type: 'discrepancy',
          slotCode: existingSlot.code,
          cameraName,
          message: reconciled.note,
          timestamp,
          acknowledged: false,
        });
      }

      if (reconciled.previousStatus !== reconciled.newStatus || reconciled.disagreed) {
        newHistoryItems.push({
          id: `hist-${Date.now()}-${existingSlot.code}-${Math.random().toString(36).slice(2, 6)}`,
          slotCode: existingSlot.code,
          previousStatus: reconciled.previousStatus,
          currentStatus: reconciled.newStatus,
          timestamp,
          source: 'Camera',
          confidence: Math.round(reconciled.updatedSlot.fusedConfidence),
          cameraName,
          note: reconciled.note,
        });
      }
    }

    if (newHistoryItems.length > 0) {
      store.history = [...newHistoryItems, ...store.history].slice(0, 100);
    }

    if (occupancyPercentage >= 85 && totalSpaces > 0) {
      newAlerts.push({
        id: `alert-cap-${Date.now()}`,
        severity: 'critical',
        type: 'capacity',
        cameraName,
        message: `${cameraName} reached ${occupancyPercentage}% occupancy (${occupiedSpaces}/${totalSpaces} bays occupied).`,
        timestamp,
        acknowledged: false,
      });
    }

    if (newAlerts.length > 0) {
      store.alerts = [...newAlerts, ...store.alerts].slice(0, 50);
    }
  }

  // Record occupancy over time trend point
  store.trends.push({
    id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    timeLabel: timestamp,
    occupancyPct: occupancyPercentage,
    occupied: occupiedSpaces,
    available: availableSpaces,
    total: totalSpaces,
    source: cameraName,
  });
  store.trends = store.trends.slice(-40);

  const analysisResult: CameraAnalysisResult = {
    cameraId,
    cameraName,
    timestamp,
    inferenceMs: cvResult.inferenceMs,
    engine: cvResult.engine,
    imageWidth: cvResult.imageWidth,
    imageHeight: cvResult.imageHeight,
    totalSpaces,
    availableSpaces,
    occupiedSpaces,
    occupancyPercentage,
    detectedVehiclesCount: cvResult.vehicles.length,
    vehicles: cvResult.vehicles,
    spaces: spaceResults,
    discrepancySlots,
  };

  saveStore(store);
  return analysisResult;
}

async function analyzeRegisteredCamera(cameraId: string): Promise<CameraAnalysisResult> {
  const store = loadStore();
  const cam = store.cameras.find((c) => c.id === cameraId);
  if (!cam) {
    const err = new Error('Camera not found.');
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  try {
    const frameBuffer = await captureCameraFrame(cam.sourceType, cam.url);
    const cvResult = await detectVehiclesInImage(frameBuffer, 0.25);
    const result = syncDetectionToDashboard(cam.id, cam.name, cvResult, cam.spaces, true);

    cam.lastAnalyzedAt = result.timestamp;
    cam.lastError = null;
    cam.lastResult = result;
    saveStore(store);

    return result;
  } catch (err) {
    const errorMessage = (err as Error).message || 'Camera analysis failed.';
    cam.lastError = errorMessage;

    const camAlert: ParkingAlertItem = {
      id: `alert-cam-${Date.now()}`,
      severity: 'critical',
      type: 'camera_error',
      cameraName: cam.name,
      message: `${cam.name}: ${errorMessage}`,
      timestamp: nowTimeStr(),
      acknowledged: false,
    };
    store.alerts = [camAlert, ...store.alerts].slice(0, 50);

    saveStore(store);
    throw err;
  }
}

function stopCameraStream(cameraId: string): void {
  const existing = activeStreamTimers.get(cameraId);
  if (existing) {
    clearInterval(existing);
    activeStreamTimers.delete(cameraId);
  }
  const store = loadStore();
  const cam = store.cameras.find((c) => c.id === cameraId);
  if (cam) {
    cam.isStreaming = false;
    saveStore(store);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Load store on boot
  loadStore();

  // 1. Health & CV Engine Status
  app.get('/api/health', async (_req, res) => {
    const cv = await getActiveCvEngine();
    res.json({
      status: 'ok',
      cv,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Full Dashboard Sync Snapshot
  app.get('/api/dashboard', async (_req, res) => {
    const store = loadStore();
    const cv = await getActiveCvEngine();
    res.json({
      cv,
      cameras: store.cameras.map(sanitizeCameraForClient),
      slots: store.slots,
      stats: calculateLotStats(store.slots),
      history: store.history,
      trends: store.trends,
      alerts: store.alerts,
    });
  });

  // 3. Camera Management APIs
  app.get('/api/cameras', (_req, res) => {
    const store = loadStore();
    res.json({ cameras: store.cameras.map(sanitizeCameraForClient) });
  });

  app.post('/api/cameras', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const rawUrl = String(req.body?.url || '').trim();
    const intervalSec = Math.max(5, Math.min(120, Number(req.body?.intervalSec) || 15));

    if (!name || name.length > 80) {
      res.status(400).json({ error: 'Camera name is required (1–80 characters).' });
      return;
    }

    const validation = validateCameraUrl(rawUrl);
    if (!validation.valid || !validation.sourceType) {
      res.status(400).json({ error: validation.error || 'Invalid camera URL.' });
      return;
    }

    const store = loadStore();
    const newCam: StoredCamera = {
      id: `cam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      sourceType: validation.sourceType,
      url: rawUrl,
      isStreaming: false,
      intervalSec,
      lastError: null,
      // Provide an initial 4-bay starter layout that admin can recalibrate immediately
      spaces: [
        {
          id: `sp-${Date.now()}-1`,
          slotCode: 'A-01',
          points: [
            { x: 0.08, y: 0.35 },
            { x: 0.27, y: 0.35 },
            { x: 0.27, y: 0.72 },
            { x: 0.08, y: 0.72 },
          ],
        },
        {
          id: `sp-${Date.now()}-2`,
          slotCode: 'A-02',
          points: [
            { x: 0.30, y: 0.35 },
            { x: 0.49, y: 0.35 },
            { x: 0.49, y: 0.72 },
            { x: 0.30, y: 0.72 },
          ],
        },
        {
          id: `sp-${Date.now()}-3`,
          slotCode: 'A-03',
          points: [
            { x: 0.52, y: 0.35 },
            { x: 0.71, y: 0.35 },
            { x: 0.71, y: 0.72 },
            { x: 0.52, y: 0.72 },
          ],
        },
        {
          id: `sp-${Date.now()}-4`,
          slotCode: 'A-04',
          points: [
            { x: 0.74, y: 0.35 },
            { x: 0.93, y: 0.35 },
            { x: 0.93, y: 0.72 },
            { x: 0.74, y: 0.72 },
          ],
        },
      ],
      lastResult: null,
    };

    store.cameras.push(newCam);
    saveStore(store);

    res.status(201).json({
      camera: sanitizeCameraForClient(newCam),
      cameras: store.cameras.map(sanitizeCameraForClient),
    });
  });

  app.delete('/api/cameras/:id', (req, res) => {
    const id = req.params.id;
    stopCameraStream(id);

    const store = loadStore();
    const idx = store.cameras.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Camera not found.' });
      return;
    }

    store.cameras.splice(idx, 1);
    saveStore(store);
    res.json({ cameras: store.cameras.map(sanitizeCameraForClient) });
  });

  // 4. Save Calibrated Parking Space Coordinates Persistently
  app.put('/api/cameras/:id/spaces', (req, res) => {
    const id = req.params.id;
    const store = loadStore();
    const cam = store.cameras.find((c) => c.id === id);
    if (!cam) {
      res.status(404).json({ error: 'Camera not found.' });
      return;
    }

    const validation = validatePolygons(req.body?.spaces);
    if (!validation.valid || !validation.spaces) {
      res.status(400).json({ error: validation.error });
      return;
    }

    cam.spaces = validation.spaces;
    saveStore(store);

    res.json({
      camera: sanitizeCameraForClient(cam),
      cameras: store.cameras.map(sanitizeCameraForClient),
    });
  });

  // 5. Camera Frame Proxy (never exposes credentials to frontend; bridges RTSP via FFmpeg)
  app.get('/api/cameras/:id/frame', async (req, res) => {
    const store = loadStore();
    const cam = store.cameras.find((c) => c.id === req.params.id);
    if (!cam) {
      res.status(404).json({ error: 'Camera not found.' });
      return;
    }

    try {
      const buf = await captureCameraFrame(cam.sourceType, cam.url);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.send(buf);
    } catch (err) {
      res.status(502).json({
        error: (err as Error).message || 'Unable to fetch camera frame.',
      });
    }
  });

  // 6. Start / Stop Periodic Backend Camera Processing
  app.post('/api/cameras/:id/stream/start', async (req, res) => {
    const id = req.params.id;
    const store = loadStore();
    const cam = store.cameras.find((c) => c.id === id);
    if (!cam) {
      res.status(404).json({ error: 'Camera not found.' });
      return;
    }

    const intervalSec = Math.max(5, Math.min(120, Number(req.body?.intervalSec) || cam.intervalSec || 15));
    stopCameraStream(id);

    cam.intervalSec = intervalSec;
    cam.isStreaming = true;
    saveStore(store);

    const timer = setInterval(() => {
      analyzeRegisteredCamera(id).catch((err) => {
        console.warn(`Periodic stream error for ${cam.name}:`, (err as Error).message);
      });
    }, intervalSec * 1000);
    activeStreamTimers.set(id, timer);

    // Run one immediate analysis pass
    try {
      const result = await analyzeRegisteredCamera(id);
      const updatedStore = loadStore();
      res.json({
        camera: sanitizeCameraForClient(cam),
        result,
        slots: updatedStore.slots,
        history: updatedStore.history,
        trends: updatedStore.trends,
        alerts: updatedStore.alerts,
      });
    } catch (err) {
      stopCameraStream(id);
      const status = (err as Error & { code?: string }).code === 'MODEL_UNAVAILABLE' ? 503 : 502;
      res.status(status).json({
        error: (err as Error).message || 'Failed to start camera stream.',
        cameras: loadStore().cameras.map(sanitizeCameraForClient),
        alerts: loadStore().alerts,
      });
    }
  });

  app.post('/api/cameras/:id/stream/stop', (req, res) => {
    const id = req.params.id;
    stopCameraStream(id);
    const store = loadStore();
    res.json({
      cameras: store.cameras.map(sanitizeCameraForClient),
    });
  });

  // 7. Run On-Demand Detection on a Registered Camera
  app.post('/api/detect/camera/:id', async (req, res) => {
    try {
      const result = await analyzeRegisteredCamera(req.params.id);
      const store = loadStore();
      res.json({
        result,
        cameras: store.cameras.map(sanitizeCameraForClient),
        slots: store.slots,
        stats: calculateLotStats(store.slots),
        history: store.history,
        trends: store.trends,
        alerts: store.alerts,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      const status = e.code === 'MODEL_UNAVAILABLE' ? 503 : e.statusCode || 502;
      const store = loadStore();
      res.status(status).json({
        error: e.message || 'Camera detection failed.',
        cameras: store.cameras.map(sanitizeCameraForClient),
        alerts: store.alerts,
      });
    }
  });

  // 8. Upload Image / Live Webcam Frame Detection API
  app.post('/api/detect/image', (req, res) => {
    upload.single('image')(req, res, async (uploadErr) => {
      if (uploadErr) {
        res.status(400).json({ error: uploadErr.message || 'Image upload failed.' });
        return;
      }
      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'Please upload a JPG or PNG image file.' });
        return;
      }
      if (!isValidImageBuffer(req.file.buffer)) {
        res.status(400).json({ error: 'Uploaded file is not a valid JPG, PNG, or WebP image.' });
        return;
      }

      const cameraName = String(req.body?.cameraName || 'Uploaded Parking Lot Image').trim().slice(0, 80);
      const cameraId = String(req.body?.cameraId || 'upload-session').trim().slice(0, 64);
      const syncDashboard = req.body?.syncDashboard !== 'false';

      let spaces: ParkingSpacePolygon[] = [];
      if (req.body?.spaces) {
        try {
          const parsed = JSON.parse(String(req.body.spaces));
          const check = validatePolygons(parsed);
          if (!check.valid || !check.spaces) {
            res.status(400).json({ error: check.error });
            return;
          }
          spaces = check.spaces;
        } catch {
          res.status(400).json({ error: 'Invalid spaces JSON payload.' });
          return;
        }
      }

      try {
        const cvResult = await detectVehiclesInImage(req.file.buffer, 0.25);
        const result = syncDetectionToDashboard(cameraId, cameraName, cvResult, spaces, syncDashboard);
        const store = loadStore();

        res.json({
          result,
          slots: store.slots,
          stats: calculateLotStats(store.slots),
          history: store.history,
          trends: store.trends,
          alerts: store.alerts,
        });
      } catch (err) {
        const e = err as Error & { code?: string };
        const status = e.code === 'MODEL_UNAVAILABLE' ? 503 : 500;
        res.status(status).json({
          error: e.message || 'YOLO vehicle detection failed.',
        });
      }
    });
  });

  // 9. Synchronized Slots, History, Trends & Alerts APIs
  app.get('/api/slots', (_req, res) => {
    const store = loadStore();
    res.json({ slots: store.slots, stats: calculateLotStats(store.slots) });
  });

  app.patch('/api/slots/:id', (req, res) => {
    const store = loadStore();
    const idx = store.slots.findIndex((s) => s.id === req.params.id || s.code === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Parking slot not found.' });
      return;
    }

    const currentSlot = store.slots[idx];
    const action = String(req.body?.action || '');
    const timestamp = nowTimeStr();
    let updatedSlot: ParkingSlot = currentSlot;
    let trigger = 'IoT Update';
    let source: 'IoT' | 'Hybrid' = 'IoT';

    if (action === 'toggle_occupancy') {
      const willBeOccupied = currentSlot.status === 'available' || currentSlot.status === 'reserved';
      const newSensor = {
        ...currentSlot.sensor,
        distanceCm: willBeOccupied ? 46 : 188,
        isTriggered: willBeOccupied,
        lastPingMs: 110,
      };
      const newVision = {
        ...currentSlot.vision,
        boxDetected: willBeOccupied,
        confidence: willBeOccupied ? 0.93 : 0.04,
        occluded: false,
      };
      const arbitrated = arbitrateSlotStatus(newSensor, newVision, currentSlot.status);
      updatedSlot = {
        ...currentSlot,
        sensor: newSensor,
        vision: newVision,
        status: arbitrated.status,
        fusedConfidence: arbitrated.confidence,
        arbitrationNote: arbitrated.note,
        occupiedSince: willBeOccupied ? 'Just now' : undefined,
        vehiclePlate: willBeOccupied ? currentSlot.vehiclePlate || 'MH-04-AB-5511' : undefined,
      };
      trigger = willBeOccupied ? 'Vehicle Arrival' : 'Vehicle Departure';
      source = 'Hybrid';
    } else if (action === 'toggle_sensor_only') {
      // Simulate ESP32 sensor flip WITHOUT changing camera vision -> creates real Discrepancy / Uncertain state
      const nextTriggered = !currentSlot.sensor.isTriggered;
      const newSensor = {
        ...currentSlot.sensor,
        distanceCm: nextTriggered ? 48 : 185,
        isTriggered: nextTriggered,
        lastPingMs: 118,
      };
      const visionOccupied = currentSlot.vision.boxDetected && !currentSlot.vision.occluded;
      const disagreed = nextTriggered !== visionOccupied;
      const nextStatus = disagreed ? 'discrepancy' : nextTriggered ? 'occupied' : 'available';
      const note = disagreed
        ? `Uncertain / Discrepancy: ESP32 ultrasonic sensor is ${
            nextTriggered ? 'triggered (48cm)' : 'clear (185cm)'
          } while Camera YOLO reports ${visionOccupied ? 'occupied' : 'vacant'}.`
        : nextTriggered
        ? 'Dual verified: ESP32 sensor and Camera YOLO both confirm vehicle presence.'
        : 'Dual verified: ESP32 sensor and Camera YOLO both confirm vacant bay.';

      updatedSlot = {
        ...currentSlot,
        sensor: newSensor,
        status: nextStatus,
        fusedConfidence: disagreed ? 58 : 99.1,
        arbitrationNote: note,
        occupiedSince: nextStatus === 'occupied' ? currentSlot.occupiedSince || 'Just now' : undefined,
      };
      trigger = 'ESP32 Sensor Telemetry';
      source = 'IoT';

      if (disagreed) {
        const mismatchAlert: ParkingAlertItem = {
          id: `alert-iot-${Date.now()}`,
          severity: 'warning',
          type: 'discrepancy',
          slotCode: currentSlot.code,
          message: note,
          timestamp,
          acknowledged: false,
        };
        store.alerts = [mismatchAlert, ...store.alerts].slice(0, 50);
      }
    } else if (action === 'toggle_occlusion') {
      const nextOccluded = !currentSlot.vision.occluded;
      const newVision = {
        ...currentSlot.vision,
        occluded: nextOccluded,
        confidence: nextOccluded ? 0.18 : 0.92,
        boxDetected: nextOccluded ? false : currentSlot.sensor.isTriggered,
        lightingCondition: (nextOccluded ? 'glare' : 'optimal') as 'glare' | 'optimal',
      };
      const arbitrated = arbitrateSlotStatus(currentSlot.sensor, newVision, currentSlot.status);
      updatedSlot = {
        ...currentSlot,
        vision: newVision,
        status: arbitrated.status,
        fusedConfidence: arbitrated.confidence,
        arbitrationNote: arbitrated.note,
      };
      trigger = nextOccluded ? 'Camera Blindspot / Glare' : 'Camera Sightline Restored';
      source = 'IoT';
    } else if (action === 'toggle_reservation') {
      if (currentSlot.status !== 'occupied') {
        const nextStatus = currentSlot.status === 'reserved' ? 'available' : 'reserved';
        updatedSlot = {
          ...currentSlot,
          status: nextStatus,
          arbitrationNote:
            nextStatus === 'reserved'
              ? 'Driver reserved via mobile app: Slot held for 15 minutes.'
              : 'Reservation cleared: Slot released to general pool.',
        };
        trigger = nextStatus === 'reserved' ? 'Pre-Entry Reservation' : 'Reservation Released';
        source = 'IoT';
      }
    } else {
      res.status(400).json({ error: 'Unsupported slot action.' });
      return;
    }

    store.slots[idx] = updatedSlot;
    store.history = [
      {
        id: `hist-${Date.now()}-${currentSlot.code}`,
        slotCode: currentSlot.code,
        previousStatus: currentSlot.status,
        currentStatus: updatedSlot.status,
        timestamp,
        source,
        confidence: Math.round(updatedSlot.fusedConfidence),
        note: `${trigger}: ${updatedSlot.arbitrationNote}`,
      },
      ...store.history,
    ].slice(0, 100);

    const stats = calculateLotStats(store.slots);
    store.trends.push({
      id: `tr-${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeLabel: timestamp,
      occupancyPct: stats.occupancyRatePct,
      occupied: stats.occupied,
      available: stats.available,
      total: stats.total,
      source: `Slot ${currentSlot.code} (${source})`,
    });
    store.trends = store.trends.slice(-40);
    saveStore(store);

    res.json({
      slot: updatedSlot,
      slots: store.slots,
      stats,
      history: store.history,
      trends: store.trends,
      alerts: store.alerts,
    });
  });

  app.post('/api/slots/reset', (_req, res) => {
    const store = resetSlotsInStore();
    res.json({
      slots: store.slots,
      stats: calculateLotStats(store.slots),
      history: store.history,
      trends: store.trends,
      alerts: store.alerts,
    });
  });

  app.get('/api/history', (_req, res) => {
    const store = loadStore();
    res.json({ history: store.history });
  });

  app.get('/api/trends', (_req, res) => {
    const store = loadStore();
    res.json({ trends: store.trends });
  });

  app.get('/api/alerts', (_req, res) => {
    const store = loadStore();
    res.json({ alerts: store.alerts });
  });

  app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const store = loadStore();
    const alert = store.alerts.find((a) => a.id === req.params.id);
    if (alert) {
      alert.acknowledged = true;
      saveStore(store);
    }
    res.json({ alerts: store.alerts });
  });

  // Mount Vite dev middleware or serve static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hybrid Parking AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
