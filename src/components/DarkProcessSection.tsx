import React from 'react';
import { ArrowRight, Zap, Database, MonitorCheck, Radio, ShieldCheck } from 'lucide-react';

export const DarkProcessSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Data Capture',
      desc: 'Simultaneous capture: ESP32 reads ultrasonic distances while 1080p CCTV frames stream to the vision node.',
      badge: 'Sensors + Cameras'
    },
    {
      num: '02',
      title: 'Sensor & Image Fusion',
      desc: 'Cross-verification engine compares bounding box coordinates against physical sensor thresholds.',
      badge: 'Arbitration'
    },
    {
      num: '03',
      title: 'Status Classification',
      desc: 'Autonomous classification of each slot into Available, Occupied, Reserved, or Flagged states.',
      badge: '99.4% Precision'
    },
    {
      num: '04',
      title: 'Database Synchronization',
      desc: 'Instant state persistence into Realtime Database via low-overhead MQTT payloads.',
      badge: 'Sub-100ms Write'
    },
    {
      num: '05',
      title: 'Driver Notification',
      desc: 'Real-time occupancy maps update immediately on drivers’ mobile apps and entry-gate display totems.',
      badge: 'Zero Circling'
    }
  ];

  return (
    <section id="process" className="bg-[#16191f] text-[#fcfcfd] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="max-w-3xl space-y-3 mb-16">
          <div className="text-[13px] font-semibold tracking-wider text-[#074ce0] uppercase">
            End-to-End Workflow & Pipeline
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#fcfcfd]">
            Five Synchronized Stages from Slot Edge to Driver Interface
          </h2>
          <p className="text-[16px] text-[#d0d4dd] leading-relaxed">
            The hybrid detection pipeline runs continuously, resolving temporal sensor noise and camera occlusions through automated multi-layer cross-verification.
          </p>
        </div>

        {/* Numbered process steps linked across a row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative mb-16">
          {steps.map((step, idx) => (
            <div
              key={step.num}
              className="relative flex flex-col justify-between rounded-[12px] border border-[#2b313d] bg-[#1d222b] p-5 transition-all duration-160 hover:border-[#074ce0]/60"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-2xl font-bold text-[#074ce0] tabular-nums">
                    {step.num}
                  </span>
                  <span className="text-[11px] font-mono text-[#d0d4dd] bg-[#16191f] px-2 py-0.5 rounded border border-[#2b313d]">
                    {step.badge}
                  </span>
                </div>
                <h3 className="font-display text-[16px] font-bold text-[#fcfcfd] mb-2">
                  {step.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-[#d0d4dd]">
                  {step.desc}
                </p>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-[#16191f] border border-[#2b313d] items-center justify-center text-[#d0d4dd]">
                  <ArrowRight className="w-3 h-3 text-[#074ce0]" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Supporting Benefits Grid on Dark Field */}
        <div className="border-t border-[#2b313d] pt-12">
          <div className="text-[13px] font-semibold tracking-wider text-[#074ce0] uppercase mb-6">
            Supporting Architectural Benefits
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-[12px] border border-[#2b313d] bg-[#1d222b] p-6">
              <div className="w-9 h-9 rounded-[8px] bg-[#16191f] flex items-center justify-center text-[#074ce0] mb-3">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-display text-[17px] font-bold text-[#fcfcfd]">
                Search Time Cut by 78%
              </h4>
              <p className="text-[13px] text-[#d0d4dd] mt-2 leading-relaxed">
                By notifying incoming motorists of exact vacant bay positions prior to lot entry, cruising times drop from 14+ minutes to under 2 minutes.
              </p>
            </div>

            <div className="rounded-[12px] border border-[#2b313d] bg-[#1d222b] p-6">
              <div className="w-9 h-9 rounded-[8px] bg-[#16191f] flex items-center justify-center text-[#074ce0] mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-display text-[17px] font-bold text-[#fcfcfd]">
                Zero Single-Point Failure
              </h4>
              <p className="text-[13px] text-[#d0d4dd] mt-2 leading-relaxed">
                If an IoT battery runs low or an individual sensor fails, wide-view cameras provide backup coverage. If camera visibility drops from dust or glare, sensors sustain accuracy.
              </p>
            </div>

            <div className="rounded-[12px] border border-[#2b313d] bg-[#1d222b] p-6">
              <div className="w-9 h-9 rounded-[8px] bg-[#16191f] flex items-center justify-center text-[#074ce0] mb-3">
                <Radio className="w-5 h-5" />
              </div>
              <h4 className="font-display text-[17px] font-bold text-[#fcfcfd]">
                Modular Multi-Floor Expansion
              </h4>
              <p className="text-[13px] text-[#d0d4dd] mt-2 leading-relaxed">
                Designed to scale from small pilot lots to multi-level commercial ramps simply by registering additional ESP32 wireless nodes and IP RTSP camera streams.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
