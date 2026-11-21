import React from 'react';

interface NavbarProps {
  onOpenSimulator: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSimulator }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#dde0e6] bg-[#fcfcfd]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Brand title (single line, Host Grotesk) */}
        <a
          href="#"
          className="font-display text-lg font-bold tracking-tight text-[#16191f] whitespace-nowrap shrink-0 hover:text-[#074ce0] transition-colors"
        >
          Hybrid Parking AI
        </a>

        {/* Zone 2: Clean single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-[15px] font-medium text-[#454c58]">
          <a
            href="#overview"
            className="whitespace-nowrap shrink-0 hover:text-[#16191f] transition-colors"
          >
            Overview
          </a>
          <a
            href="#architecture"
            className="whitespace-nowrap shrink-0 hover:text-[#16191f] transition-colors"
          >
            Architecture
          </a>
          <a
            href="#process"
            className="whitespace-nowrap shrink-0 hover:text-[#16191f] transition-colors"
          >
            Workflow
          </a>
          <a
            href="#camera-detection"
            className="whitespace-nowrap shrink-0 hover:text-[#16191f] transition-colors"
          >
            Camera Detection
          </a>
          <a
            href="#live-dashboard"
            className="whitespace-nowrap shrink-0 text-[#074ce0] font-semibold hover:text-[#063ec0] transition-colors"
          >
            Live Dashboard
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenSimulator}
            className="inline-flex items-center justify-center rounded-[8px] bg-[#074ce0] px-4 py-2 text-[14px] font-medium text-white shadow-xs transition-transform duration-160 ease-out hover:-translate-y-0.5 hover:bg-[#063ec0] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#074ce0] whitespace-nowrap shrink-0"
          >
            Launch Simulator
          </button>
        </div>
      </div>
    </header>
  );
};
