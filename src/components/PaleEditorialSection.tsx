import React from 'react';
import { ShieldCheck, Eye, Cpu, Compass, Activity, Server } from 'lucide-react';

export const PaleEditorialSection: React.FC = () => {
  return (
    <section id="architecture" className="bg-[#f3f4f6] py-16 md:py-20 border-b border-[#dde0e6]">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Heading & Intro */}
        <div className="max-w-3xl space-y-3 mb-12">
          <div className="text-[13px] font-semibold tracking-wider text-[#074ce0] uppercase">
            Problem Context & Architecture
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#16191f]">
            Overcoming the Inherent Flaws of Single-Method Parking Detection
          </h2>
          <p className="text-[16px] text-[#454c58] leading-relaxed">
            Existing smart parking approaches fall into two distinct extremes: high-cost per-slot ultrasonic sensors or weather-vulnerable CCTV streams. Our hybrid framework merges both data streams into an authoritative ground truth.
          </p>
        </div>

        {/* 3-Column Equal Editorial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Card 1 */}
          <div className="rounded-[12px] border border-[#dde0e6] bg-[#ffffff] p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-[8px] bg-[#f3f4f6] flex items-center justify-center text-[#16191f]">
                <Compass className="w-5 h-5 text-[#074ce0]" />
              </div>
              <div>
                <span className="text-[12px] font-bold text-[#454c58] uppercase tracking-wide">Analysis 01</span>
                <h3 className="font-display text-xl font-bold text-[#16191f] mt-1">
                  Urban Congestion & Circling Overhead
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed text-[#454c58]">
                Drivers spend an average of 14 minutes searching for vacant spaces in crowded Indian commercial districts. Lack of advance slot occupancy before facility entry causes severe gate queuing and needless fuel burn.
              </p>
            </div>
            <div className="pt-4 border-t border-[#dde0e6] mt-4 flex items-center justify-between text-[12px] text-[#454c58]">
              <span>Search Overhead</span>
              <span className="font-semibold text-[#16191f]">Up to 30% of downtown traffic</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-[12px] border border-[#dde0e6] bg-[#ffffff] p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-[8px] bg-[#f3f4f6] flex items-center justify-center text-[#16191f]">
                <Cpu className="w-5 h-5 text-[#074ce0]" />
              </div>
              <div>
                <span className="text-[12px] font-bold text-[#454c58] uppercase tracking-wide">Analysis 02</span>
                <h3 className="font-display text-xl font-bold text-[#16191f] mt-1">
                  Sensor-Only Scaling Bottlenecks
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed text-[#454c58]">
                Deploying wired ultrasonic or magnetic sensors under every single bay provides accurate ground readings, but installation and cabling costs scale linearly, making retrofitting multi-acre lots prohibitive.
              </p>
            </div>
            <div className="pt-4 border-t border-[#dde0e6] mt-4 flex items-center justify-between text-[12px] text-[#454c58]">
              <span>Hardware Capital</span>
              <span className="font-semibold text-[#16191f]">High CAPEX across 500+ bays</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-[12px] border border-[#dde0e6] bg-[#ffffff] p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-[8px] bg-[#f3f4f6] flex items-center justify-center text-[#16191f]">
                <Eye className="w-5 h-5 text-[#074ce0]" />
              </div>
              <div>
                <span className="text-[12px] font-bold text-[#454c58] uppercase tracking-wide">Analysis 03</span>
                <h3 className="font-display text-xl font-bold text-[#16191f] mt-1">
                  Vision-Only Occlusion Vulnerabilities
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed text-[#454c58]">
                CCTV with YOLO models covers vast expanses at low marginal cost. However, tall pillars, parked SUVs, headlamp glare, and nighttime shadows induce high false negatives when relied on solely.
              </p>
            </div>
            <div className="pt-4 border-t border-[#dde0e6] mt-4 flex items-center justify-between text-[12px] text-[#454c58]">
              <span>Vision Blindspots</span>
              <span className="font-semibold text-[#16191f]">Occlusion drops accuracy to ~88%</span>
            </div>
          </div>
        </div>

        {/* Heading beside a 2-column list (as prescribed in design system) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-6 border-t border-[#dde0e6]">
          <div className="lg:col-span-4">
            <h3 className="font-display text-2xl font-bold text-[#16191f]">
              Project Objectives & Engineering Scope
            </h3>
            <p className="text-[14px] text-[#454c58] mt-2 leading-relaxed">
              Engineered for municipal commercial garages and urban facilities to eliminate circular parking delays.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[10px] border border-[#dde0e6] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-[#074ce0]" />
                <h4 className="text-[15px] font-bold text-[#16191f]">Hybrid Slot-Level Detection</h4>
              </div>
              <p className="text-[13px] text-[#454c58] leading-relaxed">
                Design a synchronized mechanism combining ultrasonic/IR IoT sensors with CCTV bounding-box detection to offset individual sensor weaknesses.
              </p>
            </div>

            <div className="rounded-[10px] border border-[#dde0e6] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <Server className="w-4 h-4 text-[#074ce0]" />
                <h4 className="text-[15px] font-bold text-[#16191f]">Real-Time Aggregation Backend</h4>
              </div>
              <p className="text-[13px] text-[#454c58] leading-relaxed">
                Develop a resilient Node.js / REST & MQTT backend aggregating multi-source signals and resolving state discrepancies in under 1.2 seconds.
              </p>
            </div>

            <div className="rounded-[10px] border border-[#dde0e6] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <Activity className="w-4 h-4 text-[#074ce0]" />
                <h4 className="text-[15px] font-bold text-[#16191f]">Live User Guidance Dashboard</h4>
              </div>
              <p className="text-[13px] text-[#454c58] leading-relaxed">
                Deploy an accessible web/mobile interface providing drivers with real-time bay availability before entering congested parking zones.
              </p>
            </div>

            <div className="rounded-[10px] border border-[#dde0e6] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <Compass className="w-4 h-4 text-[#074ce0]" />
                <h4 className="text-[15px] font-bold text-[#16191f]">Scalable & Evaluated Architecture</h4>
              </div>
              <p className="text-[13px] text-[#454c58] leading-relaxed">
                Benchmark the hybrid model against sensor-only and vision-only baselines to confirm accuracy improvements and search-time reductions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
