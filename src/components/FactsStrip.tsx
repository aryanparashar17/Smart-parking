import React from 'react';

export const FactsStrip: React.FC = () => {
  return (
    <div className="border-y border-[#dde0e6] bg-[#ffffff]">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-[#dde0e6]">
          <div className="pt-2 md:pt-0">
            <div className="text-[12px] font-medium text-[#454c58] tracking-wide uppercase">Core Architecture</div>
            <div className="font-display text-2xl font-bold text-[#16191f] mt-1">Dual-Source Fusion</div>
            <p className="text-[13px] text-[#454c58] mt-0.5">Ultrasonic IoT telemetry & YOLO vision</p>
          </div>

          <div className="pt-4 md:pt-0 md:pl-8">
            <div className="text-[12px] font-medium text-[#454c58] tracking-wide uppercase">Detection Reliability</div>
            <div className="font-display text-2xl font-bold text-[#074ce0] mt-1 tabular-nums">99.4% Dual-Fused</div>
            <p className="text-[13px] text-[#454c58] mt-0.5">Eliminates camera occlusion failures</p>
          </div>

          <div className="pt-4 md:pt-0 md:pl-8">
            <div className="text-[12px] font-medium text-[#454c58] tracking-wide uppercase">End-to-End Latency</div>
            <div className="font-display text-2xl font-bold text-[#16191f] mt-1 tabular-nums">&lt; 1.2s Sync</div>
            <p className="text-[13px] text-[#454c58] mt-0.5">Ultra-low MQTT to dashboard propagation</p>
          </div>

          <div className="pt-4 md:pt-0 md:pl-8">
            <div className="text-[12px] font-medium text-[#454c58] tracking-wide uppercase">Architectural Layers</div>
            <div className="font-display text-2xl font-bold text-[#16191f] mt-1">4 Decoupled Tiers</div>
            <p className="text-[13px] text-[#454c58] mt-0.5">Sensing, Vision, Storage, App</p>
          </div>
        </div>
      </div>
    </div>
  );
};
