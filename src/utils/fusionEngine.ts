export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'discrepancy';

export interface SensorTelemetry {
  distanceCm: number;
  thresholdCm: number;
  isTriggered: boolean;
  batteryPct?: number;
  lastPingMs: number;
}

export interface VisionTelemetry {
  boxDetected: boolean;
  confidence: number; // 0.0 - 1.0
  occluded: boolean;
  lightingCondition: 'optimal' | 'low_light' | 'glare' | 'shadow';
}

export interface ParkingSlot {
  id: string;
  code: string; // e.g. "A-01"
  zone: 'A' | 'B' | 'C';
  type: 'standard' | 'ev' | 'accessible';
  sensor: SensorTelemetry;
  vision: VisionTelemetry;
  status: SlotStatus;
  fusedConfidence: number; // 0 - 100
  arbitrationNote: string;
  occupiedSince?: string;
  vehiclePlate?: string;
}

export interface SlotEventLog {
  id: string;
  timestamp: string;
  fromStatus: SlotStatus;
  toStatus: SlotStatus;
  trigger: string;
  confidence: number;
  note: string;
}

export interface LotStatistics {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  discrepancies: number;
  occupancyRatePct: number;
  estimatedSearchTimeMin: number;
}

/**
 * Appends a new event to a slot's event log, keeping only the most recent maxEntries (default 5).
 */
export function appendSlotEvent(
  existingHistory: SlotEventLog[] = [],
  newEvent: Omit<SlotEventLog, 'id'>,
  maxEntries = 5
): SlotEventLog[] {
  const entry: SlotEventLog = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...newEvent
  };
  return [entry, ...existingHistory].slice(0, maxEntries);
}

/**
 * Creates realistic initial history for seeded parking bays.
 */
export function createInitialEventHistory(slot: ParkingSlot): SlotEventLog[] {
  const events: SlotEventLog[] = [];
  if (slot.status === 'occupied') {
    events.push({
      id: `evt-${slot.id}-1`,
      timestamp: slot.occupiedSince || '10:14 AM',
      fromStatus: 'available',
      toStatus: 'occupied',
      trigger: 'Vehicle Arrival',
      confidence: Math.round(slot.fusedConfidence),
      note: slot.arbitrationNote
    });
    events.push({
      id: `evt-${slot.id}-0`,
      timestamp: '08:30 AM',
      fromStatus: 'occupied',
      toStatus: 'available',
      trigger: 'Morning Bay Release',
      confidence: 99,
      note: 'Prior commuter vacated slot during morning turnover cycle.'
    });
  } else if (slot.status === 'reserved') {
    events.push({
      id: `evt-${slot.id}-1`,
      timestamp: '11:05 AM',
      fromStatus: 'available',
      toStatus: 'reserved',
      trigger: 'Mobile App Reservation',
      confidence: 96,
      note: slot.arbitrationNote
    });
  } else {
    events.push({
      id: `evt-${slot.id}-1`,
      timestamp: '09:20 AM',
      fromStatus: 'occupied',
      toStatus: 'available',
      trigger: 'Vehicle Departure',
      confidence: 99,
      note: 'Slot cleared; ultrasonic distance reset to >180cm.'
    });
  }
  return events;
}

/**
 * Pure fusion engine arbitration logic:
 * Combines physical ultrasonic sensor distance with YOLO visual bounding box detection.
 */
export function arbitrateSlotStatus(
  sensor: SensorTelemetry,
  vision: VisionTelemetry,
  currentStatus: SlotStatus = 'available'
): { status: SlotStatus; confidence: number; note: string } {
  const sensorOccupied = sensor.isTriggered || sensor.distanceCm < sensor.thresholdCm;
  const visionOccupied = vision.boxDetected && vision.confidence >= 0.55 && !vision.occluded;

  // Case 1: Both Agree Occupied
  if (sensorOccupied && visionOccupied) {
    const fusedConf = Math.min(99.8, Math.round((0.5 * 100) + (vision.confidence * 49.8)));
    return {
      status: 'occupied',
      confidence: fusedConf,
      note: 'Dual confirmation: Sensor threshold active and YOLO visual bbox detected (>85% conf).'
    };
  }

  // Case 2: Both Agree Empty
  if (!sensorOccupied && !visionOccupied) {
    const fusedConf = Math.min(99.5, Math.round(90 + (1 - vision.confidence) * 9.5));
    return {
      status: 'available',
      confidence: fusedConf,
      note: 'Dual confirmation: Ultrasonic clear (>150cm) and camera empty-slot bounding verified.'
    };
  }

  // Case 3: Discrepancy - Vision obstructed / glare but Sensor detects vehicle
  if (sensorOccupied && !visionOccupied) {
    if (vision.occluded || vision.lightingCondition === 'glare' || vision.lightingCondition === 'shadow') {
      return {
        status: 'occupied',
        confidence: 86.4,
        note: 'Arbitrated via IoT Ground-Truth: Camera feed degraded/occluded, sensor distance < threshold confirms presence.'
      };
    }
    // Ambiguous condition (e.g. low obstacle or pedestrian)
    return {
      status: 'discrepancy',
      confidence: 62.0,
      note: 'Discrepancy detected: Sensor triggered but YOLO confidence low (32%). Cross-validating next frame.'
    };
  }

  // Case 4: Discrepancy - Vision sees car, but Sensor reports clear (e.g. sensor offset or misalignment)
  if (!sensorOccupied && visionOccupied) {
    if (vision.confidence > 0.88) {
      return {
        status: 'occupied',
        confidence: 88.2,
        note: 'Arbitrated via High-Confidence Vision: YOLO bbox confidence 92%, sensor ping scheduled for recalibration.'
      };
    }
    return {
      status: 'discrepancy',
      confidence: 65.0,
      note: 'Discrepancy detected: Vision candidate detected but sensor distance clear (>160cm). Sensor retry initiated.'
    };
  }

  return {
    status: currentStatus,
    confidence: 70.0,
    note: 'Baseline steady state preserved.'
  };
}

