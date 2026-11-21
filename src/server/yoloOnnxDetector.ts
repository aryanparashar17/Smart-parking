import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import type { DetectedVehicle, VehicleClass } from '../utils/cameraTypes';
import { computeBoxIoU } from '../utils/parkingGeometry';

const MODEL_INPUT_SIZE = 640;

// Standard COCO vehicle class indices in YOLOv8 (80-class COCO head)
const VEHICLE_CLASS_MAP: Record<number, VehicleClass> = {
  2: 'car',
  3: 'motorcycle',
  5: 'bus',
  7: 'truck',
};

let cachedSession: ort.InferenceSession | null = null;
let cachedModelPath: string | null = null;

export function getOnnxModelPath(): string {
  return path.resolve(process.cwd(), 'models', 'yolov8n.onnx');
}

export function isOnnxModelAvailable(): boolean {
  const modelPath = getOnnxModelPath();
  try {
    const stat = fs.statSync(modelPath);
    return stat.isFile() && stat.size > 1_000_000;
  } catch {
    return false;
  }
}

async function getSession(): Promise<ort.InferenceSession> {
  const modelPath = getOnnxModelPath();
  if (!isOnnxModelAvailable()) {
    throw new Error(
      `YOLOv8 ONNX model not found at ${modelPath}. Download yolov8n.onnx or install python_cv/requirements.txt.`
    );
  }
  if (cachedSession && cachedModelPath === modelPath) {
    return cachedSession;
  }
  cachedSession = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
  });
  cachedModelPath = modelPath;
  return cachedSession;
}

interface RawDetection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  label: VehicleClass;
}

function applyNMS(detections: RawDetection[], iouThreshold: number): RawDetection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: RawDetection[] = [];

  for (const cand of sorted) {
    let suppressed = false;
    for (const existing of kept) {
      const iou = computeBoxIoU(
        { x1: cand.x1, y1: cand.y1, x2: cand.x2, y2: cand.y2 },
        { x1: existing.x1, y1: existing.y1, x2: existing.x2, y2: existing.y2 }
      );
      if (iou > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) {
      kept.push(cand);
    }
  }

  return kept;
}

export interface OnnxDetectionOutput {
  engine: 'onnx-yolov8n';
  imageWidth: number;
  imageHeight: number;
  inferenceMs: number;
  vehicles: DetectedVehicle[];
}

/**
 * Executes genuine YOLOv8n object detection on an image buffer using onnxruntime-node + sharp.
 * Applies standard YOLOv8 letterbox preprocessing, COCO vehicle filtering (car, motorcycle, bus, truck),
 * and Non-Maximum Suppression (NMS).
 */
