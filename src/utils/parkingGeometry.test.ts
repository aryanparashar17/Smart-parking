import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pointInPolygon,
  computeBoxIoU,
  computePolygonOverlapRatio,
  evaluateParkingSpaces,
  reconcileCameraWithSlot,
} from './parkingGeometry';
import { INITIAL_SLOTS } from './fusionEngine';
import type { DetectedVehicle, ParkingSpacePolygon } from './cameraTypes';

const sampleSquare: ParkingSpacePolygon = {
  id: 'sp-a01',
  slotCode: 'A-01',
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.3, y: 0.1 },
    { x: 0.3, y: 0.4 },
    { x: 0.1, y: 0.4 },
  ],
};

const emptySquare: ParkingSpacePolygon = {
  id: 'sp-a02',
  slotCode: 'A-02',
  points: [
    { x: 0.5, y: 0.1 },
    { x: 0.7, y: 0.1 },
    { x: 0.7, y: 0.4 },
    { x: 0.5, y: 0.4 },
  ],
};

test('pointInPolygon detects interior and exterior points accurately', () => {
  assert.equal(pointInPolygon({ x: 0.2, y: 0.25 }, sampleSquare.points), true);
  assert.equal(pointInPolygon({ x: 0.05, y: 0.25 }, sampleSquare.points), false);
  assert.equal(pointInPolygon({ x: 0.6, y: 0.25 }, sampleSquare.points), false);
});

test('computeBoxIoU calculates exact overlap ratio', () => {
  const iouSame = computeBoxIoU(
    { x1: 0, y1: 0, x2: 1, y2: 1 },
    { x1: 0, y1: 0, x2: 1, y2: 1 }
  );
  assert.equal(iouSame, 1);

  const iouDisjoint = computeBoxIoU(
    { x1: 0, y1: 0, x2: 0.2, y2: 0.2 },
    { x1: 0.5, y1: 0.5, x2: 0.8, y2: 0.8 }
  );
  assert.equal(iouDisjoint, 0);
});

test('evaluateParkingSpaces classifies occupied and vacant spaces individually', () => {
  const vehicles: DetectedVehicle[] = [
    {
      id: 'veh-1',
      label: 'car',
      confidence: 0.91,
      bbox: { x1: 0.12, y1: 0.12, x2: 0.28, y2: 0.38 },
      center: { x: 0.2, y: 0.25 },
    },
  ];

  const results = evaluateParkingSpaces([sampleSquare, emptySquare], vehicles);
  assert.equal(results.length, 2);
  assert.equal(results[0].slotCode, 'A-01');
  assert.equal(results[0].status, 'occupied');
  assert.equal(results[0].vehicleLabel, 'car');
  assert.ok(results[0].overlapScore > 0.5);

  assert.equal(results[1].slotCode, 'A-02');
  assert.equal(results[1].status, 'available');
  assert.equal(results[1].overlapScore, 0);
});

test('computePolygonOverlapRatio rejects non-overlapping vehicles', () => {
  const ratio = computePolygonOverlapRatio(
    { x1: 0.75, y1: 0.75, x2: 0.95, y2: 0.95 },
    sampleSquare.points
  );
  assert.equal(ratio, 0);
});

test('reconcileCameraWithSlot marks discrepancy when Camera and ESP32 disagree', () => {
  // A-04 in INITIAL_SLOTS has ESP32 sensor clear (185cm, isTriggered: false)
  const slotA04 = INITIAL_SLOTS.find((s) => s.code === 'A-04')!;
  const cameraDetectsCar = {
    spaceId: 'sp-a04',
    slotCode: 'A-04',
    status: 'occupied' as const,
    overlapScore: 0.72,
    confidence: 0.89,
    vehicleLabel: 'car' as const,
    matchedVehicleId: 'veh-9',
    points: emptySquare.points,
  };

  const reconciled = reconcileCameraWithSlot(slotA04, cameraDetectsCar);
  assert.equal(reconciled.disagreed, true);
  assert.equal(reconciled.newStatus, 'discrepancy');
  assert.match(reconciled.note, /Discrepancy/i);
});

test('reconcileCameraWithSlot confirms dual-verified occupied when Camera and ESP32 agree', () => {
  // A-01 in INITIAL_SLOTS has ESP32 triggered (45cm)
  const slotA01 = INITIAL_SLOTS.find((s) => s.code === 'A-01')!;
  const cameraDetectsCar = {
    spaceId: 'sp-a01',
    slotCode: 'A-01',
    status: 'occupied' as const,
    overlapScore: 0.81,
    confidence: 0.92,
    vehicleLabel: 'car' as const,
    matchedVehicleId: 'veh-1',
    points: sampleSquare.points,
  };

  const reconciled = reconcileCameraWithSlot(slotA01, cameraDetectsCar);
  assert.equal(reconciled.disagreed, false);
  assert.equal(reconciled.newStatus, 'occupied');
  assert.ok(reconciled.updatedSlot.fusedConfidence > 90);
});
