import React from 'react';
import { Layers, Cpu, Camera, CheckCircle2, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onScrollToLiveLot: () => void;
  onScrollToArchitecture: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToLiveLot, onScrollToArchitecture }) => {
  return (
    <section id="overview" className="relative pt-12 pb-16 md:pt-16 md:pb-20">
      <div className="mx-auto max-w-7xl px-6">
        {/* 1.45:1 Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Wide text column (span 7 on 12-col grid => ~1.4:1 ratio) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-[13px] font-medium text-[#454c58]">
              <span className="font-semibold text-[#074ce0]">Smart Urban Mobility</span>
              <span aria-hidden="true">·</span>
              <span>Dual-Source Fusion Engine</span>
              <span aria-hidden="true">·</span>
              <span>IoT & Computer Vision</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-[#16191f] leading-[1.08] text-balance">
              Hybrid IoT and Vision-Based System for Real-Time Empty Parking Slot Detection
            </h1>

            <p className="text-[17px] sm:text-[18px] leading-[1.65] text-[#454c58] max-w-2xl">
              Eliminate circular parking congestion and vehicle idling across urban facilities. By fusing slot-level ultrasonic/IR physical ground-truth with wide-angle YOLO computer-vision telemetry, our dual-arbitration engine guarantees 99.4% detection reliability under extreme lighting, occlusions, and rapid turnover.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onScrollToLiveLot}
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#074ce0] px-5 py-2.5 text-[15px] font-semibold text-white shadow-xs transition-transform duration-160 ease-out hover:-translate-y-0.5 hover:bg-[#063ec0] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#074ce0]"
              >
                Launch Live Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onScrollToArchitecture}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[#dde0e6] bg-white px-5 py-2.5 text-[15px] font-medium text-[#16191f] shadow-xs transition-all duration-160 ease-out hover:-translate-y-0.5 hover:border-[#16191f] hover:bg-[#fcfcfd] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#074ce0]"
              >
                <span>Explore Architecture</span>
              </button>
            </div>

            <div className="pt-2 flex items-center gap-6 text-[13px] text-[#454c58]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#074ce0]" />
                <span>Zero blind-spot occlusion</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#074ce0]" />
                <span>Sub-1.2s ESP32 MQTT sync</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#074ce0]" />
                <span>Scalable across multi-tier bays</span>
              </div>
            </div>
          </div>

          {/* Compact Product Diagram (span 5 => convergent architecture diagram) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[460px] rounded-[16px] border border-[#dde0e6] bg-[#ffffff] p-6 shadow-sm overflow-hidden">
              {/* Subtle radial orbit backdrop */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                <div className="w-64 h-64 rounded-full border border-dashed border-[#dde0e6]" />
                <div className="absolute w-44 h-44 rounded-full border border-[#dde0e6]" />
              </div>

              <div className="relative z-10 flex flex-col items-center gap-6">
                {/* Inputs Row (Converging Inputs) */}
                <div className="grid grid-cols-2 gap-4 w-full">
                  {/* Input 1: IoT Sensors */}
                  <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold tracking-wider text-[#454c58] uppercase">Input Stream 1</span>
                      <Cpu className="w-3.5 h-3.5 text-[#074ce0]" />
                    </div>
                    <div className="text-[14px] font-bold text-[#16191f]">IoT Microcontroller</div>
                    <div className="text-[12px] text-[#454c58]">ESP32 · Ultrasonic / IR</div>
                    <div className="mt-2 text-[11px] text-[#074ce0] font-mono tabular-nums">45cm distance | 98% bat</div>
                  </div>

                  {/* Input 2: CCTV Streams */}
                  <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3.5 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold tracking-wider text-[#454c58] uppercase">Input Stream 2</span>
                      <Camera className="w-3.5 h-3.5 text-[#074ce0]" />
                    </div>
                    <div className="text-[14px] font-bold text-[#16191f]">CCTV Vision Stream</div>
                    <div className="text-[12px] text-[#454c58]">OpenCV · YOLOv8 Inference</div>
                    <div className="mt-2 text-[11px] text-[#074ce0] font-mono tabular-nums">1080p feed | 0.94 conf</div>
                  </div>
                </div>

                {/* Converging connecting lines */}
                <div className="flex flex-col items-center justify-center w-full my-[-6px]">
                  <div className="w-px h-6 bg-[#dde0e6]" />
                  <div className="w-2 h-2 rounded-full bg-[#074ce0]" />
                </div>

                {/* Central Product: Hybrid Fusion Engine */}
                <div className="w-full rounded-[12px] bg-gradient-to-b from-[#074ce0] to-[#053ab5] p-5 text-white shadow-md text-center">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase mb-2">
                    <Layers className="w-3 h-3" />
                    Layer 3: Fusion & Arbitration
                  </div>
                  <h3 className="font-display text-[17px] font-bold tracking-tight">
                    Dual-Source Arbitration Engine
                  </h3>
                  <p className="text-[12px] text-white/80 mt-1 max-w-xs mx-auto">
                    Resolves glare, physical blind spots, and temporary obstructions in &lt;1.2s.
                  </p>
                </div>

                {/* Downward connecting branch */}
                <div className="flex flex-col items-center justify-center w-full my-[-6px]">
                  <div className="w-px h-6 bg-[#dde0e6]" />
                  <div className="w-2 h-2 rounded-full bg-[#074ce0]" />
                </div>

                {/* Output Row: Small White Tiles */}
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3 text-center shadow-xs">
                    <div className="text-[11px] font-medium text-[#454c58]">Central Storage</div>
                    <div className="text-[13px] font-bold text-[#16191f] mt-0.5">Realtime DB</div>
                    <div className="text-[11px] text-[#074ce0] font-mono mt-1">MongoDB / Firebase</div>
                  </div>

                  <div className="rounded-[10px] border border-[#dde0e6] bg-white p-3 text-center shadow-xs">
                    <div className="text-[11px] font-medium text-[#454c58]">Presentation</div>
                    <div className="text-[13px] font-bold text-[#16191f] mt-0.5">Driver App & Map</div>
                    <div className="text-[11px] text-[#074ce0] font-mono mt-1">Live Occupancy Map</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