export async function detectVehiclesWithOnnx(
  imageBuffer: Buffer,
  confidenceThreshold = 0.25,
  iouThreshold = 0.45
): Promise<OnnxDetectionOutput> {
  const startedAt = Date.now();
  const session = await getSession();

  const image = sharp(imageBuffer).rotate();
  const meta = await image.metadata();
  const origWidth = meta.width || 0;
  const origHeight = meta.height || 0;
  if (origWidth <= 0 || origHeight <= 0) {
    throw new Error('Invalid image dimensions. Upload a valid JPG or PNG image.');
  }

  // Standard YOLO letterbox resize into 640x640 RGB with grey (114) padding
  const scale = Math.min(MODEL_INPUT_SIZE / origWidth, MODEL_INPUT_SIZE / origHeight);
  const resizedW = Math.round(origWidth * scale);
  const resizedH = Math.round(origHeight * scale);
  const padX = Math.floor((MODEL_INPUT_SIZE - resizedW) / 2);
  const padY = Math.floor((MODEL_INPUT_SIZE - resizedH) / 2);

  const { data: rgbBytes } = await image
    .resize(resizedW, resizedH, { fit: 'fill' })
    .extend({
      top: padY,
      bottom: MODEL_INPUT_SIZE - resizedH - padY,
      left: padX,
      right: MODEL_INPUT_SIZE - resizedW - padX,
      background: { r: 114, g: 114, b: 114 },
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert HWC uint8 [0..255] to NCHW float32 [0..1]
  const pixelCount = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  const floatInput = new Float32Array(3 * pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    floatInput[i] = rgbBytes[i * 3] / 255.0;
    floatInput[pixelCount + i] = rgbBytes[i * 3 + 1] / 255.0;
    floatInput[2 * pixelCount + i] = rgbBytes[i * 3 + 2] / 255.0;
  }

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const tensor = new ort.Tensor('float32', floatInput, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  const outputs = await session.run({ [inputName]: tensor });
  const outputTensor = outputs[outputName];
  const outData = outputTensor.data as Float32Array;
  const dims = outputTensor.dims; // typically [1, 84, 8400]

  const candidates: RawDetection[] = [];

  if (dims.length === 3 && dims[1] === 84) {
    // Shape: [1, 84, N] where rows 0..3 are cx, cy, w, h and rows 4..83 are 80 COCO class probs
    const numAnchors = dims[2];
    const vehicleClassIds = [2, 3, 5, 7];

    for (let i = 0; i < numAnchors; i++) {
      let bestClassId = -1;
      let bestConf = 0;

      for (const clsId of vehicleClassIds) {
        const score = outData[(4 + clsId) * numAnchors + i];
        if (score > bestConf) {
          bestConf = score;
          bestClassId = clsId;
        }
      }

      if (bestClassId === -1 || bestConf < confidenceThreshold) continue;

      const cx = outData[0 * numAnchors + i];
      const cy = outData[1 * numAnchors + i];
      const w = outData[2 * numAnchors + i];
      const h = outData[3 * numAnchors + i];

      // Undo letterbox padding and normalize to [0..1] relative to original image
      const x1 = Math.max(0, Math.min(origWidth, (cx - w / 2 - padX) / scale)) / origWidth;
      const y1 = Math.max(0, Math.min(origHeight, (cy - h / 2 - padY) / scale)) / origHeight;
      const x2 = Math.max(0, Math.min(origWidth, (cx + w / 2 - padX) / scale)) / origWidth;
      const y2 = Math.max(0, Math.min(origHeight, (cy + h / 2 - padY) / scale)) / origHeight;

      if (x2 - x1 < 0.015 || y2 - y1 < 0.015) continue;

      candidates.push({
        x1,
        y1,
        x2,
        y2,
        confidence: bestConf,
        label: VEHICLE_CLASS_MAP[bestClassId],
      });
    }
  } else if (dims.length === 3 && dims[2] === 84) {
    // Alternative transposed shape [1, N, 84]
    const numAnchors = dims[1];
    const vehicleClassIds = [2, 3, 5, 7];

    for (let i = 0; i < numAnchors; i++) {
      const base = i * 84;
      let bestClassId = -1;
      let bestConf = 0;

      for (const clsId of vehicleClassIds) {
        const score = outData[base + 4 + clsId];
        if (score > bestConf) {
          bestConf = score;
          bestClassId = clsId;
        }
      }

      if (bestClassId === -1 || bestConf < confidenceThreshold) continue;

      const cx = outData[base];
      const cy = outData[base + 1];
      const w = outData[base + 2];
      const h = outData[base + 3];

      const x1 = Math.max(0, Math.min(origWidth, (cx - w / 2 - padX) / scale)) / origWidth;
      const y1 = Math.max(0, Math.min(origHeight, (cy - h / 2 - padY) / scale)) / origHeight;
      const x2 = Math.max(0, Math.min(origWidth, (cx + w / 2 - padX) / scale)) / origWidth;
      const y2 = Math.max(0, Math.min(origHeight, (cy + h / 2 - padY) / scale)) / origHeight;

      if (x2 - x1 < 0.015 || y2 - y1 < 0.015) continue;

      candidates.push({
        x1,
        y1,
        x2,
        y2,
        confidence: bestConf,
        label: VEHICLE_CLASS_MAP[bestClassId],
      });
    }
  } else {
    throw new Error(`Unexpected YOLOv8 ONNX output tensor shape: [${dims.join(', ')}]`);
  }

  const finalBoxes = applyNMS(candidates, iouThreshold);

  const vehicles: DetectedVehicle[] = finalBoxes.map((box, index) => ({
    id: `veh-${index + 1}`,
    label: box.label,
    confidence: Number(box.confidence.toFixed(4)),
    bbox: {
      x1: Number(box.x1.toFixed(4)),
      y1: Number(box.y1.toFixed(4)),
      x2: Number(box.x2.toFixed(4)),
      y2: Number(box.y2.toFixed(4)),
    },
    center: {
      x: Number(((box.x1 + box.x2) / 2).toFixed(4)),
      y: Number(((box.y1 + box.y2) / 2).toFixed(4)),
    },
  }));

  return {
    engine: 'onnx-yolov8n',
    imageWidth: origWidth,
    imageHeight: origHeight,
    inferenceMs: Date.now() - startedAt,
    vehicles,
  };
}
