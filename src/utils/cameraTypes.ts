import type { SlotStatus } from './fusionEngine';

export interface NormalizedPoint {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
}

export interface BoundingBoxNorm {
  x1: number; // 0.0 to 1.0
  y1: number; // 0.0 to 1.0
  x2: number; // 0.0 to 1.0
  y2: number; // 0.0 to 1.0
}

export type VehicleClass = 'car' | 'motorcycle' | 'bus' | 'truck';

export interface DetectedVehicle {
  id: string;
  label: VehicleClass;
  confidence: number; // 0.0 to 1.0
  bbox: BoundingBoxNorm;
  center: NormalizedPoint;
}

export interface ParkingSpacePolygon {
  id: string;
  slotCode: string; // e.g., "A-01"
  points: NormalizedPoint[]; // 4+ vertices in normalized [0..1] coords
}

export interface SpaceDetectionResult {
  spaceId: string;
  slotCode: string;
  status: 'available' | 'occupied';
  overlapScore: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  vehicleLabel?: VehicleClass;
  matchedVehicleId?: string;
  points: NormalizedPoint[];
}

export interface CameraAnalysisResult {
  cameraId: string;
  cameraName: string;
  timestamp: string;
  inferenceMs: number;
  engine: 'python-ultralytics-yolo' | 'onnx-yolov8n';
  imageWidth: number;
  imageHeight: number;
  totalSpaces: number;
  availableSpaces: number;
  occupiedSpaces: number;
  occupancyPercentage: number;
  detectedVehiclesCount: number;
  vehicles: DetectedVehicle[];
  spaces: SpaceDetectionResult[];
  discrepancySlots: string[];
}

export type CameraSourceType = 'demo' | 'url' | 'rtsp';

export interface CameraConfig {
  id: string;
  name: string;
  sourceType: CameraSourceType;
  displayUrl: string; // Credentials masked for frontend safety
  previewUrl: string; // Safe URL to load image preview
  isStreaming: boolean;
  intervalSec: number;
  lastAnalyzedAt?: string;
  lastError?: string | null;
  spaces: ParkingSpacePolygon[];
  lastResult?: CameraAnalysisResult | null;
}

export interface DetectionHistoryItem {
  id: string;
  slotCode: string;
  previousStatus: SlotStatus;
  currentStatus: SlotStatus;
  timestamp: string;
  source: 'Camera' | 'IoT' | 'Hybrid';
  confidence: number;
  cameraName?: string;
  note: string;
}

export interface OccupancyTrendPoint {
  id: string;
  timestamp: string;
  timeLabel: string;
  occupancyPct: number;
  occupied: number;
  available: number;
  total: number;
  source: string;
}

export interface ParkingAlertItem {
  id: string;
  severity: 'warning' | 'critical' | 'info';
  type: 'discrepancy' | 'capacity' | 'camera_error';
  slotCode?: string;
  cameraName?: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}
