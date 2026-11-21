import React, { useState } from 'react';
import type { OccupancyTrendPoint } from '../utils/cameraTypes';

interface OccupancyTrendChartProps {
  trends: OccupancyTrendPoint[];
}

export const OccupancyTrendChart: React.FC<OccupancyTrendChartProps> = ({ trends }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!trends || trends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[240px] text-center px-4">
        <p className="text-[14px] font-medium text-[#16191f]">No occupancy trend recorded yet</p>
        <p className="text-[12px] text-[#454c58] mt-1">
          Analyze a camera feed or uploaded lot image to plot occupancy over time.
        </p>
      </div>
    );
  }

  const width = 420;
  const height = 220;
  const padLeft = 38;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = trends.map((pt, idx) => {
    const x =
      trends.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (trends.length - 1)) * plotW;
    const clampedPct = Math.max(0, Math.min(100, pt.occupancyPct));
    const y = padTop + plotH - (clampedPct / 100) * plotH;
    return { x, y, data: pt };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="space-y-3">
      {/* Header summary of hovered or latest point */}
      <div className="flex items-baseline justify-between text-[12px] border-b border-[#dde0e6] pb-2.5">
        <div>
          <span className="text-[#454c58]">{activePoint.data.source}</span>
          <span className="mx-1.5 text-[#dde0e6]">·</span>
          <span className="font-mono tabular-nums text-[#454c58]">{activePoint.data.timeLabel}</span>
        </div>
        <div className="font-mono tabular-nums font-bold text-[#074ce0]">
          {activePoint.data.occupancyPct}% ({activePoint.data.occupied}/{activePoint.data.total})
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="Parking occupancy percentage over time graph"
        >
          <defs>
            <linearGradient id="occupancyAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#074ce0" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#074ce0" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y Labels */}
          {yTicks.map((tick) => {
            const y = padTop + plotH - (tick / 100) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#dde0e6"
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#454c58"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#occupancyAreaFill)" />}

          {/* Main Trend Line */}
          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#074ce0"
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Interactive Data Points */}
          {points.map((pt, idx) => {
            const isHighlighted =
              hoveredIdx === idx || (hoveredIdx === null && idx === points.length - 1);
            return (
              <g
                key={pt.data.id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHighlighted ? 4.5 : 3}
                  fill={isHighlighted ? '#074ce0' : '#ffffff'}
                  stroke="#074ce0"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* X-axis Start / Mid / End Labels */}
          {points.length >= 1 && (
            <text
              x={points[0].x}
              y={height - 8}
              textAnchor={points.length === 1 ? 'middle' : 'start'}
              fill="#454c58"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
            >
              {points[0].data.timeLabel}
            </text>
          )}
          {points.length >= 3 && (
            <text
              x={points[Math.floor(points.length / 2)].x}
              y={height - 8}
              textAnchor="middle"
              fill="#454c58"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
            >
              {points[Math.floor(points.length / 2)].data.timeLabel}
            </text>
          )}
          {points.length >= 2 && (
            <text
              x={points[points.length - 1].x}
              y={height - 8}
              textAnchor="end"
              fill="#454c58"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
            >
              {points[points.length - 1].data.timeLabel}
            </text>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#454c58] pt-1">
        <span>{trends.length} measurement{trends.length === 1 ? '' : 's'} logged</span>
        <span className="font-mono tabular-nums">
          Peak: {Math.max(...trends.map((t) => t.occupancyPct))}%
        </span>
      </div>
    </div>
  );
};
