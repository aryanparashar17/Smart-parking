import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  Video,
  VideoOff,
  Link2,
  Plus,
  Trash2,
  ScanSearch,
  Crosshair,
  Save,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Square,
  History,
  Bell,
  TrendingUp,
  Grid2x2,
  RefreshCw,
} from 'lucide-react';
import type {
  CameraAnalysisResult,
  CameraConfig,
  DetectionHistoryItem,
  NormalizedPoint,
  OccupancyTrendPoint,
  ParkingAlertItem,
  ParkingSpacePolygon,
} from '../utils/cameraTypes';
import type { ParkingSlot } from '../utils/fusionEngine';
import { CameraCanvasOverlay } from './CameraCanvasOverlay';
import { OccupancyTrendChart } from './OccupancyTrendChart';

interface LiveCameraDetectionProps {
  cameras: CameraConfig[];
  slots: ParkingSlot[];
  history: DetectionHistoryItem[];
  trends: OccupancyTrendPoint[];
  alerts: ParkingAlertItem[];
  cvEngineLabel: string;
  cvAvailable: boolean;
  onSyncFromBackend: (payload: {
    cameras?: CameraConfig[];
    slots?: ParkingSlot[];
    history?: DetectionHistoryItem[];
    trends?: OccupancyTrendPoint[];
    alerts?: ParkingAlertItem[];
  }) => void;
}

type InputTab = 'camera' | 'upload' | 'webcam';
type RightTab = 'trend' | 'spaces' | 'history' | 'alerts';

const ALL_SLOT_CODES = [
  'A-01', 'A-02', 'A-03', 'A-04',
  'B-01', 'B-02', 'B-03', 'B-04',
  'C-01', 'C-02', 'C-03', 'C-04',
];

function createStarterGridSpaces(): ParkingSpacePolygon[] {
  const spaces: ParkingSpacePolygon[] = [];
  const cols = 6;
  const rows = 2;
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const y1 = r === 0 ? 0.24 : 0.54;
    const y2 = r === 0 ? 0.46 : 0.80;
    for (let c = 0; c < cols; c++) {
      const x1 = 0.08 + c * 0.14;
      const x2 = x1 + 0.125;
      spaces.push({
        id: `sp-grid-${ALL_SLOT_CODES[idx].toLowerCase()}`,
        slotCode: ALL_SLOT_CODES[idx],
        points: [
          { x: Number(x1.toFixed(3)), y: y1 },
          { x: Number(x2.toFixed(3)), y: y1 },
          { x: Number(x2.toFixed(3)), y: y2 },
          { x: Number(x1.toFixed(3)), y: y2 },
        ],
      });
      idx++;
    }
  }
  return spaces;
}

