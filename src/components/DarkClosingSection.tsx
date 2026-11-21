import React from 'react';
import { Calendar, User, FileText, ArrowRight, Download } from 'lucide-react';

interface DarkClosingSectionProps {
  onOpenPdf: () => void;
  onOpenSimulator: () => void;
}

export const DarkClosingSection: React.FC<DarkClosingSectionProps> = ({
  onOpenPdf,
  onOpenSimulator
}) => {
  const teamMembers = [
    { name: 'Apurv Jain', en: 'En25CS3090030', role: 'IoT Sensing & ESP32 Firmware' },
    { name: 'Abhyansh Sahu', en: 'En25CS3090008', role: 'Computer Vision & YOLO Inference' },
    { name: 'Aryan Parashar', en: 'En25CS3090038', role: 'Backend Fusion & Web Dashboard' }
  ];

  const timelinePhases = [
    { phase: 'Weeks 1–2', label: 'Requirement Analysis & Dataset', status: 'Completed' },
    { phase: 'Weeks 3–5', label: 'Circuit Prototyping & YOLO Training', status: 'Completed' },
    { phase: 'Weeks 6–7', label: 'Backend & DB Arbitration Integration', status: 'Completed' },
    { phase: 'Weeks 8–9', label: 'Dashboard UI & Field Testing', status: 'Active' },
    { phase: 'Week 10', label: 'Benchmarking & Final Defense', status: 'Upcoming' }
  ];

  return (
    <section className="bg-[#16191f] text-[#fcfcfd] py-16 md:py-24 border-t border-[#2b313d]">
      <div className="mx-auto max-w-7xl px-6">
        {/* Callout Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center pb-16 border-b border-[#2b313d]">
          <div className="lg:col-span-8 space-y-4">
            <span className="text-[12px] font-semibold tracking-wider text-[#074ce0] uppercase">
              Semester Project & Academic Defense
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#fcfcfd]">
              Engineered for Real-World Smart City Deployment
            </h2>
            <p className="text-[16px] text-[#d0d4dd] max-w-2xl leading-relaxed">
              Developed under the Department of Computer Science & Engineering at Medicaps University, Indore. Ready for full-scale municipal pilot integration.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
            <button
              onClick={onOpenSimulator}
              className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#074ce0] px-5 py-3 text-[14px] font-semibold text-white shadow-xs transition-transform duration-160 ease-out hover:-translate-y-0.5 hover:bg-[#063ec0] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-[#074ce0]"
            >
              <span>Test Live Simulator</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenPdf}
              className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#2b313d] bg-[#1d222b] px-5 py-3 text-[14px] font-medium text-[#fcfcfd] shadow-xs hover:border-[#fcfcfd] transition-all duration-160 ease-out hover:-translate-y-0.5"
            >
              <FileText className="w-4 h-4 text-[#074ce0]" />
              <span>Inspect Project Synopsis (PDF)</span>
            </button>
          </div>
        </div>

        {/* Project Team & Timeline Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-16">
          {/* Team column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#fcfcfd] uppercase tracking-wider">
              <User className="w-4 h-4 text-[#074ce0]" />
              <span>Project Investigators & Authors</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {teamMembers.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-[10px] border border-[#2b313d] bg-[#1d222b] p-4 flex flex-col justify-between"
                >
                  <div>
                    <h4 className="font-display text-[16px] font-bold text-[#fcfcfd]">{m.name}</h4>
                    <p className="text-[12px] font-mono text-[#074ce0] mt-0.5">{m.en}</p>
                  </div>
                  <p className="text-[12px] text-[#d0d4dd] mt-4 border-t border-[#2b313d] pt-2">
                    {m.role}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[10px] border border-[#2b313d] bg-[#1d222b] p-4 text-[13px] text-[#d0d4dd]">
              <strong>Department of Computer Science & Engineering</strong> · Medicaps University, Indore (2026) · Course: Software Engineering Lab.
            </div>
          </div>

          {/* Timeline column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#fcfcfd] uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-[#074ce0]" />
              <span>10-Week Engineering Roadmap</span>
            </div>

            <div className="space-y-2.5">
              {timelinePhases.map((phase, pIdx) => (
                <div
                  key={pIdx}
                  className="flex items-center justify-between rounded-[8px] border border-[#2b313d] bg-[#1d222b] px-4 py-2.5 text-[13px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#074ce0] font-semibold whitespace-nowrap">
                      {phase.phase}
                    </span>
                    <span className="text-[#fcfcfd] font-medium">{phase.label}</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded ${
                      phase.status === 'Completed'
                        ? 'bg-[#074ce0]/20 text-[#074ce0] border border-[#074ce0]/40'
                        : phase.status === 'Active'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-white/5 text-[#d0d4dd]'
                    }`}
                  >
                    {phase.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
