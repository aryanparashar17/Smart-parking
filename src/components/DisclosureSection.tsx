import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export const DisclosureSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the backend arbitration engine resolve discrepancies between camera and sensor?',
      a: 'When an ultrasonic/IR sensor detects an object (<100cm) while the camera model reports an empty slot (often caused by support pillars, shadow occlusions, or vehicle roofs blending into asphalt), the backend weights the physical slot ground-truth higher. Conversely, if high-confidence visual bounding boxes (>88%) detect a car whose sensor failed to ping, the system flags the slot for visual occupancy while scheduling a diagnostic sensor recalibration.'
    },
    {
      q: 'What hardware components compose the slot-level Sensing Layer?',
      a: 'The sensing layer utilizes HC-SR04 ultrasonic range finders or reflective infrared modules coupled to low-power ESP32 microcontrollers. The ESP32 collects distance metrics and transmits lightweight MQTT telemetry packets over standard 2.4GHz Wi-Fi directly to the central server, consuming minimal power.'
    },
    {
      q: 'Why pair YOLO-based computer vision with OpenCV rather than standard background subtraction?',
      a: 'Traditional frame differencing and background subtraction fail dramatically under changing weather, rain glare, windblown debris, and headlights. YOLO (You Only Look Once) executes real-time convolutional object detection trained on vehicle classifications (cars, SUVs, motorcycles) regardless of ambient lighting angles.'
    },
    {
      q: 'How does this project address municipal and commercial parking scalability?',
      a: 'This architecture addresses the demand for cost-effective, scalable, and reliable real-time vacant parking slot identification to eradicate urban traffic gridlocks before entry gates. Our prototype demonstrates that pairing economical IoT nodes with standard security CCTV cameras delivers 99.4% accuracy at 60% lower infrastructure investment than full wired sensor arrays.'
    },
    {
      q: 'What is the projected deployment scope across multi-level commercial lots?',
      a: 'As outlined in Section 8 of the synopsis, the architecture is intrinsically modular. Scaling from a 12-bay testing lot to a 500-bay multi-tier garage simply requires configuring additional ESP32 mesh nodes across floor zones and mapping existing IP camera RTSP stream coordinates into the OpenCV region-of-interest grid.'
    }
  ];

  return (
    <section className="bg-[#fcfcfd] py-16 md:py-20 border-b border-[#dde0e6]">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-10 text-center space-y-2">
          <div className="text-[13px] font-semibold tracking-wider text-[#074ce0] uppercase">
            Technical Architecture Q&A
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-[#16191f]">
            Frequently Addressed Implementation Details
          </h2>
          <p className="text-[15px] text-[#454c58]">
            Detailed rationale covering hardware selection, fusion algorithms, and scalability.
          </p>
        </div>

        {/* Native disclosures with ruled rows and rotating plus */}
        <div className="divide-y divide-[#dde0e6] border-y border-[#dde0e6]">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="py-5">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between text-left text-[17px] font-bold text-[#16191f] hover:text-[#074ce0] transition-colors focus-visible:outline-2 focus-visible:outline-[#074ce0]"
                >
                  <span className="pr-6">{faq.q}</span>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#16191f] transition-transform duration-160 ease-out ${
                      isOpen ? 'rotate-45 bg-[#074ce0] text-white' : ''
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="pt-3 pr-8 text-[15px] leading-relaxed text-[#454c58] transition-opacity duration-160 ease-out">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
