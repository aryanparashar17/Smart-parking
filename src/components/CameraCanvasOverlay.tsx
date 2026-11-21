import React, { useRef } from 'react';
import type {
  DetectedVehicle,
  NormalizedPoint,
  ParkingSpacePolygon,
  SpaceDetectionResult,
} from '../utils/cameraTypes';

interface CameraCanvasOverlayProps {
  mode: 'image' | 'webcam';
  imageSrc: string | null;
  imageAlt: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  webcamActive?: boolean;
  spaces: ParkingSpacePolygon[];
  spaceResults?: SpaceDetectionResult[];
  vehicles?: DetectedVehicle[];
  discrepancySlots?: string[];
  showVehicleBoxes: boolean;
  calibrating: boolean;
  draftPoints: NormalizedPoint[];
  onAddCalibrationPoint?: (pt: NormalizedPoint) => void;
  onImageError?: () => void;
  isAnalyzing?: boolean;
}

function getPolygonCentroid(points: NormalizedPoint[]): NormalizedPoint {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

export const CameraCanvasOverlay: React.FC<CameraCanvasOverlayProps> = ({
  mode,
  imageSrc,
  imageAlt,
  videoRef,
  webcamActive,
  spaces,
  spaceResults,
  vehicles = [],
  discrepancySlots = [],
  showVehicleBoxes,
  calibrating,
  draftPoints,
  onAddCalibrationPoint,
  onImageError,
  isAnalyzing = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const resultBySlot = new Map<string, SpaceDetectionResult>();
  if (spaceResults) {
    for (const r of spaceResults) {
      resultBySlot.set(r.slotCode, r);
    }
  }

  const handleSurfaceClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!calibrating || !onAddCalibrationPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onAddCalibrationPoint({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
  };

  const hasMedia =
    (mode === 'image' && Boolean(imageSrc)) || (mode === 'webcam' && Boolean(webcamActive));

  return (
    <div
      ref={containerRef}
      data-testid="camera-preview-canvas"
      className="relative w-full rounded-[10px] overflow-hidden border border-[#dde0e6] bg-[#16191f] min-h-[340px] flex items-center justify-center"
    >
      {mode === 'webcam' ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-auto block ${webcamActive ? 'opacity-100' : 'hidden'}`}
        />
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          referrerPolicy="no-referrer"
          onError={onImageError}
          className="w-full h-auto block select-none"
        />
      ) : null}

      {!hasMedia && (
        <div className="px-6 py-16 text-center text-[#d0d4dd] max-w-md">
          <p className="text-[15px] font-semibold text-[#fcfcfd]">
            {mode === 'webcam'
              ? 'Webcam feed is inactive'
              : 'No parking lot image loaded yet'}
          </p>
          <p className="text-[13px] text-[#d0d4dd]/80 mt-1.5 leading-relaxed">
            {mode === 'webcam'
              ? 'Click "Start Camera" above to request browser camera permission and begin live slot monitoring.'
              : 'Upload a JPG or PNG parking lot photo or select a configured camera feed to run YOLOv8 detection.'}
          </p>
        </div>
      )}

      {/* Vector Overlay for Parking Polygons, Slot Labels, Vehicle BBoxes, and Calibration Draft */}
      {hasMedia && (
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          onClick={handleSurfaceClick}
          className={`absolute inset-0 w-full h-full ${
            calibrating ? 'cursor-crosshair' : 'pointer-events-none'
          }`}
          aria-label={
            calibrating
              ? 'Calibration canvas: click 4 corners to mark a parking space'
              : 'Detected parking spaces and vehicles overlay'
          }
        >
          {/* 1. Parking Space Polygons (GREEN = Available, RED = Occupied, BLUE = Unanalyzed) */}
          {spaces.map((space) => {
            const res = resultBySlot.get(space.slotCode);
            const isDiscrepancy = discrepancySlots.includes(space.slotCode);
            const pointsAttr = space.points
              .map((p) => `${(p.x * 1000).toFixed(1)},${(p.y * 1000).toFixed(1)}`)
              .join(' ');
            const centroid = getPolygonCentroid(space.points);

            let strokeColor = '#38bdf8';
            let fillColor = 'rgba(7, 76, 224, 0.14)';
            let labelBg = '#074ce0';

            if (res) {
              if (res.status === 'occupied') {
                strokeColor = '#dc2626';
                fillColor = 'rgba(220, 38, 38, 0.25)';
                labelBg = '#dc2626';
              } else {
                strokeColor = '#16a34a';
                fillColor = 'rgba(22, 163, 74, 0.22)';
                labelBg = '#16a34a';
              }
            }

            return (
              <g key={space.id}>
                <polygon
                  points={pointsAttr}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="3.5"
                  vectorEffect="non-scaling-stroke"
                />
                {isDiscrepancy && (
                  <polygon
                    points={pointsAttr}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {/* Crisp Slot ID Label */}
                <g transform={`translate(${(centroid.x * 1000).toFixed(1)}, ${(centroid.y * 1000).toFixed(1)})`}>
                  <rect
                    x="-34"
                    y="-15"
                    width="68"
                    height="30"
                    rx="5"
                    fill={labelBg}
                    fillOpacity="0.92"
                  />
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="16"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {space.slotCode}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 2. Detected Vehicle Bounding Boxes (YOLO) */}
          {showVehicleBoxes &&
            vehicles.map((veh) => {
              const x = veh.bbox.x1 * 1000;
              const y = veh.bbox.y1 * 1000;
              const w = Math.max(4, (veh.bbox.x2 - veh.bbox.x1) * 1000);
              const h = Math.max(4, (veh.bbox.y2 - veh.bbox.y1) * 1000);
              const labelText = `${veh.label} ${Math.round(veh.confidence * 100)}%`;

              return (
                <g key={veh.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="2.2"
                    strokeDasharray="6 3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={x}
                    y={Math.max(0, y - 24)}
                    width={Math.max(76, labelText.length * 9.5)}
                    height="22"
                    rx="3"
                    fill="#16191f"
                    fillOpacity="0.88"
                  />
                  <text
                    x={x + 6}
                    y={Math.max(15, y - 8)}
                    fill="#facc15"
                    fontSize="14"
                    fontWeight="600"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}

          {/* 3. Active Calibration Draft Polygon */}
          {calibrating && draftPoints.length > 0 && (
            <g>
              <polyline
                points={draftPoints
                  .map((p) => `${(p.x * 1000).toFixed(1)},${(p.y * 1000).toFixed(1)}`)
                  .join(' ')}
                fill="rgba(7, 76, 224, 0.2)"
                stroke="#074ce0"
                strokeWidth="3"
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
              {draftPoints.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x * 1000}
                  cy={pt.y * 1000}
                  r="7"
                  fill="#ffffff"
                  stroke="#074ce0"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}
        </svg>
      )}

      {/* Analyzing scrim overlay */}
      {isAnalyzing && (
        <div className="absolute inset-0 bg-[#16191f]/55 backdrop-blur-[1px] flex items-center justify-center">
          <div className="rounded-[8px] bg-[#16191f] border border-white/15 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm">
            Running YOLOv8 vehicle & space detection…
          </div>
        </div>
      )}
    </div>
  );
};
