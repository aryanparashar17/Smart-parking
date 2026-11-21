import fs from 'node:fs';
import path from 'node:path';
import type {
  CameraAnalysisResult,
  CameraConfig,
  CameraSourceType,
  DetectionHistoryItem,
  OccupancyTrendPoint,
  ParkingAlertItem,
  ParkingSpacePolygon,
} from '../utils/cameraTypes';
import { INITIAL_SLOTS, type ParkingSlot, calculateLotStats } from '../utils/fusionEngine';
import { maskUrlCredentials } from './cameraCapture';

export interface StoredCamera {
  id: string;
  name: string;
  sourceType: CameraSourceType;
  url: string; // Stored server-side only; credentials masked before sending to client
  isStreaming: boolean;
  intervalSec: number;
  lastAnalyzedAt?: string;
  lastError?: string | null;
  spaces: ParkingSpacePolygon[];
  lastResult?: CameraAnalysisResult | null;
}

export interface PersistentStore {
  cameras: StoredCamera[];
  slots: ParkingSlot[];
  history: DetectionHistoryItem[];
  trends: OccupancyTrendPoint[];
  alerts: ParkingAlertItem[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'parking-store.json');

/**
 * Calibrated polygons mapped directly to the 12 painted white parking stalls in public/cameras/lot-main.jpg
 * and linked to our existing 12 dashboard slot IDs (A-01 through C-04).
 */
export const DEFAULT_MAIN_LOT_SPACES: ParkingSpacePolygon[] = [
  // Top row (6 bays: left to right)
  {
    id: 'sp-main-a01',
    slotCode: 'A-01',
    points: [
      { x: 0.21, y: 0.28 },
      { x: 0.305, y: 0.28 },
      { x: 0.285, y: 0.455 },
      { x: 0.175, y: 0.455 },
    ],
  },
  {
    id: 'sp-main-a02',
    slotCode: 'A-02',
    points: [
      { x: 0.315, y: 0.28 },
      { x: 0.415, y: 0.28 },
      { x: 0.395, y: 0.455 },
      { x: 0.295, y: 0.455 },
    ],
  },
  {
    id: 'sp-main-a03',
    slotCode: 'A-03',
    points: [
      { x: 0.422, y: 0.285 },
      { x: 0.512, y: 0.285 },
      { x: 0.515, y: 0.455 },
      { x: 0.405, y: 0.455 },
    ],
  },
  {
    id: 'sp-main-a04',
    slotCode: 'A-04',
    points: [
      { x: 0.518, y: 0.285 },
      { x: 0.605, y: 0.285 },
      { x: 0.632, y: 0.455 },
      { x: 0.522, y: 0.455 },
    ],
  },
  {
    id: 'sp-main-b01',
    slotCode: 'B-01',
    points: [
      { x: 0.612, y: 0.28 },
      { x: 0.708, y: 0.28 },
      { x: 0.742, y: 0.455 },
      { x: 0.638, y: 0.455 },
    ],
  },
  {
    id: 'sp-main-b02',
    slotCode: 'B-02',
    points: [
      { x: 0.712, y: 0.285 },
      { x: 0.785, y: 0.285 },
      { x: 0.838, y: 0.455 },
      { x: 0.748, y: 0.455 },
    ],
  },
  // Bottom row (6 bays: left to right)
  {
    id: 'sp-main-b03',
    slotCode: 'B-03',
    points: [
      { x: 0.132, y: 0.52 },
      { x: 0.245, y: 0.52 },
      { x: 0.175, y: 0.82 },
      { x: 0.055, y: 0.80 },
    ],
  },
  {
    id: 'sp-main-b04',
    slotCode: 'B-04',
    points: [
      { x: 0.255, y: 0.52 },
      { x: 0.378, y: 0.52 },
      { x: 0.335, y: 0.83 },
      { x: 0.188, y: 0.825 },
    ],
  },
  {
    id: 'sp-main-c01',
    slotCode: 'C-01',
    points: [
      { x: 0.388, y: 0.535 },
      { x: 0.516, y: 0.535 },
      { x: 0.522, y: 0.84 },
      { x: 0.352, y: 0.835 },
    ],
  },
  {
    id: 'sp-main-c02',
    slotCode: 'C-02',
    points: [
      { x: 0.526, y: 0.525 },
      { x: 0.652, y: 0.525 },
      { x: 0.695, y: 0.835 },
      { x: 0.534, y: 0.84 },
    ],
  },
  {
    id: 'sp-main-c03',
    slotCode: 'C-03',
    points: [
      { x: 0.66, y: 0.51 },
      { x: 0.785, y: 0.51 },
      { x: 0.855, y: 0.825 },
      { x: 0.705, y: 0.83 },
    ],
  },
  {
    id: 'sp-main-c04',
    slotCode: 'C-04',
    points: [
      { x: 0.795, y: 0.525 },
      { x: 0.885, y: 0.525 },
      { x: 0.968, y: 0.80 },
      { x: 0.865, y: 0.82 },
    ],
  },
];

/**
 * Calibrated polygons mapped directly to the painted bays in public/cameras/lot-east.jpg
 */
export const DEFAULT_EAST_LOT_SPACES: ParkingSpacePolygon[] = [
  {
    id: 'sp-east-a01',
    slotCode: 'A-01',
    points: [
      { x: 0.175, y: 0.49 },
      { x: 0.295, y: 0.49 },
      { x: 0.215, y: 0.785 },
      { x: 0.095, y: 0.76 },
    ],
  },
  {
    id: 'sp-east-a02',
    slotCode: 'A-02',
    points: [
      { x: 0.30, y: 0.48 },
      { x: 0.415, y: 0.48 },
      { x: 0.365, y: 0.79 },
      { x: 0.225, y: 0.785 },
    ],
  },
  {
    id: 'sp-east-a03',
    slotCode: 'A-03',
    points: [
      { x: 0.422, y: 0.49 },
      { x: 0.512, y: 0.49 },
      { x: 0.522, y: 0.795 },
      { x: 0.375, y: 0.79 },
    ],
  },
  {
    id: 'sp-east-a04',
    slotCode: 'A-04',
    points: [
      { x: 0.52, y: 0.49 },
      { x: 0.628, y: 0.49 },
      { x: 0.682, y: 0.79 },
      { x: 0.532, y: 0.795 },
    ],
  },
  {
    id: 'sp-east-b01',
    slotCode: 'B-01',
    points: [
      { x: 0.635, y: 0.49 },
      { x: 0.725, y: 0.49 },
      { x: 0.822, y: 0.78 },
      { x: 0.692, y: 0.79 },
    ],
  },
  {
    id: 'sp-east-b02',
    slotCode: 'B-02',
    points: [
      { x: 0.395, y: 0.31 },
      { x: 0.455, y: 0.31 },
      { x: 0.445, y: 0.385 },
      { x: 0.375, y: 0.385 },
    ],
  },
  {
    id: 'sp-east-b03',
    slotCode: 'B-03',
    points: [
      { x: 0.46, y: 0.31 },
      { x: 0.515, y: 0.31 },
      { x: 0.515, y: 0.385 },
      { x: 0.452, y: 0.385 },
    ],
  },
  {
    id: 'sp-east-b04',
    slotCode: 'B-04',
    points: [
      { x: 0.52, y: 0.31 },
      { x: 0.578, y: 0.31 },
      { x: 0.585, y: 0.385 },
      { x: 0.522, y: 0.385 },
    ],
  },
];

function createDefaultStore(): PersistentStore {
  const initialSlots = structuredClone(INITIAL_SLOTS);
  const stats = calculateLotStats(initialSlots);
  const nowIso = new Date().toISOString();
  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    cameras: [
      {
        id: 'cam-lot-main',
        name: 'Lot A - Main Entrance',
        sourceType: 'demo',
        url: '/cameras/lot-main.jpg',
        isStreaming: false,
        intervalSec: 15,
        lastError: null,
        spaces: DEFAULT_MAIN_LOT_SPACES,
        lastResult: null,
      },
      {
        id: 'cam-lot-east',
        name: 'Lot B - East Wing',
        sourceType: 'demo',
        url: '/cameras/lot-east.jpg',
        isStreaming: false,
        intervalSec: 15,
        lastError: null,
        spaces: DEFAULT_EAST_LOT_SPACES,
        lastResult: null,
      },
    ],
    slots: initialSlots,
    history: [
      {
        id: 'hist-seed-1',
        slotCode: 'B-01',
        previousStatus: 'available',
        currentStatus: 'occupied',
        timestamp: '09:45 AM',
        source: 'IoT',
        confidence: 88,
        note: 'ESP32 ultrasonic triggered (52cm) during CCTV shadow occlusion.',
      },
      {
        id: 'hist-seed-2',
        slotCode: 'A-01',
        previousStatus: 'available',
        currentStatus: 'occupied',
        timestamp: '10:14 AM',
        source: 'Hybrid',
        confidence: 99,
        note: 'Dual verified: Ultrasonic 45cm + YOLO vehicle bbox 94%.',
      },
      {
        id: 'hist-seed-3',
        slotCode: 'B-03',
        previousStatus: 'available',
        currentStatus: 'occupied',
        timestamp: '10:30 AM',
        source: 'Hybrid',
        confidence: 99,
        note: 'Dual verified: Ultrasonic 44cm + YOLO car bbox 93%.',
      },
    ],
    trends: [
      {
        id: 'tr-seed-1',
        timestamp: nowIso,
        timeLabel,
        occupancyPct: stats.occupancyRatePct,
        occupied: stats.occupied,
        available: stats.available,
        total: stats.total,
        source: 'Initial Baseline',
      },
    ],
    alerts: [
      {
        id: 'alert-seed-1',
        severity: 'info',
        type: 'discrepancy',
        slotCode: 'B-01',
        message: 'Bay B-01 has CCTV shadow occlusion; ESP32 ultrasonic sensor is currently authoritative.',
        timestamp: '09:45 AM',
        acknowledged: false,
      },
    ],
  };
}

