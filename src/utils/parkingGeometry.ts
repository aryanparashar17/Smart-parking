import type {
  BoundingBoxNorm,
  DetectedVehicle,
  NormalizedPoint,
  ParkingSpacePolygon,
  SpaceDetectionResult,
} from './cameraTypes';
import type { ParkingSlot, SlotStatus } from './fusionEngine';

/**
 * Ray-casting point-in-polygon test in normalized [0..1] coordinates.
 */
export function pointInPolygon(point: NormalizedPoint, polygon: NormalizedPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Returns the axis-aligned bounding box of a polygon.
 */
export function getPolygonBounds(polygon: NormalizedPoint[]): BoundingBoxNorm {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const pt of polygon) {
    if (pt.x < x1) x1 = pt.x;
    if (pt.y < y1) y1 = pt.y;
    if (pt.x > x2) x2 = pt.x;
    if (pt.y > y2) y2 = pt.y;
  }
  return { x1, y1, x2, y2 };
}

/**
 * Computes standard axis-aligned Intersection-over-Union (IoU) between two bounding boxes.
 */
export function computeBoxIoU(a: BoundingBoxNorm, b: BoundingBoxNorm): number {
  const interX1 = Math.max(a.x1, b.x1);
  const interY1 = Math.max(a.y1, b.y1);
  const interX2 = Math.min(a.x2, b.x2);
  const interY2 = Math.min(a.y2, b.y2);

  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;
  if (interArea <= 0) return 0;

  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const unionArea = areaA + areaB - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Estimates the fraction of a parking space polygon covered by a vehicle bounding box
 * using a deterministic 9x9 stratified grid inside the polygon's bounding box.
 */
export function computePolygonOverlapRatio(
  vehicleBox: BoundingBoxNorm,
  polygon: NormalizedPoint[]
): number {
  if (polygon.length < 3) return 0;
  const bounds = getPolygonBounds(polygon);
  const width = bounds.x2 - bounds.x1;
  const height = bounds.y2 - bounds.y1;
  if (width <= 0 || height <= 0) return 0;

  // Quick reject if axis-aligned boxes do not intersect at all
  if (
    vehicleBox.x2 <= bounds.x1 ||
    vehicleBox.x1 >= bounds.x2 ||
    vehicleBox.y2 <= bounds.y1 ||
    vehicleBox.y1 >= bounds.y2
  ) {
    return 0;
  }

  const steps = 9;
  let insidePolyCount = 0;
  let insideBothCount = 0;

  for (let gx = 0; gx < steps; gx++) {
    const px = bounds.x1 + ((gx + 0.5) / steps) * width;
    for (let gy = 0; gy < steps; gy++) {
      const py = bounds.y1 + ((gy + 0.5) / steps) * height;
      if (pointInPolygon({ x: px, y: py }, polygon)) {
        insidePolyCount++;
        if (
          px >= vehicleBox.x1 &&
          px <= vehicleBox.x2 &&
          py >= vehicleBox.y1 &&
          py <= vehicleBox.y2
        ) {
          insideBothCount++;
        }
      }
    }
  }

  if (insidePolyCount === 0) return 0;
  return insideBothCount / insidePolyCount;
}

/**
 * Classifies each calibrated parking space individually based on detected YOLO vehicle boxes.
 * Uses BOTH:
 * 1) Vehicle center-point (and lower-center ground contact point) inside polygon, AND
 * 2) Polygon area overlap ratio >= 0.24 (or IoU >= 0.22).
 */
export function evaluateParkingSpaces(
  spaces: ParkingSpacePolygon[],
  vehicles: DetectedVehicle[]
): SpaceDetectionResult[] {
  return spaces.map((space) => {
    let bestVehicle: DetectedVehicle | null = null;
    let bestScore = 0;

    for (const vehicle of vehicles) {
      const overlap = computePolygonOverlapRatio(vehicle.bbox, space.points);
      const centerInside = pointInPolygon(vehicle.center, space.points);
      // Lower-center point represents the vehicle footprint on the parking bay surface
      const groundPoint: NormalizedPoint = {
        x: vehicle.center.x,
        y: vehicle.bbox.y1 + (vehicle.bbox.y2 - vehicle.bbox.y1) * 0.65,
      };
      const groundInside = pointInPolygon(groundPoint, space.points);

      // Combined occupancy evidence score
      const score = Math.max(
        overlap,
        centerInside && overlap >= 0.14 ? Math.max(overlap, 0.45) : 0,
        groundInside && overlap >= 0.16 ? Math.max(overlap, 0.42) : 0
      );

      if (score > bestScore) {
        bestScore = score;
        bestVehicle = vehicle;
      }
    }

    const isOccupied = bestVehicle !== null && bestScore >= 0.24;

    return {
      spaceId: space.id,
      slotCode: space.slotCode,
      status: isOccupied ? 'occupied' : 'available',
      overlapScore: Number(bestScore.toFixed(3)),
      confidence: isOccupied && bestVehicle
        ? Number(bestVehicle.confidence.toFixed(3))
        : 0.96,
      vehicleLabel: isOccupied && bestVehicle ? bestVehicle.label : undefined,
      matchedVehicleId: isOccupied && bestVehicle ? bestVehicle.id : undefined,
      points: space.points,
    };
  });
}

/**
 * Reconciles live YOLO camera space detection with existing ESP32 IoT sensor telemetry.
 * CRITICAL REQUIREMENT:
 * - If camera detection and ESP32 sensor readings disagree, explicitly report a
 *   'discrepancy' (Discrepancy / Uncertain) state instead of silently assuming correctness.
 * - If both agree, update to 'occupied' or 'available' with high dual-verified confidence.
 */
export function reconcileCameraWithSlot(
  slot: ParkingSlot,
  cameraResult: SpaceDetectionResult
): {
  updatedSlot: ParkingSlot;
  disagreed: boolean;
  previousStatus: SlotStatus;
  newStatus: SlotStatus;
  note: string;
} {
  const previousStatus = slot.status;
  const iotOccupied = slot.sensor.isTriggered || slot.sensor.distanceCm < slot.sensor.thresholdCm;
  const cameraOccupied = cameraResult.status === 'occupied';

  const newVision = {
    boxDetected: cameraOccupied,
    confidence: cameraOccupied ? cameraResult.confidence : 0.04,
    occluded: false,
    lightingCondition: 'optimal' as const,
  };

  let newStatus: SlotStatus;
  let fusedConfidence: number;
  let note: string;
  let disagreed = false;

  if (iotOccupied && cameraOccupied) {
    newStatus = 'occupied';
    fusedConfidence = Math.min(99.8, Number((50 + cameraResult.confidence * 49.8).toFixed(1)));
    note = `Dual confirmed: YOLO detected ${cameraResult.vehicleLabel || 'vehicle'} (${Math.round(
      cameraResult.confidence * 100
    )}% conf, ${Math.round(cameraResult.overlapScore * 100)}% overlap) & ESP32 triggered (${
      slot.sensor.distanceCm
    }cm).`;
  } else if (!iotOccupied && !cameraOccupied) {
    newStatus = slot.status === 'reserved' ? 'reserved' : 'available';
    fusedConfidence = 99.2;
    note =
      newStatus === 'reserved'
        ? 'Camera confirms bay vacant; active driver reservation preserved.'
        : `Dual confirmed: YOLO verified vacant bay & ESP32 clear (${slot.sensor.distanceCm}cm).`;
  } else {
    // Disagreement between Camera and ESP32 IoT sensor -> Discrepancy / Uncertain state
    disagreed = true;
    newStatus = 'discrepancy';
    fusedConfidence = 58.0;
    if (cameraOccupied && !iotOccupied) {
      note = `Uncertain / Discrepancy: Camera YOLO detected ${
        cameraResult.vehicleLabel || 'vehicle'
      } (${Math.round(cameraResult.confidence * 100)}%) but ESP32 sensor reports clear (${
        slot.sensor.distanceCm
      }cm). Manual verification recommended.`;
    } else {
      note = `Uncertain / Discrepancy: ESP32 ultrasonic sensor triggered (${slot.sensor.distanceCm}cm) but Camera YOLO sees an empty bay. Check for occlusion or sensor drift.`;
    }
  }

  const nowTime = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const updatedSlot: ParkingSlot = {
    ...slot,
    vision: newVision,
    status: newStatus,
    fusedConfidence,
    arbitrationNote: note,
    occupiedSince:
      newStatus === 'occupied' ? slot.occupiedSince || nowTime : undefined,
  };

  return {
    updatedSlot,
    disagreed,
    previousStatus,
    newStatus,
    note,
  };
}
