import React, { useState } from 'react';
import { X, Download, FileText, CheckCircle2, Layers, Cpu, Code2, BookOpen } from 'lucide-react';

interface SynopsisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SynopsisModal: React.FC<SynopsisModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'pdf'>('summary');
  if (!isOpen) return null;

  const pdfUrl = '/assets/aistudio/Parking_Detection_Synopsis__1__2ae91f43.pdf';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="synopsis-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[12px] border border-[#dde0e6] shadow-xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dde0e6] bg-[#fcfcfd]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[6px] bg-[#074ce0]/10 flex items-center justify-center text-[#074ce0]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 id="synopsis-modal-title" className="font-display text-[17px] font-bold text-[#16191f]">
                Semester Project Synopsis: Hybrid IoT & Vision Parking Detection
              </h2>
              <p className="text-[12px] text-[#454c58]">
                Software Engineering Lab · Medicaps University, Indore · 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              download="Parking_Detection_Synopsis.pdf"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#074ce0] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#063ec0] transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-[6px] p-1.5 text-[#454c58] hover:bg-[#f3f4f6] hover:text-[#16191f] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch between Synopsis Content & Raw PDF */}
        <div className="px-6 pt-3 border-b border-[#dde0e6] bg-white flex items-center gap-4 text-[13px]">
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-2.5 font-semibold transition-colors border-b-2 ${
              activeTab === 'summary'
                ? 'border-[#074ce0] text-[#074ce0]'
                : 'border-transparent text-[#454c58] hover:text-[#16191f]'
            }`}
          >
            Structured Academic Summary
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`pb-2.5 font-semibold transition-colors border-b-2 ${
              activeTab === 'pdf'
                ? 'border-[#074ce0] text-[#074ce0]'
                : 'border-transparent text-[#454c58] hover:text-[#16191f]'
            }`}
          >
            Direct Document Frame
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* Authors & Institutional Details */}
              <div className="rounded-[10px] bg-[#f3f4f6] p-4 text-[13px] border border-[#dde0e6]">
                <div className="font-bold text-[#16191f] mb-1">
                  Submitted for: Software Engineering Lab — Semester Project (2026)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[#454c58] mt-2">
                  <div><strong>Apurv Jain:</strong> En25CS3090030</div>
                  <div><strong>Abhyansh Sahu:</strong> En25CS3090008</div>
                  <div><strong>Aryan Parashar:</strong> En25CS3090038</div>
                </div>
                <div className="mt-2 text-[12px] text-[#074ce0] font-medium">
                  Department of Computer Science & Engineering · Medicaps University, Indore · Software Engineering Laboratory Project
                </div>
              </div>

              {/* 1. Introduction & Problem Statement */}
              <div className="space-y-2">
                <h3 className="font-display text-[16px] font-bold text-[#16191f]">
                  1. Problem Statement & Motivation
                </h3>
                <p className="text-[14px] text-[#454c58] leading-relaxed">
                  Urban areas across India witness rapid vehicle growth, causing drivers to circle lots searching for vacant slots, leading to wasted fuel, higher emissions, and gate gridlock. Existing single-method approaches fail: sensor-only systems are expensive to install and maintain across large bays; vision-only systems suffer from occlusion, lighting, and camera angle degradation. The hybrid approach combines sensor ground-truth confirmation with economical wide-area camera coverage.
                </p>
              </div>

              {/* 2. Four Architecture Layers */}
              <div className="space-y-3">
                <h3 className="font-display text-[16px] font-bold text-[#16191f]">
                  2. Four-Layer System Architecture
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-[8px] border border-[#dde0e6] p-3">
                    <span className="font-bold text-[#074ce0]">1. Sensing Layer:</span>
                    <p className="text-[#454c58] mt-1">Ultrasonic/IR sensors interfaced with ESP32/Arduino microcontrollers detect physical presence; CCTV cameras capture full lot.</p>
                  </div>
                  <div className="rounded-[8px] border border-[#dde0e6] p-3">
                    <span className="font-bold text-[#074ce0]">2. Processing Layer:</span>
                    <p className="text-[#454c58] mt-1">Sensor telemetry transmitted via MQTT; CCTV frames processed using Python, OpenCV, and YOLOv8 object detection.</p>
                  </div>
                  <div className="rounded-[8px] border border-[#dde0e6] p-3">
                    <span className="font-bold text-[#074ce0]">3. Backend & Storage Layer:</span>
                    <p className="text-[#454c58] mt-1">Node.js server cross-verifies both streams, resolves discrepancies, and persists state in MongoDB/Firebase Realtime DB.</p>
                  </div>
                  <div className="rounded-[8px] border border-[#dde0e6] p-3">
                    <span className="font-bold text-[#074ce0]">4. Presentation Layer:</span>
                    <p className="text-[#454c58] mt-1">Web dashboard (React.js) and driver mobile application (Flutter) display real-time slot occupancy and guidance maps.</p>
                  </div>
                </div>
              </div>

              {/* 3. Tech Stack Table */}
              <div className="space-y-2">
                <h3 className="font-display text-[16px] font-bold text-[#16191f]">
                  3. Proposed Technology Stack
                </h3>
                <div className="overflow-x-auto rounded-[8px] border border-[#dde0e6]">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#f3f4f6] text-[#16191f] font-semibold border-b border-[#dde0e6]">
                      <tr>
                        <th className="py-2.5 px-3">Component</th>
                        <th className="py-2.5 px-3">Technology Specified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dde0e6] text-[#454c58]">
                      <tr>
                        <td className="py-2 px-3 font-medium text-[#16191f]">Sensing Hardware</td>
                        <td className="py-2 px-3">Ultrasonic / IR sensors, ESP32 or Arduino microcontroller</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium text-[#16191f]">Computer Vision</td>
                        <td className="py-2 px-3">Python, OpenCV, YOLO (You Only Look Once v8)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium text-[#16191f]">Backend</td>
                        <td className="py-2 px-3">Node.js / Flask REST API & MQTT Broker</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium text-[#16191f]">Database</td>
                        <td className="py-2 px-3">MongoDB / Firebase Realtime Database</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium text-[#16191f]">Frontend</td>
                        <td className="py-2 px-3">React.js (web dashboard) / Flutter (mobile app)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-medium text-[#16191f]">Communication</td>
                        <td className="py-2 px-3">Wi-Fi / MQTT for low-latency sensor-to-server data transfer</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. References */}
              <div className="space-y-1 text-[12px] text-[#454c58] pt-2 border-t border-[#dde0e6]">
                <div className="font-bold text-[#16191f]">Primary Reference:</div>
                <div>[1] Redmon, J. et al., &quot;You Only Look Once: Unified, Real-Time Object Detection,&quot; IEEE CVPR, 2016.</div>
                <div>[2] OpenCV Documentation — https://docs.opencv.org</div>
              </div>
            </div>
          ) : (
            <div className="w-full h-[520px] rounded-[8px] border border-[#dde0e6] overflow-hidden bg-slate-100">
              <iframe
                src={pdfUrl}
                title="Project Synopsis PDF Viewer"
                className="w-full h-full"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#dde0e6] bg-[#fcfcfd] flex items-center justify-between text-[12px] text-[#454c58]">
          <span>Source: public/assets/aistudio/Parking_Detection_Synopsis__1__2ae91f43.pdf</span>
          <button
            onClick={onClose}
            className="rounded-[6px] border border-[#dde0e6] bg-white px-4 py-1.5 text-[13px] font-medium text-[#16191f] hover:border-[#16191f] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