export const LiveCameraDetection: React.FC<LiveCameraDetectionProps> = ({
  cameras,
  slots,
  history,
  trends,
  alerts,
  cvEngineLabel,
  cvAvailable,
  onSyncFromBackend,
}) => {
  const [inputTab, setInputTab] = useState<InputTab>('camera');
  const [rightTab, setRightTab] = useState<RightTab>('spaces');

  // Camera URL / Registered feeds state
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [newCamName, setNewCamName] = useState('');
  const [newCamUrl, setNewCamUrl] = useState('');
  const [autoIntervalSec, setAutoIntervalSec] = useState<number>(15);
  const [frameBust, setFrameBust] = useState<number>(0);

  // Upload image state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadSpaces, setUploadSpaces] = useState<ParkingSpacePolygon[]>(() => createStarterGridSpaces());
  const [uploadResult, setUploadResult] = useState<CameraAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live webcam state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const webcamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamIntervalSec, setWebcamIntervalSec] = useState<number>(5);
  const [webcamSpaces, setWebcamSpaces] = useState<ParkingSpacePolygon[]>(() => createStarterGridSpaces().slice(0, 4));
  const [webcamResult, setWebcamResult] = useState<CameraAnalysisResult | null>(null);

  // Calibration state
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationSlotCode, setCalibrationSlotCode] = useState<string>('A-01');
  const [draftPoints, setDraftPoints] = useState<NormalizedPoint[]>([]);
  const [savingSpaces, setSavingSpaces] = useState(false);

  // Shared UI status
  const [showVehicleBoxes, setShowVehicleBoxes] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Select first camera once loaded
  useEffect(() => {
    if (!selectedCameraId && cameras.length > 0) {
      setSelectedCameraId(cameras[0].id);
    } else if (selectedCameraId && cameras.length > 0 && !cameras.some((c) => c.id === selectedCameraId)) {
      setSelectedCameraId(cameras[0].id);
    }
  }, [cameras, selectedCameraId]);

  const activeCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0] || null;

  // Poll dashboard state when any backend camera stream is active
  useEffect(() => {
    const streamingCam = cameras.find((c) => c.isStreaming);
    if (!streamingCam) return;
    const pollMs = Math.max(4000, streamingCam.intervalSec * 1000);
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          onSyncFromBackend(data);
          setFrameBust(Date.now());
        }
      } catch {
        // Ignore transient poll errors
      }
    }, pollMs);
    return () => clearInterval(id);
  }, [cameras, onSyncFromBackend]);

  // Cleanup webcam & object URLs on unmount
  useEffect(() => {
    return () => {
      if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    };
  }, [uploadedPreviewUrl]);

  // Active spaces & active analysis result for whichever tab is currently visible
  const currentSpaces: ParkingSpacePolygon[] =
    inputTab === 'camera'
      ? activeCamera?.spaces || []
      : inputTab === 'upload'
      ? uploadSpaces
      : webcamSpaces;

  const currentResult: CameraAnalysisResult | null =
    inputTab === 'camera'
      ? activeCamera?.lastResult || null
      : inputTab === 'upload'
      ? uploadResult
      : webcamResult;

  // --- Handlers: Registered Camera & URL ---
  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!newCamName.trim() || !newCamUrl.trim()) {
      setErrorMessage('Enter both a camera name and a supported HTTP(S) image or RTSP URL.');
      return;
    }

    try {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCamName.trim(),
          url: newCamUrl.trim(),
          intervalSec: autoIntervalSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to add camera.');
        return;
      }
      onSyncFromBackend({ cameras: data.cameras });
      setSelectedCameraId(data.camera.id);
      setNewCamName('');
      setNewCamUrl('');
      setStatusMessage(`Camera "${data.camera.name}" registered and persisted.`);
    } catch {
      setErrorMessage('Network error while adding camera.');
    }
  };

  const handleDeleteCamera = async (camId: string) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/cameras/${encodeURIComponent(camId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Could not remove camera.');
        return;
      }
      onSyncFromBackend({ cameras: data.cameras });
      setStatusMessage('Camera removed.');
    } catch {
      setErrorMessage('Failed to delete camera.');
    }
  };

  const handleAnalyzeSelectedCamera = async () => {
    if (!activeCamera) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setIsAnalyzing(true);

    try {
      const res = await fetch(`/api/detect/camera/${encodeURIComponent(activeCamera.id)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Camera detection failed.');
        if (data.cameras || data.alerts) {
          onSyncFromBackend({ cameras: data.cameras, alerts: data.alerts });
        }
        return;
      }

      onSyncFromBackend({
        cameras: data.cameras,
        slots: data.slots,
        history: data.history,
        trends: data.trends,
        alerts: data.alerts,
      });
      setFrameBust(Date.now());
      setStatusMessage(
        `Analyzed ${activeCamera.name} in ${data.result.inferenceMs}ms (${data.result.detectedVehiclesCount} vehicles detected, ${data.result.occupiedSpaces}/${data.result.totalSpaces} bays occupied).`
      );
    } catch {
      setErrorMessage('Unable to reach backend detection API.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleAutoStream = async () => {
    if (!activeCamera) return;
    setErrorMessage(null);
    setStatusMessage(null);

    if (activeCamera.isStreaming) {
      const res = await fetch(`/api/cameras/${encodeURIComponent(activeCamera.id)}/stream/stop`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        onSyncFromBackend({ cameras: data.cameras });
        setStatusMessage(`Stopped periodic analysis on ${activeCamera.name}.`);
      }
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/cameras/${encodeURIComponent(activeCamera.id)}/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalSec: autoIntervalSec }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Could not start periodic camera stream.');
        if (data.cameras || data.alerts) {
          onSyncFromBackend({ cameras: data.cameras, alerts: data.alerts });
        }
        return;
      }
      onSyncFromBackend({
        cameras: cameras.map((c) => (c.id === data.camera.id ? data.camera : c)),
        slots: data.slots,
        history: data.history,
        trends: data.trends,
        alerts: data.alerts,
      });
      setStatusMessage(`Auto-analysis active every ${autoIntervalSec}s on ${activeCamera.name}.`);
    } catch {
      setErrorMessage('Network error starting automatic camera processing.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Handlers: Upload Image ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Please upload a JPG, JPEG, or PNG image file.');
      return;
    }

    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedFile(file);
    setUploadedPreviewUrl(URL.createObjectURL(file));
    setUploadResult(null);
    setStatusMessage(`Loaded "${file.name}". Adjust space calibration if needed, then click Analyze Image.`);
  };

  const handleAnalyzeUploadedImage = async () => {
    if (!uploadedFile) {
      setErrorMessage('Please upload a parking lot JPG or PNG image first.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsAnalyzing(true);

    try {
      const form = new FormData();
      form.append('image', uploadedFile);
      form.append('cameraName', `Upload: ${uploadedFile.name}`);
      form.append('cameraId', 'upload-session');
      form.append('spaces', JSON.stringify(uploadSpaces));
      form.append('syncDashboard', 'true');

      const res = await fetch('/api/detect/image', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Image analysis failed.');
        return;
      }

      setUploadResult(data.result);
      onSyncFromBackend({
        slots: data.slots,
        history: data.history,
        trends: data.trends,
        alerts: data.alerts,
      });
      setStatusMessage(
        `Analyzed uploaded image in ${data.result.inferenceMs}ms: ${data.result.detectedVehiclesCount} vehicles detected across ${data.result.totalSpaces} calibrated spaces.`
      );
    } catch {
      setErrorMessage('Network error while analyzing uploaded image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Handlers: Live Webcam ---
  const captureAndAnalyzeWebcamFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.88)
    );
    if (!blob) return;

    setIsAnalyzing(true);
    try {
      const form = new FormData();
      form.append('image', blob, 'webcam-frame.jpg');
      form.append('cameraName', 'Live Browser Webcam');
      form.append('cameraId', 'webcam-live');
      form.append('spaces', JSON.stringify(webcamSpaces));
      form.append('syncDashboard', 'true');

      const res = await fetch('/api/detect/image', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Webcam frame analysis failed.');
        return;
      }

      setWebcamResult(data.result);
      onSyncFromBackend({
        slots: data.slots,
        history: data.history,
        trends: data.trends,
        alerts: data.alerts,
      });
    } catch {
      setErrorMessage('Failed to send webcam frame to detection backend.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [webcamSpaces, onSyncFromBackend]);

  const handleStopWebcam = useCallback(() => {
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = null;
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
    setStatusMessage('Webcam stopped.');
  }, []);

  const handleStartWebcam = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Your browser does not support webcam access (getUserMedia unavailable).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      webcamStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setWebcamActive(true);
      setStatusMessage(
        `Webcam active. Analyzing frames automatically every ${webcamIntervalSec}s.`
      );

      // Start periodic frame analysis
      if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = setInterval(() => {
        captureAndAnalyzeWebcamFrame();
      }, webcamIntervalSec * 1000);
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'NotAllowedError') {
        setErrorMessage('Webcam permission was denied. Allow camera access in your browser settings to use live webcam detection.');
      } else if (name === 'NotFoundError') {
        setErrorMessage('No webcam device was detected on this machine. Try Upload Parking Lot Image or Camera URL instead.');
      } else {
        setErrorMessage(`Unable to access webcam: ${(err as Error).message}`);
      }
    }
  };

  // Keep webcam interval updated if user changes cadence while running
  useEffect(() => {
    if (!webcamActive) return;
    if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
    webcamIntervalRef.current = setInterval(() => {
      captureAndAnalyzeWebcamFrame();
    }, webcamIntervalSec * 1000);
    return () => {
      if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
    };
  }, [webcamActive, webcamIntervalSec, captureAndAnalyzeWebcamFrame]);

  // --- Handlers: Calibration ---
  const setSpacesForActiveTab = (updater: (prev: ParkingSpacePolygon[]) => ParkingSpacePolygon[]) => {
    if (inputTab === 'camera' && activeCamera) {
      const updated = updater(activeCamera.spaces);
      onSyncFromBackend({
        cameras: cameras.map((c) => (c.id === activeCamera.id ? { ...c, spaces: updated } : c)),
      });
    } else if (inputTab === 'upload') {
      setUploadSpaces(updater);
    } else {
      setWebcamSpaces(updater);
    }
  };

  const handleAddCalibrationPoint = (pt: NormalizedPoint) => {
    const next = [...draftPoints, pt];
    if (next.length >= 4) {
      // Complete 4-corner polygon for selected slotCode
      const newSpace: ParkingSpacePolygon = {
        id: `sp-cal-${calibrationSlotCode.toLowerCase()}-${Date.now()}`,
        slotCode: calibrationSlotCode,
        points: next,
      };
      setSpacesForActiveTab((prev) => [
        ...prev.filter((s) => s.slotCode !== calibrationSlotCode),
        newSpace,
      ]);
      setDraftPoints([]);

      // Auto-advance to next unmapped slot code
      const currentIdx = ALL_SLOT_CODES.indexOf(calibrationSlotCode);
      if (currentIdx >= 0 && currentIdx + 1 < ALL_SLOT_CODES.length) {
        setCalibrationSlotCode(ALL_SLOT_CODES[currentIdx + 1]);
      }
      setStatusMessage(
        `Marked polygon for ${calibrationSlotCode}. Click "Save Calibration" to persist coordinates.`
      );
    } else {
      setDraftPoints(next);
    }
  };

  const handleRemoveSpacePolygon = (slotCode: string) => {
    setSpacesForActiveTab((prev) => prev.filter((s) => s.slotCode !== slotCode));
  };

  const handleSaveCalibration = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (inputTab !== 'camera' || !activeCamera) {
      setCalibrating(false);
      setDraftPoints([]);
      setStatusMessage(`Saved ${currentSpaces.length} calibrated parking spaces for this session.`);
      return;
    }

    setSavingSpaces(true);
    try {
      const res = await fetch(`/api/cameras/${encodeURIComponent(activeCamera.id)}/spaces`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaces: activeCamera.spaces }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Could not save space coordinates.');
        return;
      }
      onSyncFromBackend({ cameras: data.cameras });
      setCalibrating(false);
      setDraftPoints([]);
      setStatusMessage(
        `Persisted ${activeCamera.spaces.length} calibrated parking space polygons for ${activeCamera.name}.`
      );
    } catch {
      setErrorMessage('Network error while saving calibration.');
    } finally {
      setSavingSpaces(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        onSyncFromBackend({ alerts: data.alerts });
      }
    } catch {
      // ignore
    }
  };

  const previewSrc =
    inputTab === 'camera' && activeCamera
      ? activeCamera.sourceType === 'demo'
        ? activeCamera.previewUrl
        : `${activeCamera.previewUrl}?t=${frameBust}`
      : inputTab === 'upload'
      ? uploadedPreviewUrl
      : null;

  const activeAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div id="camera-detection" className="scroll-mt-20 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#dde0e6] pb-6">
        <div className="max-w-2xl space-y-1.5">
          <div className="text-[13px] font-semibold tracking-wider text-[#074ce0] uppercase">
            Live CCTV & Computer Vision Module
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#16191f]">
            Live Camera Detection
          </h3>
          <p className="text-[14px] text-[#454c58] leading-relaxed">
            Run real YOLOv8 vehicle detection across uploaded parking images, your live browser webcam, or external HTTP/RTSP camera feeds. Each calibrated space syncs directly with the ESP32 telemetry dashboard below.
          </p>
        </div>

        {/* Input Source Switcher + Engine Indicator */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-[12px] font-mono text-[#454c58]">
            Engine: <strong className="text-[#16191f]">{cvEngineLabel}</strong>
          </span>
          <div className="inline-flex rounded-[8px] border border-[#dde0e6] bg-[#f3f4f6] p-1" role="tablist" aria-label="Camera Input Mode">
            <button
              type="button"
              role="tab"
              aria-selected={inputTab === 'camera'}
              onClick={() => {
                setInputTab('camera');
                setErrorMessage(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-[6px] whitespace-nowrap transition-colors ${
                inputTab === 'camera'
                  ? 'bg-white text-[#16191f] shadow-xs'
                  : 'text-[#454c58] hover:text-[#16191f]'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Camera URL</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputTab === 'upload'}
              onClick={() => {
                setInputTab('upload');
                setErrorMessage(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-[6px] whitespace-nowrap transition-colors ${
                inputTab === 'upload'
                  ? 'bg-white text-[#16191f] shadow-xs'
                  : 'text-[#454c58] hover:text-[#16191f]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputTab === 'webcam'}
              onClick={() => {
                setInputTab('webcam');
                setErrorMessage(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-[6px] whitespace-nowrap transition-colors ${
                inputTab === 'webcam'
                  ? 'bg-white text-[#16191f] shadow-xs'
                  : 'text-[#454c58] hover:text-[#16191f]'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Live Webcam</span>
            </button>
          </div>
        </div>
      </div>

      {/* Model Unavailable Warning */}
      {!cvAvailable && (
        <div role="alert" className="rounded-[10px] border border-[#dc2626]/40 bg-[#dc2626]/5 px-4 py-3 text-[13px] text-[#991b1b] flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#dc2626]" />
          <div>
            <strong>YOLO model unavailable:</strong> Install Python OpenCV + Ultralytics (
            <code className="font-mono text-[12px]">pip install -r python_cv/requirements.txt</code>) or place{' '}
            <code className="font-mono text-[12px]">yolov8n.onnx</code> inside <code className="font-mono text-[12px]">/models</code>. Fake detections are strictly disabled.
          </div>
        </div>
      )}

      {/* 1. Camera Management / Mode Controls Bar (modeled after smart-parking.codewords.run) */}
      {inputTab === 'camera' && (
        <div className="rounded-[12px] border border-[#dde0e6] bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {cameras.map((cam) => {
                const isSelected = activeCamera?.id === cam.id;
                return (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => {
                      setSelectedCameraId(cam.id);
                      setCalibrating(false);
                      setDraftPoints([]);
                      setErrorMessage(cam.lastError || null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-[8px] border px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'border-[#074ce0] bg-[#074ce0]/5 text-[#074ce0]'
                        : 'border-[#dde0e6] bg-[#fcfcfd] text-[#16191f] hover:border-[#16191f]/40'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{cam.name}</span>
                    {cam.isStreaming && (
                      <span className="w-2 h-2 rounded-full bg-[#16a34a]" title="Auto-streaming active" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Auto-analysis interval controls */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="auto-interval-select" className="sr-only">
                Auto-analysis interval
              </label>
              <select
                id="auto-interval-select"
                value={autoIntervalSec}
                onChange={(e) => setAutoIntervalSec(Number(e.target.value))}
                className="rounded-[8px] border border-[#dde0e6] bg-[#fcfcfd] px-2.5 py-2 text-[13px] font-mono text-[#16191f] focus-visible:outline-2 focus-visible:outline-[#074ce0]"
              >
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>

              <button
                type="button"
                onClick={handleToggleAutoStream}
                disabled={!activeCamera || isAnalyzing}
                className={`inline-flex items-center gap-1.5 rounded-[8px] border px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${
                  activeCamera?.isStreaming
                    ? 'border-[#dc2626] bg-[#dc2626] text-white hover:bg-[#b91c1c]'
                    : 'border-[#dde0e6] bg-white text-[#16191f] hover:border-[#16191f]'
                }`}
              >
                {activeCamera?.isStreaming ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Auto</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Auto</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Inline Add Camera Form (HTTP/HTTPS Snapshot or RTSP via Backend FFmpeg) */}
          <form onSubmit={handleAddCamera} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-3 border-t border-[#dde0e6]">
            <div className="md:col-span-3">
              <label htmlFor="camera-name-input" className="sr-only">
                Camera Name
              </label>
              <input
                id="camera-name-input"
                type="text"
                value={newCamName}
                onChange={(e) => setNewCamName(e.target.value)}
                placeholder="Camera Name (e.g. Gate C)"
                className="w-full rounded-[8px] border border-[#dde0e6] bg-[#fcfcfd] px-3 py-2 text-[13px] text-[#16191f] placeholder:text-[#454c58]/70 focus-visible:outline-2 focus-visible:outline-[#074ce0]"
              />
            </div>
            <div className="md:col-span-7">
              <label htmlFor="camera-url-input" className="sr-only">
                Camera Image or RTSP Stream URL
              </label>
              <input
                id="camera-url-input"
                type="text"
                value={newCamUrl}
                onChange={(e) => setNewCamUrl(e.target.value)}
                placeholder="Paste HTTP(S) camera snapshot URL or rtsp:// stream URL (bridged on backend)..."
                className="w-full rounded-[8px] border border-[#dde0e6] bg-[#fcfcfd] px-3 py-2 text-[13px] font-mono text-[#16191f] placeholder:font-sans placeholder:text-[#454c58]/70 focus-visible:outline-2 focus-visible:outline-[#074ce0]"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#16191f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2a303b] transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Camera</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {inputTab === 'upload' && (
        <div className="rounded-[12px] border border-[#dde0e6] bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              id="parking-image-upload"
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#dde0e6] bg-[#fcfcfd] px-4 py-2 text-[13px] font-semibold text-[#16191f] hover:border-[#16191f] transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4 text-[#074ce0]" />
              <span>Choose JPG / PNG Image</span>
            </button>
            <span className="text-[13px] text-[#454c58] truncate max-w-xs">
              {uploadedFile ? uploadedFile.name : 'No parking lot image selected'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setUploadSpaces(createStarterGridSpaces())}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#dde0e6] bg-white px-3 py-2 text-[12px] font-medium text-[#454c58] hover:text-[#16191f] hover:border-[#16191f] whitespace-nowrap"
            >
              <Grid2x2 className="w-3.5 h-3.5" />
              <span>Reset 12-Bay Grid</span>
            </button>
            <button
              type="button"
              onClick={handleAnalyzeUploadedImage}
              disabled={!uploadedFile || isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#074ce0] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#063ec0] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <ScanSearch className="w-4 h-4" />
              <span>{isAnalyzing ? 'Analyzing…' : 'Analyze Image'}</span>
            </button>
          </div>
        </div>
      )}

      {inputTab === 'webcam' && (
        <div className="rounded-[12px] border border-[#dde0e6] bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {!webcamActive ? (
              <button
                type="button"
                onClick={handleStartWebcam}
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#074ce0] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#063ec0] transition-colors whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                <span>Start Camera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopWebcam}
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#dc2626] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#b91c1c] transition-colors whitespace-nowrap"
              >
                <VideoOff className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            )}

            <button
              type="button"
              onClick={captureAndAnalyzeWebcamFrame}
              disabled={!webcamActive || isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#dde0e6] bg-white px-3.5 py-2 text-[13px] font-medium text-[#16191f] hover:border-[#16191f] disabled:opacity-50 whitespace-nowrap"
            >
              <ScanSearch className="w-4 h-4 text-[#074ce0]" />
              <span>Analyze Frame Now</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[13px] text-[#454c58]">
            <label htmlFor="webcam-interval">Frame interval:</label>
            <select
              id="webcam-interval"
              value={webcamIntervalSec}
              onChange={(e) => setWebcamIntervalSec(Number(e.target.value))}
              className="rounded-[8px] border border-[#dde0e6] bg-[#fcfcfd] px-2.5 py-1.5 text-[13px] font-mono text-[#16191f]"
            >
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
            </select>
          </div>
        </div>
      )}

      {/* Feedback / Error Banners */}
      {errorMessage && (
        <div role="alert" className="rounded-[10px] border border-[#dc2626]/40 bg-[#dc2626]/5 px-4 py-3 text-[13px] text-[#991b1b] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#dc2626]" />
          <span>{errorMessage}</span>
        </div>
      )}
      {statusMessage && !errorMessage && (
        <div className="rounded-[10px] border border-[#074ce0]/25 bg-[#074ce0]/5 px-4 py-2.5 text-[13px] text-[#16191f] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#074ce0]" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 2. Live Detection KPI Strip (Total Spaces, Available, Occupied, Occupancy %, Detected Vehicles) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#454c58] uppercase">Total Spaces</span>
          <div className="font-display text-2xl font-bold text-[#16191f] tabular-nums mt-0.5" data-testid="cam-total-spaces">
            {currentResult ? currentResult.totalSpaces : currentSpaces.length || '--'}
          </div>
          <span className="text-[11px] text-[#454c58]">Calibrated bays</span>
        </div>

        <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#454c58] uppercase">Available</span>
          <div className="font-display text-2xl font-bold text-[#16a34a] tabular-nums mt-0.5" data-testid="cam-available-spaces">
            {currentResult ? currentResult.availableSpaces : '--'}
          </div>
          <span className="text-[11px] text-[#454c58]">Green outline</span>
        </div>

        <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#454c58] uppercase">Occupied</span>
          <div className="font-display text-2xl font-bold text-[#dc2626] tabular-nums mt-0.5" data-testid="cam-occupied-spaces">
            {currentResult ? currentResult.occupiedSpaces : '--'}
          </div>
          <span className="text-[11px] text-[#454c58]">Red outline</span>
        </div>

        <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#454c58] uppercase">Occupancy</span>
          <div className="font-display text-2xl font-bold text-[#074ce0] tabular-nums mt-0.5" data-testid="cam-occupancy-pct">
            {currentResult ? `${currentResult.occupancyPercentage}%` : '--'}
          </div>
          <span className="text-[11px] text-[#454c58]">Camera coverage</span>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-[10px] border border-[#dde0e6] bg-[#f3f4f6] p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#454c58] uppercase">Detected Vehicles</span>
          <div className="font-display text-2xl font-bold text-[#16191f] tabular-nums mt-0.5" data-testid="cam-detected-vehicles">
            {currentResult ? currentResult.detectedVehiclesCount : '--'}
          </div>
          <span className="text-[11px] text-[#454c58]">
            {currentResult ? `YOLOv8 · ${currentResult.inferenceMs}ms` : 'Cars / Trucks / Buses'}
          </span>
        </div>
      </div>

      {/* 3. Main 2-Column Monitoring Workspace (Camera Preview Left, Trend / Spaces / History / Alerts Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live Camera Preview + Calibration Controls (8 cols) */}
        <div className="lg:col-span-8 rounded-[12px] border border-[#dde0e6] bg-white p-5 shadow-xs space-y-4">
          {/* Preview Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#dde0e6]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#074ce0] shrink-0" />
                <h4 className="font-display text-[16px] font-bold text-[#16191f] truncate">
                  {inputTab === 'camera'
                    ? activeCamera?.name || 'No camera selected'
                    : inputTab === 'upload'
                    ? uploadedFile?.name || 'Parking Lot Image Upload'
                    : 'Live Browser Webcam Stream'}
                </h4>
              </div>
              {inputTab === 'camera' && activeCamera && (
                <p className="text-[12px] font-mono text-[#454c58] truncate mt-0.5">
                  {activeCamera.displayUrl}
                  {activeCamera.lastAnalyzedAt ? ` · Last analyzed ${activeCamera.lastAnalyzedAt}` : ''}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="inline-flex items-center gap-1.5 text-[12px] text-[#454c58] mr-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showVehicleBoxes}
                  onChange={(e) => setShowVehicleBoxes(e.target.checked)}
                  className="rounded border-[#dde0e6] accent-[#074ce0]"
                />
                <span>Vehicle Boxes</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setCalibrating((v) => !v);
                  setDraftPoints([]);
                }}
                className={`inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                  calibrating
                    ? 'border-[#074ce0] bg-[#074ce0]/10 text-[#074ce0]'
                    : 'border-[#dde0e6] bg-white text-[#16191f] hover:border-[#16191f]'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{calibrating ? 'Exit Calibration' : 'Calibrate Spaces'}</span>
              </button>

              {inputTab === 'camera' && activeCamera && (
                <>
                  <button
                    type="button"
                    onClick={handleAnalyzeSelectedCamera}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#074ce0] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#063ec0] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzing ? 'Analyzing…' : 'Analyze Now'}</span>
                  </button>

                  {activeCamera.sourceType !== 'demo' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCamera(activeCamera.id)}
                      aria-label={`Delete camera ${activeCamera.name}`}
                      className="inline-flex items-center justify-center rounded-[8px] border border-[#dde0e6] bg-white p-1.5 text-[#454c58] hover:text-[#dc2626] hover:border-[#dc2626] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Calibration Toolbar when active */}
          {calibrating && (
            <div className="rounded-[8px] border border-[#074ce0]/30 bg-[#074ce0]/5 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="font-semibold text-[#16191f]">
                    Click 4 corners on the image to map bay:
                  </span>
                  <select
                    aria-label="Select parking slot ID to calibrate"
                    value={calibrationSlotCode}
                    onChange={(e) => setCalibrationSlotCode(e.target.value)}
                    className="rounded-[6px] border border-[#dde0e6] bg-white px-2 py-1 font-mono text-[12px] font-semibold text-[#16191f]"
                  >
                    {ALL_SLOT_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono text-[#074ce0]">
                    ({draftPoints.length}/4 corners placed)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftPoints((p) => p.slice(0, -1))}
                    disabled={draftPoints.length === 0}
                    className="inline-flex items-center gap-1 rounded-[6px] border border-[#dde0e6] bg-white px-2.5 py-1 text-[12px] font-medium text-[#16191f] disabled:opacity-40"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo Corner</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCalibration}
                    disabled={savingSpaces}
                    className="inline-flex items-center gap-1 rounded-[6px] bg-[#074ce0] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#063ec0] disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingSpaces ? 'Saving…' : 'Save Calibration'}</span>
                  </button>
                </div>
              </div>

              {/* Removable list of currently mapped slots */}
              {currentSpaces.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#074ce0]/15 text-[11px]">
                  <span className="text-[#454c58] mr-1">Mapped ({currentSpaces.length}):</span>
                  {currentSpaces.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => handleRemoveSpacePolygon(sp.slotCode)}
                      title={`Remove calibrated space ${sp.slotCode}`}
                      className="inline-flex items-center gap-1 rounded border border-[#dde0e6] bg-white px-1.5 py-0.5 font-mono text-[#16191f] hover:border-[#dc2626] hover:text-[#dc2626]"
                    >
                      <span>{sp.slotCode}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Camera Image / Webcam Video + SVG Polygon & BBox Overlay */}
          <CameraCanvasOverlay
            mode={inputTab === 'webcam' ? 'webcam' : 'image'}
            imageSrc={previewSrc}
            imageAlt={activeCamera?.name || 'Parking lot CCTV preview'}
            videoRef={videoRef}
            webcamActive={webcamActive}
            spaces={currentSpaces}
            spaceResults={currentResult?.spaces}
            vehicles={currentResult?.vehicles}
            discrepancySlots={currentResult?.discrepancySlots}
            showVehicleBoxes={showVehicleBoxes}
            calibrating={calibrating}
            draftPoints={draftPoints}
            onAddCalibrationPoint={handleAddCalibrationPoint}
            onImageError={() =>
              setErrorMessage(
                'Unable to load preview frame from this camera URL. Verify the stream is reachable and returns an image.'
              )
            }
            isAnalyzing={isAnalyzing}
          />

          {/* Overlay Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[12px] text-[#454c58]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[3px] border-2 border-[#16a34a] bg-[#16a34a]/20" />
                <span>Vacant Space</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[3px] border-2 border-[#dc2626] bg-[#dc2626]/20" />
                <span>Occupied Space</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[3px] border-2 border-dashed border-[#facc15] bg-[#16191f]" />
                <span>YOLO Vehicle Box</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[3px] border-2 border-dashed border-[#f59e0b]" />
                <span>IoT vs Camera Discrepancy</span>
              </span>
            </div>
            <span className="font-mono text-[11px]">
              {currentResult
                ? `${currentResult.imageWidth}×${currentResult.imageHeight}px`
                : `${currentSpaces.length} calibrated polygons`}
            </span>
          </div>
        </div>

        {/* Right: Tabbed Panel — Trend | Spaces | History | Alerts (4 cols) */}
        <div className="lg:col-span-4 rounded-[12px] border border-[#dde0e6] bg-white p-5 shadow-xs space-y-4">
          <div
            className="grid grid-cols-4 gap-1 rounded-[8px] border border-[#dde0e6] bg-[#f3f4f6] p-1"
            role="tablist"
            aria-label="Detection intelligence tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'spaces'}
              onClick={() => setRightTab('spaces')}
              className={`px-2 py-1.5 text-[12px] font-semibold rounded-[6px] whitespace-nowrap transition-colors ${
                rightTab === 'spaces'
                  ? 'bg-white text-[#16191f] shadow-xs'
                  : 'text-[#454c58] hover:text-[#16191f]'
              }`}
            >
              Spaces
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'trend'}
              onClick={() => setRightTab('trend')}
              className={`px-2 py-1.5 text-[12px] font-semibold rounded-[6px] whitespace-nowrap transition-colors ${
                rightTab === 'trend'
                  ? 'bg-white text-[#16191f] shadow-xs'
                  : 'text-[#454c58] hover:text-[#16191f]'
              }`}
            >
              Trend
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'history'}
              onClick={() => setRightTab('history')}
              className={`px-2 py-1.5 text-[12px] font-semibold rounded-[6px] whitespace-nowrap transition-colors ${
                rightTab === 'history'
                  ? 'bg-white text-[#16191f] shadow-xs'
                  : 'text-[#454c58] hover:text-[#16191f]'
              }`}
            >
              History
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'alerts'}
              onClick={() => setRightTab('alerts')}
              className={`px-2 py-1.5 text-[12px] font-semibold rounded-[6px] whitespace-nowrap transition-colors ${
                rightTab === 'alerts'
                  ? 'bg-white text-[#16191f] shadow-xs'
                  : 'text-[#454c58] hover:text-[#16191f]'
              }`}
            >
              Alerts{activeAlertsCount > 0 ? ` (${activeAlertsCount})` : ''}
            </button>
          </div>

          {/* Tab Panel: Individual Parking Slot Status */}
          {rightTab === 'spaces' && (
            <div className="space-y-3" data-testid="individual-slot-status-list">
              <div className="flex items-center justify-between text-[12px] text-[#454c58]">
                <span className="font-semibold text-[#16191f]">Individual Parking Slot Status</span>
                <span className="font-mono tabular-nums">
                  {currentResult ? `${currentResult.spaces.length} bays` : 'Awaiting scan'}
                </span>
              </div>

              {!currentResult ? (
                <div className="rounded-[8px] border border-dashed border-[#dde0e6] bg-[#fcfcfd] p-6 text-center space-y-1.5">
                  <p className="text-[13px] font-medium text-[#16191f]">
                    Click &ldquo;Analyze Now&rdquo; to inspect individual bays
                  </p>
                  <p className="text-[12px] text-[#454c58]">
                    Each calibrated slot (A-01 through C-04) will be classified individually using YOLOv8 vehicle overlap and cross-checked with ESP32 sensors.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#dde0e6] max-h-[380px] overflow-y-auto pr-1">
                  {currentResult.spaces.map((sp) => {
                    const syncedSlot = slots.find((s) => s.code === sp.slotCode);
                    const isDiscrepancy = syncedSlot?.status === 'discrepancy';
                    const isOccupied = sp.status === 'occupied';

                    return (
                      <div
                        key={sp.spaceId}
                        className="py-2.5 flex items-center justify-between gap-2 text-[13px]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#16191f]">{sp.slotCode}</span>
                            <span
                              className={`text-[12px] font-semibold ${
                                isDiscrepancy
                                  ? 'text-[#d97706]'
                                  : isOccupied
                                  ? 'text-[#dc2626]'
                                  : 'text-[#16a34a]'
                              }`}
                            >
                              {isDiscrepancy
                                ? 'Uncertain (Discrepancy)'
                                : isOccupied
                                ? 'Occupied'
                                : 'Available'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#454c58] truncate">
                            {isOccupied
                              ? `Camera: ${sp.vehicleLabel || 'vehicle'} · ${Math.round(
                                  sp.confidence * 100
                                )}% conf · ${Math.round(sp.overlapScore * 100)}% overlap`
                              : 'Camera: Vacant stall'}
                            {syncedSlot
                              ? ` · ESP32: ${syncedSlot.sensor.isTriggered ? 'Triggered' : 'Clear'}`
                              : ''}
                          </div>
                        </div>

                        <span className="font-mono tabular-nums text-[11px] text-[#454c58] shrink-0">
                          {isDiscrepancy ? 'Verify' : isOccupied ? 'RED' : 'GREEN'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab Panel: Occupancy Over Time Graph */}
          {rightTab === 'trend' && (
            <div className="space-y-3" data-testid="occupancy-trend-panel">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16191f]">
                <TrendingUp className="w-4 h-4 text-[#074ce0]" />
                <span>Occupancy Over Time</span>
              </div>
              <OccupancyTrendChart trends={trends} />
            </div>
          )}

          {/* Tab Panel: Detection History */}
          {rightTab === 'history' && (
            <div className="space-y-3" data-testid="detection-history-panel">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16191f]">
                  <History className="w-4 h-4 text-[#074ce0]" />
                  <span>Detection History</span>
                </div>
                <span className="text-[11px] font-mono text-[#454c58]">
                  {history.length} events
                </span>
              </div>

              {history.length === 0 ? (
                <p className="text-[12px] text-[#454c58] py-8 text-center">
                  No detection transitions recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-[#dde0e6] max-h-[380px] overflow-y-auto pr-1">
                  {history.slice(0, 25).map((item) => (
                    <div key={item.id} className="py-2.5 space-y-1 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#16191f]">{item.slotCode}</span>
                        <span className="font-mono text-[11px] text-[#454c58]">
                          {item.timestamp} · <strong className="text-[#074ce0]">{item.source}</strong>
                        </span>
                      </div>
                      <div className="text-[12px] text-[#16191f]">
                        <span className="capitalize text-[#454c58]">{item.previousStatus}</span>
                        <span className="mx-1.5 text-[#074ce0]">→</span>
                        <span
                          className={`capitalize font-semibold ${
                            item.currentStatus === 'occupied'
                              ? 'text-[#dc2626]'
                              : item.currentStatus === 'available'
                              ? 'text-[#16a34a]'
                              : item.currentStatus === 'discrepancy'
                              ? 'text-[#d97706]'
                              : 'text-[#454c58]'
                          }`}
                        >
                          {item.currentStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#454c58] leading-snug">{item.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Panel: Parking Alerts */}
          {rightTab === 'alerts' && (
            <div className="space-y-3" data-testid="parking-alerts-panel">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16191f]">
                  <Bell className="w-4 h-4 text-[#074ce0]" />
                  <span>Parking Alerts</span>
                </div>
                <span className="text-[11px] font-mono text-[#454c58]">
                  {activeAlertsCount} active
                </span>
              </div>

              {alerts.length === 0 ? (
                <p className="text-[12px] text-[#454c58] py-8 text-center">
                  All sensors and camera feeds are in consensus. No active alerts.
                </p>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {alerts.slice(0, 20).map((al) => (
                    <div
                      key={al.id}
                      className={`rounded-[8px] border p-3 text-[12px] space-y-1.5 ${
                        al.acknowledged
                          ? 'border-[#dde0e6] bg-[#fcfcfd] opacity-65'
                          : al.severity === 'critical'
                          ? 'border-[#dc2626]/40 bg-[#dc2626]/5'
                          : al.severity === 'warning'
                          ? 'border-[#d97706]/40 bg-[#d97706]/5'
                          : 'border-[#074ce0]/30 bg-[#074ce0]/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#16191f]">
                          {al.type === 'discrepancy'
                            ? `Discrepancy · ${al.slotCode || 'Bay'}`
                            : al.type === 'capacity'
                            ? 'High Occupancy Alert'
                            : 'Camera Feed Error'}
                        </span>
                        <span className="font-mono text-[11px] text-[#454c58]">{al.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-[#454c58] leading-snug">{al.message}</p>
                      {!al.acknowledged && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledgeAlert(al.id)}
                          className="text-[11px] font-semibold text-[#074ce0] hover:underline"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