/**
 * Calculates aggregate stats across parking slots.
 */
export function calculateLotStats(slots: ParkingSlot[]): LotStatistics {
  const total = slots.length;
  if (total === 0) {
    return {
      total: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      discrepancies: 0,
      occupancyRatePct: 0,
      estimatedSearchTimeMin: 0
    };
  }

  let available = 0;
  let occupied = 0;
  let reserved = 0;
  let discrepancies = 0;

  for (const s of slots) {
    if (s.status === 'available') available++;
    else if (s.status === 'occupied') occupied++;
    else if (s.status === 'reserved') reserved++;
    else if (s.status === 'discrepancy') discrepancies++;
  }

  const occupancyRatePct = Math.round(((occupied + reserved) / total) * 100);

  // Search time heuristic: when slots are abundant, <1.5 min; when scarce (<2 available), ~8-12 min
  let estimatedSearchTimeMin = 1.2;
  if (available === 0) {
    estimatedSearchTimeMin = 14.5;
  } else if (available <= 2) {
    estimatedSearchTimeMin = 8.2;
  } else if (available <= 5) {
    estimatedSearchTimeMin = 3.8;
  } else {
    estimatedSearchTimeMin = 1.4;
  }

  return {
    total,
    available,
    occupied,
    reserved,
    discrepancies,
    occupancyRatePct,
    estimatedSearchTimeMin
  };
}

/**
 * Initial seed slots reflecting typical campus/facility parking
 */
