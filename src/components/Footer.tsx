import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#121419] text-[#d0d4dd] py-12 border-t border-[#232832]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Group 1 */}
          <div className="space-y-3">
            <span className="font-display text-[15px] font-bold text-[#fcfcfd]">
              Hybrid Parking AI
            </span>
            <p className="text-[13px] text-[#d0d4dd]/80 leading-relaxed">
              Software Engineering Lab Semester Project, Medicaps University, Indore. High-reliability dual IoT and Computer Vision parking intelligence platform.
            </p>
          </div>

          {/* Group 2 */}
          <div className="space-y-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#fcfcfd]">
              System Navigation
            </span>
            <ul className="space-y-1.5 text-[13px]">
              <li><a href="#overview" className="hover:text-white transition-colors">Overview</a></li>
              <li><a href="#architecture" className="hover:text-white transition-colors">Architecture</a></li>
              <li><a href="#process" className="hover:text-white transition-colors">Workflow Pipeline</a></li>
              <li><a href="#camera-detection" className="hover:text-white transition-colors">Camera Detection</a></li>
              <li><a href="#live-dashboard" className="text-[#074ce0] font-semibold hover:text-white transition-colors">Live Dashboard</a></li>
            </ul>
          </div>

          {/* Group 3 */}
          <div className="space-y-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#fcfcfd]">
              Technical Stack
            </span>
            <ul className="space-y-1.5 text-[13px]">
              <li>
                <span className="text-[#d0d4dd]/90">ESP32 & Ultrasonic Sensors</span>
              </li>
              <li>
                <span className="text-[#d0d4dd]/90">YOLO Object Detection</span>
              </li>
              <li>
                <span className="text-[#d0d4dd]/90">MQTT & WebSocket Sync</span>
              </li>
              <li>
                <span className="text-[#d0d4dd]/90">Dual Arbitration Engine</span>
              </li>
            </ul>
          </div>

          {/* Group 4 */}
          <div className="space-y-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#fcfcfd]">
              Project Authors
            </span>
            <ul className="space-y-1 text-[13px]">
              <li>Apurv Jain (En25CS3090030)</li>
              <li>Abhyansh Sahu (En25CS3090008)</li>
              <li>Aryan Parashar (En25CS3090038)</li>
              <li className="pt-1 text-[12px] text-[#074ce0]">Medicaps University, Indore</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-[#232832] flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#d0d4dd]/60 gap-4">
          <div>
            © 2026 Department of Computer Science & Engineering, Medicaps University. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#d0d4dd]/80 font-mono text-[11px]">Real-Time Dual Arbitration System</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