let inMemoryStore: PersistentStore | null = null;

export function loadStore(): PersistentStore {
  if (inMemoryStore) return inMemoryStore;

  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PersistentStore;
      if (parsed && Array.isArray(parsed.cameras) && Array.isArray(parsed.slots)) {
        // Ensure streaming flag resets to false on fresh server restart
        parsed.cameras = parsed.cameras.map((c) => ({ ...c, isStreaming: false }));
        inMemoryStore = parsed;
        return inMemoryStore;
      }
    }
  } catch (err) {
    console.warn('Could not read existing parking-store.json; initializing default store:', err);
  }

  inMemoryStore = createDefaultStore();
  saveStore(inMemoryStore);
  return inMemoryStore;
}

export function saveStore(store: PersistentStore): void {
  inMemoryStore = store;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error('Failed to persist parking-store.json:', err);
  }
}

export function resetSlotsInStore(): PersistentStore {
  const store = loadStore();
  store.slots = structuredClone(INITIAL_SLOTS);
  const stats = calculateLotStats(store.slots);
  store.trends.push({
    id: `tr-${Date.now()}`,
    timestamp: new Date().toISOString(),
    timeLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    occupancyPct: stats.occupancyRatePct,
    occupied: stats.occupied,
    available: stats.available,
    total: stats.total,
    source: 'Testbed Reset',
  });
  store.trends = store.trends.slice(-40);
  saveStore(store);
  return store;
}

/**
 * Strips raw credentials from stored cameras before returning them to any frontend client.
 */
export function sanitizeCameraForClient(cam: StoredCamera): CameraConfig {
  const previewUrl =
    cam.sourceType === 'demo'
      ? cam.url
      : `/api/cameras/${encodeURIComponent(cam.id)}/frame`;

  return {
    id: cam.id,
    name: cam.name,
    sourceType: cam.sourceType,
    displayUrl: maskUrlCredentials(cam.url),
    previewUrl,
    isStreaming: cam.isStreaming,
    intervalSec: cam.intervalSec,
    lastAnalyzedAt: cam.lastAnalyzedAt,
    lastError: cam.lastError || null,
    spaces: cam.spaces,
    lastResult: cam.lastResult || null,
  };
}
