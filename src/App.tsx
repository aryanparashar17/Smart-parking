/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { FactsStrip } from './components/FactsStrip';
import { PaleEditorialSection } from './components/PaleEditorialSection';
import { DarkProcessSection } from './components/DarkProcessSection';
import { LiveSimulatorSection } from './components/LiveSimulatorSection';
import { Footer } from './components/Footer';

export default function App() {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-[#16191f] flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar
        onOpenSimulator={() => scrollToSection('live-dashboard')}
      />

      <main className="flex-1">
        {/* Overview of the Idea (1.45:1 split & Converging Product Diagram) */}
        <HeroSection
          onScrollToLiveLot={() => scrollToSection('live-dashboard')}
          onScrollToArchitecture={() => scrollToSection('architecture')}
        />

        {/* Ruled Strip with Supporting Real Facts */}
        <FactsStrip />

        {/* Pale-grey Field: Architecture & Objectives */}
        <PaleEditorialSection />

        {/* Continuous Dark Field: Workflow & Pipeline */}
        <DarkProcessSection />

        {/* Live Parking Facility Dashboard & Simulation */}
        <LiveSimulatorSection />
      </main>

      {/* Dark Footer */}
      <Footer />
    </div>
  );
}

