import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ParkingSlot,
  SlotStatus,
  SlotEventLog,
  INITIAL_SLOTS,
  arbitrateSlotStatus,
  calculateLotStats,
  appendSlotEvent,
  createInitialEventHistory
} from '../utils/fusionEngine';
import type {
  CameraConfig,
  DetectionHistoryItem,
  OccupancyTrendPoint,
  ParkingAlertItem,
} from '../utils/cameraTypes';
import { LiveCameraDetection } from './LiveCameraDetection';
import {
  Car,
  Zap,
  Accessibility,
  Eye,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Clock,
  BatteryMedium,
  History,
  ArrowRight
} from 'lucide-react';

export const LiveSimulatorSection: React.FC = () => {
  const [slots, setSlots] = useState<ParkingSlot[]>(INITIAL_SLOTS);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot-5');
  const [activeZone, setActiveZone] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [viewTelemetryMode, setViewTelemetryMode] = useState<'fused' | 'sensor' | 'vision'>('fused');

  // Synchronized backend state for Live Camera Detection, History, Trends & Alerts
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [detectionHistory, setDetectionHistory] = useState<DetectionHistoryItem[]>([]);
  const [trends, setTrends] = useState<OccupancyTrendPoint[]>([]);
  const [alerts, setAlerts] = useState<ParkingAlertItem[]>([]);
  const [cvEngineLabel, setCvEngineLabel] = useState<string>('Connecting…');
  const [cvAvailable, setCvAvailable] = useState<boolean>(true);

  // Initialize event history with realistic seed history for every bay
  const [slotHistory, setSlotHistory] = useState<Record<string, SlotEventLog[]>>(() => {
    const initialMap: Record<string, SlotEventLog[]> = {};
    INITIAL_SLOTS.forEach((slot) => {
      initialMap[slot.id] = createInitialEventHistory(slot);
    });
    return initialMap;
  });

  // Load persisted dashboard & camera configuration from Express backend
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok || !active) return;
        const data = await res.json();
        if (!active) return;

        if (Array.isArray(data.cameras)) setCameras(data.cameras);
        if (Array.isArray(data.slots) && data.slots.length > 0) setSlots(data.slots);
        if (Array.isArray(data.history)) setDetectionHistory(data.history);
        if (Array.isArray(data.trends)) setTrends(data.trends);
        if (Array.isArray(data.alerts)) setAlerts(data.alerts);
        if (data.cv) {
          setCvAvailable(Boolean(data.cv.available));
          setCvEngineLabel(
            data.cv.engine === 'python-ultralytics-yolo'
              ? 'Python OpenCV + YOLOv8'
              : data.cv.engine === 'onnx-yolov8n'
              ? 'YOLOv8n ONNX Runtime'
              : 'Unavailable'
          );
        }
      } catch {
        if (active) {
          setCvEngineLabel('Backend offline');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Synchronize backend detection results directly into existing 12-bay dashboard + per-bay 5-event state log
  const handleSyncFromBackend = useCallback(
    (payload: {
      cameras?: CameraConfig[];
      slots?: ParkingSlot[];
      history?: DetectionHistoryItem[];
      trends?: OccupancyTrendPoint[];
      alerts?: ParkingAlertItem[];
    }) => {
      if (payload.cameras) setCameras(payload.cameras);
      if (payload.history) setDetectionHistory(payload.history);
      if (payload.trends) setTrends(payload.trends);
      if (payload.alerts) setAlerts(payload.alerts);

      if (payload.slots) {
        const nextSlots = payload.slots;
        setSlots((prevSlots) => {
          const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          setSlotHistory((prevHist) => {
            const updatedHist = { ...prevHist };
            for (const nextSlot of nextSlots) {
              const oldSlot = prevSlots.find((p) => p.id === nextSlot.id);
              if (oldSlot && oldSlot.status !== nextSlot.status) {
                updatedHist[nextSlot.id] = appendSlotEvent(
                  updatedHist[nextSlot.id] || [],
                  {
                    timestamp,
                    fromStatus: oldSlot.status,
                    toStatus: nextSlot.status,
                    trigger:
                      nextSlot.status === 'discrepancy'
                        ? 'Camera vs IoT Discrepancy'
                        : 'Live Camera Sync',
                    confidence: Math.round(nextSlot.fusedConfidence),
                    note: nextSlot.arbitrationNote,
                  },
                  5
                );
              }
            }
            return updatedHist;
          });

          return nextSlots;
        });
      }
    },
    []
  );

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || slots[0],
    [slots, selectedSlotId]
  );

  const selectedSlotHistory = useMemo(
    () => slotHistory[selectedSlot.id] || [],
    [slotHistory, selectedSlot.id]
  );

  const filteredSlots = useMemo(() => {
    if (activeZone === 'ALL') return slots;
    return slots.filter((s) => s.zone === activeZone);
  }, [slots, activeZone]);

  const stats = useMemo(() => calculateLotStats(slots), [slots]);

  const syncSlotActionToBackend = async (slotId: string, action: string) => {
    try {
      const res = await fetch(`/api/slots/${encodeURIComponent(slotId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.history) setDetectionHistory(data.history);
        if (data.trends) setTrends(data.trends);
        if (data.alerts) setAlerts(data.alerts);
      }
    } catch {
      // Keep local interactive state working even if request fails
    }
  };

  // Handler: Toggle car in or out of slot
  const handleToggleOccupancy = (slotId: string) => {
    const currentSlot = slots.find((s) => s.id === slotId);
    if (!currentSlot) return;

    const willBeOccupied = currentSlot.status === 'available' || currentSlot.status === 'reserved';
    const newSensor = {
      ...currentSlot.sensor,
      distanceCm: willBeOccupied ? 46 : 188,
      isTriggered: willBeOccupied,
      lastPingMs: 110
    };
    const newVision = {
      ...currentSlot.vision,
      boxDetected: willBeOccupied,
      confidence: willBeOccupied ? 0.93 : 0.04,
      occluded: false
    };
    const arbitrated = arbitrateSlotStatus(newSensor, newVision, currentSlot.status);

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          sensor: newSensor,
          vision: newVision,
          status: arbitrated.status,
          fusedConfidence: arbitrated.confidence,
          arbitrationNote: arbitrated.note,
          occupiedSince: willBeOccupied ? 'Just now' : undefined,
          vehiclePlate: willBeOccupied ? (s.vehiclePlate || 'MH-04-AB-5511') : undefined
        };
      })
    );

    // Record change in local state log (capped at 5)
    setSlotHistory((prev) => ({
      ...prev,
      [slotId]: appendSlotEvent(
        prev[slotId] || [],
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          fromStatus: currentSlot.status,
          toStatus: arbitrated.status,
          trigger: willBeOccupied ? 'Vehicle Arrival' : 'Vehicle Departure',
          confidence: arbitrated.confidence,
          note: willBeOccupied
            ? 'Vehicle parked in bay; sensor distance 46cm, YOLO bbox 93%.'
            : 'Vehicle vacated bay; sensor distance clear at 188cm.'
        },
        5
      )
    }));

    void syncSlotActionToBackend(slotId, 'toggle_occupancy');
  };

  // Handler: Toggle ESP32 Sensor Only (demonstrates real IoT vs Camera Discrepancy / Uncertain state)
  const handleToggleSensorOnly = (slotId: string) => {
    const currentSlot = slots.find((s) => s.id === slotId);
    if (!currentSlot) return;

    const nextTriggered = !currentSlot.sensor.isTriggered;
    const newSensor = {
      ...currentSlot.sensor,
      distanceCm: nextTriggered ? 48 : 185,
      isTriggered: nextTriggered,
      lastPingMs: 118,
    };
    const visionOccupied = currentSlot.vision.boxDetected && !currentSlot.vision.occluded;
    const disagreed = nextTriggered !== visionOccupied;
    const nextStatus: SlotStatus = disagreed ? 'discrepancy' : nextTriggered ? 'occupied' : 'available';
    const note = disagreed
      ? `Uncertain / Discrepancy: ESP32 ultrasonic sensor is ${
          nextTriggered ? 'triggered (48cm)' : 'clear (185cm)'
        } while Camera YOLO reports ${visionOccupied ? 'occupied' : 'vacant'}.`
      : nextTriggered
      ? 'Dual verified: ESP32 sensor and Camera YOLO both confirm vehicle presence.'
      : 'Dual verified: ESP32 sensor and Camera YOLO both confirm vacant bay.';

    setSlots((prev) =>
      prev.map((s) =>
        s.id !== slotId
          ? s
          : {
              ...s,
              sensor: newSensor,
              status: nextStatus,
              fusedConfidence: disagreed ? 58 : 99.1,
              arbitrationNote: note,
            }
      )
    );

    setSlotHistory((prev) => ({
      ...prev,
      [slotId]: appendSlotEvent(
        prev[slotId] || [],
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          fromStatus: currentSlot.status,
          toStatus: nextStatus,
          trigger: disagreed ? 'ESP32 vs Camera Mismatch' : 'ESP32 Sensor Aligned',
          confidence: disagreed ? 58 : 99,
          note,
        },
        5
      ),
    }));

    void syncSlotActionToBackend(slotId, 'toggle_sensor_only');
  };

  // Handler: Simulate Camera Occlusion (Pillar or Glare)
  const handleSimulateOcclusion = (slotId: string) => {
    const currentSlot = slots.find((s) => s.id === slotId);
    if (!currentSlot) return;

    const nextOccluded = !currentSlot.vision.occluded;
    const newVision = {
      ...currentSlot.vision,
      occluded: nextOccluded,
      confidence: nextOccluded ? 0.18 : 0.92,
      boxDetected: nextOccluded ? false : currentSlot.sensor.isTriggered,
      lightingCondition: (nextOccluded ? 'glare' : 'optimal') as 'glare' | 'optimal'
    };
    const arbitrated = arbitrateSlotStatus(currentSlot.sensor, newVision, currentSlot.status);

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          vision: newVision,
          status: arbitrated.status,
          fusedConfidence: arbitrated.confidence,
          arbitrationNote: arbitrated.note
        };
      })
    );

    // Record occlusion change in history log
    setSlotHistory((prev) => ({
      ...prev,
      [slotId]: appendSlotEvent(
        prev[slotId] || [],
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          fromStatus: currentSlot.status,
          toStatus: arbitrated.status,
          trigger: nextOccluded ? 'Camera Blindspot / Glare' : 'Camera Sightline Restored',
          confidence: arbitrated.confidence,
          note: nextOccluded
            ? 'CCTV feed degraded/occluded; backend shifted authority to IoT sensor.'
            : 'CCTV feed restored; camera and sensor in full dual consensus.'
        },
        5
      )
    }));

    void syncSlotActionToBackend(slotId, 'toggle_occlusion');
  };

  // Handler: Toggle Reservation
  const handleToggleReservation = (slotId: string) => {
    const currentSlot = slots.find((s) => s.id === slotId);
    if (!currentSlot || currentSlot.status === 'occupied') return;

    const nextStatus: SlotStatus = currentSlot.status === 'reserved' ? 'available' : 'reserved';
    const note =
      nextStatus === 'reserved'
        ? 'Driver reserved via mobile app: Slot held for 15 minutes.'
        : 'Reservation cleared: Slot released to general pool.';

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          status: nextStatus,
          arbitrationNote: note
        };
      })
    );

    // Record reservation event in history log
    setSlotHistory((prev) => ({
      ...prev,
      [slotId]: appendSlotEvent(
        prev[slotId] || [],
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          fromStatus: currentSlot.status,
          toStatus: nextStatus,
          trigger: nextStatus === 'reserved' ? 'Pre-Entry Reservation' : 'Reservation Released',
          confidence: 96,
          note
        },
        5
      )
    }));

    void syncSlotActionToBackend(slotId, 'toggle_reservation');
  };

  // Handler: Reset Lot to Default Seed
  const handleResetLot = async () => {
    setSlots(INITIAL_SLOTS);
    setSelectedSlotId('slot-5');
    const resetMap: Record<string, SlotEventLog[]> = {};
    INITIAL_SLOTS.forEach((slot) => {
      resetMap[slot.id] = createInitialEventHistory(slot);
    });
    setSlotHistory(resetMap);

    try {
      const res = await fetch('/api/slots/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.trends) setTrends(data.trends);
        if (data.history) setDetectionHistory(data.history);
      }
    } catch {
      // ignore
    }
  };

  return (
    <section id="live-dashboard" className="scroll-mt-12 py-16 md:py-24 bg-[#fcfcfd] border-b border-[#dde0e6] relative">
      <span id="live-lot" className="sr-only" />
      <div className="mx-auto max-w-7xl px-6 space-y-16">
        {/* NEW: Live Camera Detection Module (Image Upload, Live Webcam, Camera URL/RTSP, Calibration, Trends, History, Alerts) */}
        <LiveCameraDetection
          cameras={cameras}
          slots={slots}
          history={detectionHistory}
          trends={trends}
          alerts={alerts}
          cvEngineLabel={cvEngineLabel}
          cvAvailable={cvAvailable}
          onSyncFromBackend={handleSyncFromBackend}
        />

        {/* Divider separating Live Camera AI from Synchronized 12-Bay Hybrid IoT + Vision Testbed */}
        <div className="border-t border-[#dde0e6] pt-14">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl space-y-2">
            <div className="text-[13px] font-semibold tracking-wider text-[#074ce0] uppercase">
              Synchronized IoT & Vision Pilot Facility
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#16191f]">
              Live Parking Facility Dashboard & Simulation
            </h2>
            <p className="text-[15px] text-[#454c58] leading-relaxed">
              Automatically synchronized with Live Camera Detection above. Click any slot to inspect ESP32 ultrasonic telemetry vs. YOLOv8 inference, resolve discrepancies, or simulate hardware events.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleResetLot}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#dde0e6] bg-white px-3.5 py-2 text-[13px] font-medium text-[#16191f] shadow-xs hover:border-[#16191f] transition-colors focus-visible:outline-2 focus-visible:outline-[#074ce0]"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#454c58]" />
              <span>Reset Testbed</span>
            </button>
          </div>
        </div>

        {/* Real-Time Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#454c58] uppercase">Available</span>
            <div className="font-display text-2xl font-bold text-[#074ce0] tabular-nums mt-0.5">
              {stats.available}
            </div>
            <span className="text-[11px] text-[#454c58]">Vacant & ready</span>
          </div>

          <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#454c58] uppercase">Occupied</span>
            <div className="font-display text-2xl font-bold text-[#16191f] tabular-nums mt-0.5">
              {stats.occupied}
            </div>
            <span className="text-[11px] text-[#454c58]">Verified parked</span>
          </div>

          <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#454c58] uppercase">Reserved</span>
            <div className="font-display text-2xl font-bold text-[#454c58] tabular-nums mt-0.5">
              {stats.reserved}
            </div>
            <span className="text-[11px] text-[#454c58]">App holds</span>
          </div>

          <div
            className={`rounded-[10px] border p-3.5 shadow-xs ${
              stats.discrepancies > 0
                ? 'border-[#f59e0b]/60 bg-[#fffbeb]'
                : 'border-[#dde0e6] bg-white'
            }`}
          >
            <span
              className={`text-[11px] font-semibold uppercase ${
                stats.discrepancies > 0 ? 'text-[#b45309]' : 'text-[#454c58]'
              }`}
            >
              Discrepancy
            </span>
            <div
              className={`font-display text-2xl font-bold tabular-nums mt-0.5 ${
                stats.discrepancies > 0 ? 'text-[#b45309]' : 'text-[#16191f]'
              }`}
            >
              {stats.discrepancies}
            </div>
            <span className="text-[11px] text-[#454c58]">IoT vs Vision</span>
          </div>

          <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#454c58] uppercase">Occupancy</span>
            <div className="font-display text-2xl font-bold text-[#16191f] tabular-nums mt-0.5">
              {stats.occupancyRatePct}%
            </div>
            <span className="text-[11px] text-[#454c58]">Bay utilization</span>
          </div>

          <div className="rounded-[10px] border border-[#dde0e6] bg-[#f3f4f6] p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#074ce0] uppercase">Search Time</span>
            <div className="font-display text-2xl font-bold text-[#16191f] tabular-nums mt-0.5">
              {stats.estimatedSearchTimeMin} min
            </div>
            <span className="text-[11px] text-[#454c58]">Avg driver time</span>
          </div>
        </div>

        {/* Filter Bar & Telemetry Mode Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Zone filter segmented control */}
          <div className="inline-flex rounded-[8px] border border-[#dde0e6] bg-[#f3f4f6] p-1">
            {(['ALL', 'A', 'B', 'C'] as const).map((zone) => (
              <button
                key={zone}
                onClick={() => setActiveZone(zone)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-[6px] transition-colors ${
                  activeZone === zone
                    ? 'bg-white text-[#16191f] shadow-xs'
                    : 'text-[#454c58] hover:text-[#16191f]'
                }`}
              >
                {zone === 'ALL' ? 'All Bays (12)' : `Zone ${zone}`}
              </button>
            ))}
          </div>

          {/* View mode switcher */}
          <div className="inline-flex items-center gap-2 text-[13px]">
            <span className="text-[#454c58] font-medium hidden sm:inline">Telemetry Overlay:</span>
            <div className="inline-flex rounded-[8px] border border-[#dde0e6] bg-[#f3f4f6] p-1">
              <button
                onClick={() => setViewTelemetryMode('fused')}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-[6px] transition-colors ${
                  viewTelemetryMode === 'fused'
                    ? 'bg-[#074ce0] text-white shadow-xs'
                    : 'text-[#454c58] hover:text-[#16191f]'
                }`}
              >
                Dual Fused (Ground Truth)
              </button>
              <button
                onClick={() => setViewTelemetryMode('sensor')}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors ${
                  viewTelemetryMode === 'sensor'
                    ? 'bg-white text-[#16191f] shadow-xs'
                    : 'text-[#454c58] hover:text-[#16191f]'
                }`}
              >
                IoT Sensor Stream
              </button>
              <button
                onClick={() => setViewTelemetryMode('vision')}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors ${
                  viewTelemetryMode === 'vision'
                    ? 'bg-white text-[#16191f] shadow-xs'
                    : 'text-[#454c58] hover:text-[#16191f]'
                }`}
              >
                CCTV YOLO Inference
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid & Telemetry Inspector Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Parking Lot Bay Layout (8 cols) */}
          <div className="lg:col-span-8 rounded-[12px] border border-[#dde0e6] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#dde0e6] text-[13px] text-[#454c58]">
              <div className="flex items-center gap-4">
                <span className="font-medium text-[#16191f]">Medicaps Campus Bay Level 1</span>
                <span>·</span>
                <span>Entry Gate A</span>
              </div>
              <div className="flex items-center gap-4 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#074ce0]" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16191f]" />
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span>Discrepancy</span>
                </div>
              </div>
            </div>

            {/* 12-Slot Parking Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredSlots.map((slot) => {
                const isSelected = slot.id === selectedSlot.id;

                // Determine display status based on telemetry mode
                let displayStatus: string = slot.status;
                if (viewTelemetryMode === 'sensor') {
                  displayStatus = slot.sensor.isTriggered ? 'occupied' : 'available';
                } else if (viewTelemetryMode === 'vision') {
                  displayStatus = slot.vision.boxDetected ? 'occupied' : 'available';
                  if (slot.vision.occluded) displayStatus = 'occluded / lost';
                }

                const isOccupied = slot.status === 'occupied';
                const isDiscrepancy = slot.status === 'discrepancy';
                const isReserved = slot.status === 'reserved';

                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`relative flex flex-col justify-between rounded-[10px] border p-3.5 text-left transition-all duration-160 ease-out focus-visible:outline-2 focus-visible:outline-[#074ce0] ${
                      isSelected
                        ? 'border-[#074ce0] ring-2 ring-[#074ce0]/20 bg-[#f9fafb]'
                        : 'border-[#dde0e6] bg-white hover:border-[#16191f]/40'
                    }`}
                  >
                    {/* Top Row: Code & Slot Type */}
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="font-display font-bold text-[15px] text-[#16191f]">
                        {slot.code}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-[#454c58]">
                        {slot.type === 'ev' && <Zap className="w-3.5 h-3.5 text-[#074ce0]" aria-label="EV Bay" />}
                        {slot.type === 'accessible' && (
                          <Accessibility className="w-3.5 h-3.5 text-[#074ce0]" aria-label="Accessible" />
                        )}
                        <span className="font-mono text-[10px] uppercase">Z-{slot.zone}</span>
                      </div>
                    </div>

                    {/* Middle Graphic / Status Indicator */}
                    <div className="my-2 py-3 rounded-[6px] bg-[#f3f4f6] flex flex-col items-center justify-center">
                      {isOccupied ? (
                        <div className="flex flex-col items-center">
                          <Car className="w-6 h-6 text-[#16191f]" />
                          <span className="text-[10px] font-mono font-medium text-[#454c58] mt-1">
                            {slot.vehiclePlate ? slot.vehiclePlate.slice(0, 8) : 'OCCUPIED'}
                          </span>
                        </div>
                      ) : isDiscrepancy ? (
                        <div className="flex flex-col items-center text-[#d97706]">
                          <AlertTriangle className="w-6 h-6" />
                          <span className="text-[10px] font-bold mt-1 uppercase">Resolving</span>
                        </div>
                      ) : isReserved ? (
                        <div className="flex flex-col items-center text-[#454c58]">
                          <Clock className="w-6 h-6 text-[#074ce0]" />
                          <span className="text-[10px] font-semibold mt-1">RESERVED</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-[#074ce0]">
                          <CheckCircle className="w-6 h-6" />
                          <span className="text-[10px] font-bold mt-1 uppercase tracking-wide">OPEN</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata */}
                    <div className="flex items-center justify-between w-full pt-1 text-[11px] text-[#454c58]">
                      <span className="capitalize">{displayStatus}</span>
                      <span className="font-mono tabular-nums text-[#074ce0] font-semibold">
                        {Math.round(slot.fusedConfidence)}%
                      </span>
                    </div>

                    {slot.vision.occluded && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f59e0b]" title="Vision Occluded" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instruction footer */}
            <div className="mt-6 pt-4 border-t border-[#dde0e6] flex flex-col sm:flex-row sm:items-center justify-between text-[12px] text-[#454c58] gap-2">
              <span>Selected Slot: <strong className="text-[#16191f] font-mono">{selectedSlot.code}</strong> (Zone {selectedSlot.zone})</span>
              <span>Click slot card to inspect arbitration details and override feeds.</span>
            </div>
          </div>

          {/* Deep Telemetry Inspector & Controls Drawer (4 cols) */}
          <div className="lg:col-span-4 rounded-[12px] border border-[#dde0e6] bg-white p-6 shadow-xs space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#454c58] uppercase tracking-wide">
                  Slot Telemetry Inspector
                </span>
                <span className="font-mono text-[12px] bg-[#f3f4f6] px-2 py-0.5 rounded text-[#16191f] font-semibold">
                  Bay {selectedSlot.code}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#16191f] mt-1">
                {selectedSlot.status === 'occupied'
                  ? 'Vehicle Parked & Active'
                  : selectedSlot.status === 'available'
                  ? 'Vacant & Unoccupied'
                  : selectedSlot.status === 'reserved'
                  ? 'Reserved for Inbound Driver'
                  : 'Arbitration Discrepancy'}
              </h3>
            </div>

            {/* Stream 1: Ultrasonic / IR Telemetry */}
            <div className="rounded-[10px] border border-[#dde0e6] bg-[#fcfcfd] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16191f]">
                  <Cpu className="w-4 h-4 text-[#074ce0]" />
                  <span>ESP32 Sensor Telemetry</span>
                </div>
                <span className="text-[11px] font-mono text-[#074ce0]">Ping: {selectedSlot.sensor.lastPingMs}ms</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="p-2 bg-white rounded border border-[#dde0e6]">
                  <div className="text-[#454c58]">Distance</div>
                  <div className="font-mono font-bold text-[#16191f] mt-0.5">
                    {selectedSlot.sensor.distanceCm} cm
                  </div>
                </div>
                <div className="p-2 bg-white rounded border border-[#dde0e6]">
                  <div className="text-[#454c58]">Threshold</div>
                  <div className="font-mono font-bold text-[#16191f] mt-0.5">
                    &lt; {selectedSlot.sensor.thresholdCm} cm
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[12px] text-[#454c58] pt-1">
                <div className="flex items-center gap-1">
                  <BatteryMedium className="w-3.5 h-3.5 text-[#16191f]" />
                  <span>Battery {selectedSlot.sensor.batteryPct || 95}%</span>
                </div>
                <span>Status: <strong>{selectedSlot.sensor.isTriggered ? 'Triggered (High)' : 'Clear (Low)'}</strong></span>
              </div>
            </div>

            {/* Stream 2: CCTV YOLO Telemetry */}
            <div className="rounded-[10px] border border-[#dde0e6] bg-[#fcfcfd] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16191f]">
                  <Eye className="w-4 h-4 text-[#074ce0]" />
                  <span>CCTV OpenCV + YOLO</span>
                </div>
                <span className="text-[11px] font-mono text-[#454c58]">
                  Lighting: {selectedSlot.vision.lightingCondition}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="p-2 bg-white rounded border border-[#dde0e6]">
                  <div className="text-[#454c58]">Bounding Box</div>
                  <div className="font-mono font-bold text-[#16191f] mt-0.5">
                    {selectedSlot.vision.boxDetected ? 'Car BBox' : 'None'}
                  </div>
                </div>
                <div className="p-2 bg-white rounded border border-[#dde0e6]">
                  <div className="text-[#454c58]">Model Confidence</div>
                  <div className="font-mono font-bold text-[#074ce0] mt-0.5">
                    {(selectedSlot.vision.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[12px] text-[#454c58] pt-1">
                <span>Occlusion: <strong>{selectedSlot.vision.occluded ? 'Yes (Obstructed)' : 'Clear Sightline'}</strong></span>
              </div>
            </div>

            {/* Layer 3: Arbitration Decision */}
            <div className="rounded-[10px] border border-[#074ce0]/30 bg-[#074ce0]/5 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#074ce0] uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4" />
                <span>Arbitration Rationale</span>
              </div>
              <p className="text-[13px] text-[#16191f] leading-relaxed">
                {selectedSlot.arbitrationNote}
              </p>
              <div className="text-[11px] text-[#454c58] font-mono">
                Fused Dual Confidence: <strong className="text-[#074ce0]">{selectedSlot.fusedConfidence}%</strong>
              </div>
            </div>

            {/* Interactive Actions for Selected Slot */}
            <div className="space-y-2 pt-2 border-t border-[#dde0e6]">
              <div className="text-[12px] font-semibold text-[#16191f] mb-1">
                Interactive Test Controls
              </div>

              <button
                onClick={() => handleToggleOccupancy(selectedSlot.id)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#074ce0] px-4 py-2.5 text-[14px] font-medium text-white shadow-xs transition-transform duration-160 ease-out hover:-translate-y-0.5 hover:bg-[#063ec0] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-[#074ce0]"
              >
                <Car className="w-4 h-4" />
                <span>{selectedSlot.status === 'occupied' ? 'Simulate Vehicle Exit' : 'Simulate Vehicle Arrival'}</span>
              </button>

              <button
                onClick={() => handleToggleSensorOnly(selectedSlot.id)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#dde0e6] bg-white px-4 py-2 text-[13px] font-medium text-[#16191f] shadow-xs hover:border-[#16191f] transition-all duration-160 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-[#074ce0]"
              >
                <Cpu className="w-4 h-4 text-[#074ce0]" />
                <span>
                  {selectedSlot.sensor.isTriggered
                    ? 'Set ESP32 Sensor Clear (Test Mismatch)'
                    : 'Trigger ESP32 Sensor Only (Test Mismatch)'}
                </span>
              </button>

              <button
                onClick={() => handleSimulateOcclusion(selectedSlot.id)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#dde0e6] bg-white px-4 py-2 text-[13px] font-medium text-[#16191f] shadow-xs hover:border-[#16191f] transition-all duration-160 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-[#074ce0]"
              >
                <Eye className="w-4 h-4 text-[#454c58]" />
                <span>
                  {selectedSlot.vision.occluded
                    ? 'Clear Camera Occlusion'
                    : 'Simulate Camera Blindspot / Glare'}
                </span>
              </button>

              <button
                onClick={() => handleToggleReservation(selectedSlot.id)}
                disabled={selectedSlot.status === 'occupied'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#dde0e6] bg-white px-4 py-2 text-[13px] font-medium text-[#454c58] shadow-xs hover:text-[#16191f] hover:border-[#16191f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span>
                  {selectedSlot.status === 'reserved'
                    ? 'Cancel Bay Reservation'
                    : 'Reserve Bay for Incoming Driver'}
                </span>
              </button>
            </div>

            {/* Local State Event Log: Last 5 Occupancy Changes */}
            <div className="pt-4 border-t border-[#dde0e6] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#16191f] uppercase tracking-wide">
                  <History className="w-4 h-4 text-[#074ce0]" />
                  <span>Bay {selectedSlot.code} State Log</span>
                </div>
                <span className="text-[11px] font-mono text-[#454c58] bg-[#f3f4f6] px-2 py-0.5 rounded border border-[#dde0e6]">
                  {selectedSlotHistory.length} / 5 events
                </span>
              </div>

              {selectedSlotHistory.length === 0 ? (
                <div className="rounded-[8px] bg-[#f3f4f6] p-3 text-[12px] text-[#454c58] text-center">
                  No occupancy changes recorded yet for this bay.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                  {selectedSlotHistory.map((evt, idx) => {
                    const isArrival = evt.toStatus === 'occupied';
                    const isAvailable = evt.toStatus === 'available';
                    const isReserved = evt.toStatus === 'reserved';
                    const isDiscrepancy = evt.toStatus === 'discrepancy';

                    return (
                      <div
                        key={evt.id || idx}
                        className="rounded-[8px] border border-[#dde0e6] bg-[#fcfcfd] p-2.5 text-[12px] space-y-1 transition-colors hover:bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono tabular-nums text-[11px] text-[#454c58] font-medium">
                            {evt.timestamp}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[#16191f] font-semibold border border-[#dde0e6]">
                            {evt.trigger}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <div className="inline-flex items-center gap-1 font-medium">
                            <span className="capitalize text-[#454c58]">{evt.fromStatus}</span>
                            <ArrowRight className="w-3 h-3 text-[#074ce0]" />
                            <span
                              className={`capitalize font-bold ${
                                isArrival
                                  ? 'text-[#16191f]'
                                  : isAvailable
                                  ? 'text-[#074ce0]'
                                  : isReserved
                                  ? 'text-[#454c58]'
                                  : 'text-[#d97706]'
                              }`}
                            >
                              {evt.toStatus}
                            </span>
                          </div>

                          <span className="font-mono tabular-nums text-[11px] text-[#074ce0] font-semibold">
                            {evt.confidence}% conf
                          </span>
                        </div>

                        <p className="text-[11px] text-[#454c58] leading-tight pt-0.5">
                          {evt.note}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
};
