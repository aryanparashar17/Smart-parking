import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arbitrateSlotStatus,
  calculateLotStats,
  INITIAL_SLOTS,
  ParkingSlot,
  appendSlotEvent,
  createInitialEventHistory
} from './fusionEngine';

test('arbitrateSlotStatus correctly arbitrates when both sensor and vision agree occupied', () => {
  const result = arbitrateSlotStatus(
    { distanceCm: 40, thresholdCm: 100, isTriggered: true, lastPingMs: 120 },
    { boxDetected: true, confidence: 0.92, occluded: false, lightingCondition: 'optimal' }
  );
  assert.equal(result.status, 'occupied');
  assert.ok(result.confidence > 95, 'High confidence expected for dual confirmation');
  assert.match(result.note, /Dual confirmation/);
});

test('arbitrateSlotStatus correctly arbitrates when both sensor and vision agree empty', () => {
  const result = arbitrateSlotStatus(
    { distanceCm: 180, thresholdCm: 100, isTriggered: false, lastPingMs: 100 },
    { boxDetected: false, confidence: 0.05, occluded: false, lightingCondition: 'optimal' }
  );
  assert.equal(result.status, 'available');
  assert.ok(result.confidence > 90);
});

test('arbitrateSlotStatus overrides occluded vision with sensor ground-truth', () => {
  const result = arbitrateSlotStatus(
    { distanceCm: 45, thresholdCm: 100, isTriggered: true, lastPingMs: 110 },
    { boxDetected: false, confidence: 0.2, occluded: true, lightingCondition: 'shadow' }
  );
  assert.equal(result.status, 'occupied');
  assert.match(result.note, /Arbitrated via IoT Ground-Truth/);
});

test('arbitrateSlotStatus marks ambiguous discrepancy when sensor triggers with low vision confidence and no occlusion', () => {
  const result = arbitrateSlotStatus(
    { distanceCm: 60, thresholdCm: 100, isTriggered: true, lastPingMs: 130 },
    { boxDetected: false, confidence: 0.3, occluded: false, lightingCondition: 'optimal' }
  );
  assert.equal(result.status, 'discrepancy');
  assert.match(result.note, /Discrepancy detected/);
});

test('calculateLotStats handles initial seed slots correctly', () => {
  const stats = calculateLotStats(INITIAL_SLOTS);
  assert.equal(stats.total, 12);
  assert.equal(stats.available, 6);
  assert.equal(stats.occupied, 5);
  assert.equal(stats.reserved, 1);
  assert.equal(stats.discrepancies, 0);
  assert.equal(stats.occupancyRatePct, 50);
  assert.ok(stats.estimatedSearchTimeMin <= 1.5, 'Quick search time when slots are available');
});

test('appendSlotEvent prepends new event and caps at maxEntries (5)', () => {
  let history: import('./fusionEngine').SlotEventLog[] = [
    {
      id: 'e1',
      timestamp: '10:00:00 AM',
      fromStatus: 'available',
      toStatus: 'occupied',
      trigger: 'Vehicle Arrival',
      confidence: 98,
      note: 'Dual verified'
    }
  ];

  for (let i = 2; i <= 6; i++) {
    history = appendSlotEvent(history, {
      timestamp: `10:0${i}:00 AM`,
      fromStatus: i % 2 === 0 ? 'occupied' : 'available',
      toStatus: i % 2 === 0 ? 'available' : 'occupied',
      trigger: `Transition ${i}`,
      confidence: 95 + (i % 4),
      note: `Event ${i}`
    }, 5);
  }

  assert.equal(history.length, 5, 'History must strictly be capped at 5');
  assert.equal(history[0].trigger, 'Transition 6', 'Most recent event must be at index 0');
  assert.equal(history[4].trigger, 'Transition 2', 'Oldest event within window preserved');
});

test('createInitialEventHistory generates valid initial events for seeded slots', () => {
  const occupiedSlot = INITIAL_SLOTS.find(s => s.status === 'occupied')!;
  const history = createInitialEventHistory(occupiedSlot);
  assert.ok(history.length > 0);
  assert.equal(history[0].toStatus, 'occupied');
});