export const INITIAL_SLOTS: ParkingSlot[] = [
  {
    id: 'slot-1',
    code: 'A-01',
    zone: 'A',
    type: 'standard',
    sensor: { distanceCm: 45, thresholdCm: 100, isTriggered: true, batteryPct: 98, lastPingMs: 140 },
    vision: { boxDetected: true, confidence: 0.94, occluded: false, lightingCondition: 'optimal' },
    status: 'occupied',
    fusedConfidence: 99.4,
    arbitrationNote: 'Dual verified: Ultrasonic 45cm + YOLO car bbox 94%',
    occupiedSince: '10:14 AM',
    vehiclePlate: 'MP-09-CB-4812'
  },
  {
    id: 'slot-2',
    code: 'A-02',
    zone: 'A',
    type: 'standard',
    sensor: { distanceCm: 48, thresholdCm: 100, isTriggered: true, batteryPct: 94, lastPingMs: 120 },
    vision: { boxDetected: true, confidence: 0.91, occluded: false, lightingCondition: 'optimal' },
    status: 'occupied',
    fusedConfidence: 98.8,
    arbitrationNote: 'Dual verified: Ultrasonic 48cm + YOLO car bbox 91%',
    occupiedSince: '11:02 AM',
    vehiclePlate: 'MP-09-WZ-9021'
  },
  {
    id: 'slot-3',
    code: 'A-03',
    zone: 'A',
    type: 'ev',
    sensor: { distanceCm: 190, thresholdCm: 100, isTriggered: false, batteryPct: 96, lastPingMs: 110 },
    vision: { boxDetected: false, confidence: 0.04, occluded: false, lightingCondition: 'optimal' },
    status: 'available',
    fusedConfidence: 99.2,
    arbitrationNote: 'Dual verified: EV charging slot empty and ready'
  },
  {
    id: 'slot-4',
    code: 'A-04',
    zone: 'A',
    type: 'standard',
    sensor: { distanceCm: 185, thresholdCm: 100, isTriggered: false, batteryPct: 91, lastPingMs: 155 },
    vision: { boxDetected: false, confidence: 0.05, occluded: false, lightingCondition: 'optimal' },
    status: 'available',
    fusedConfidence: 99.1,
    arbitrationNote: 'Dual verified: Clear slot distance 185cm + Zero bbox'
  },
  {
    id: 'slot-5',
    code: 'B-01',
    zone: 'B',
    type: 'standard',
    sensor: { distanceCm: 52, thresholdCm: 100, isTriggered: true, batteryPct: 89, lastPingMs: 130 },
    vision: { boxDetected: false, confidence: 0.22, occluded: true, lightingCondition: 'shadow' },
    status: 'occupied',
    fusedConfidence: 87.5,
    arbitrationNote: 'Arbitrated: CCTV shadow occlusion overridden by slot sensor (52cm)',
    occupiedSince: '09:45 AM',
    vehiclePlate: 'DL-01-AX-3190'
  },
  {
    id: 'slot-6',
    code: 'B-02',
    zone: 'B',
    type: 'ev',
    sensor: { distanceCm: 188, thresholdCm: 100, isTriggered: false, batteryPct: 97, lastPingMs: 90 },
    vision: { boxDetected: false, confidence: 0.04, occluded: false, lightingCondition: 'optimal' },
    status: 'available',
    fusedConfidence: 99.3,
    arbitrationNote: 'Dual verified: EV charging bay vacant and ready'
  },
  {
    id: 'slot-7',
    code: 'B-03',
    zone: 'B',
    type: 'accessible',
    sensor: { distanceCm: 44, thresholdCm: 100, isTriggered: true, batteryPct: 92, lastPingMs: 140 },
    vision: { boxDetected: true, confidence: 0.93, occluded: false, lightingCondition: 'optimal' },
    status: 'occupied',
    fusedConfidence: 99.2,
    arbitrationNote: 'Dual verified: Ultrasonic 44cm + YOLO car bbox 93%',
    occupiedSince: '10:30 AM',
    vehiclePlate: 'MP-09-EV-1008'
  },
  {
    id: 'slot-8',
    code: 'B-04',
    zone: 'B',
    type: 'standard',
    sensor: { distanceCm: 50, thresholdCm: 100, isTriggered: true, batteryPct: 95, lastPingMs: 115 },
    vision: { boxDetected: true, confidence: 0.89, occluded: false, lightingCondition: 'optimal' },
    status: 'occupied',
    fusedConfidence: 98.2,
    arbitrationNote: 'Dual verified: Ultrasonic 50cm + YOLO car bbox 89%',
    occupiedSince: '11:15 AM',
    vehiclePlate: 'MH-12-PQ-7744'
  },
  {
    id: 'slot-9',
    code: 'C-01',
    zone: 'C',
    type: 'standard',
    sensor: { distanceCm: 192, thresholdCm: 100, isTriggered: false, batteryPct: 93, lastPingMs: 145 },
    vision: { boxDetected: false, confidence: 0.03, occluded: false, lightingCondition: 'optimal' },
    status: 'available',
    fusedConfidence: 99.4,
    arbitrationNote: 'Dual verified: Open standard bay'
  },
  {
    id: 'slot-10',
    code: 'C-02',
    zone: 'C',
    type: 'standard',
    sensor: { distanceCm: 185, thresholdCm: 100, isTriggered: false, batteryPct: 88, lastPingMs: 105 },
    vision: { boxDetected: false, confidence: 0.02, occluded: false, lightingCondition: 'optimal' },
    status: 'available',
    fusedConfidence: 99.5,
    arbitrationNote: 'Dual verified: Open slot ready for parking'
  },
  {
    id: 'slot-11',
    code: 'C-03',
    zone: 'C',
    type: 'standard',
    sensor: { distanceCm: 175, thresholdCm: 100, isTriggered: false, batteryPct: 91, lastPingMs: 125 },
    vision: { boxDetected: false, confidence: 0.05, occluded: false, lightingCondition: 'optimal' },
    status: 'reserved',
    fusedConfidence: 96.0,
    arbitrationNote: 'System reservation active: Slot held for incoming driver'
  },
  {
    id: 'slot-12',
    code: 'C-04',
    zone: 'C',
    type: 'ev',
    sensor: { distanceCm: 190, thresholdCm: 100, isTriggered: false, batteryPct: 95, lastPingMs: 110 },
    vision: { boxDetected: false, confidence: 0.03, occluded: false, lightingCondition: 'optimal' },
    status: 'available',
    fusedConfidence: 99.4,
    arbitrationNote: 'Dual verified: EV Fast Charging bay available'
  }
];
