import React, { useState } from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<'hybrid' | 'sensor' | 'vision'>('hybrid');

  const plans = [
    {
      id: 'sensor' as const,
      name: 'Sensor-Only Setup',
      subtitle: 'Ultrasonic / IR per slot',
      estimatedCost: '₹3,800',
      costUnit: 'per slot hardware & cabling',
      accuracy: '91.2%',
      isFeatured: false,
      features: [
        { label: 'Slot ground-truth confirmation', supported: true },
        { label: 'Immunity to camera occlusion', supported: true },
        { label: 'Low cabling & maintenance overhead', supported: false },
        { label: 'Vehicle type & plate recognition', supported: false },
        { label: 'Cost-effective for 500+ car bays', supported: false },
        { label: 'Lighting/glare independence', supported: true }
      ]
    },
    {
      id: 'vision' as const,
      name: 'Vision-Only Setup',
      subtitle: 'CCTV + YOLOv8 inference',
      estimatedCost: '₹650',
      costUnit: 'per slot amortized CCTV coverage',
      accuracy: '88.4%',
      isFeatured: false,
      features: [
        { label: 'Slot ground-truth confirmation', supported: false },
        { label: 'Immunity to camera occlusion', supported: false },
        { label: 'Low cabling & maintenance overhead', supported: true },
        { label: 'Vehicle type & plate recognition', supported: true },
        { label: 'Cost-effective for 500+ car bays', supported: true },
        { label: 'Lighting/glare independence', supported: false }
      ]
    },
    {
      id: 'hybrid' as const,
      name: 'Proposed Hybrid Fused',
      subtitle: 'IoT Sensor + Camera Arbitration',
      estimatedCost: '₹1,350',
      costUnit: 'per slot with dual redundancy',
      accuracy: '99.4%',
      isFeatured: true,
      features: [
        { label: 'Slot ground-truth confirmation', supported: true },
        { label: 'Immunity to camera occlusion', supported: true },
        { label: 'Low cabling & maintenance overhead', supported: true },
        { label: 'Vehicle type & plate recognition', supported: true },
        { label: 'Cost-effective for 500+ car bays', supported: true },
        { label: 'Lighting/glare independence', supported: true }
      ]
    }
  ];

  return (
    <section id="comparison" className="bg-[#f3f4f6] py-16 md:py-24 border-b border-[#dde0e6]">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="max-w-3xl space-y-3 mb-14 text-center mx-auto">
          <div className="text-[13px] font-semibold tracking-wider text-[#074ce0] uppercase">
            Comparative Feasibility Analysis
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#16191f]">
            Why the Hybrid Architecture Wins in Accuracy and Economics
          </h2>
          <p className="text-[16px] text-[#454c58] leading-relaxed">
            Rather than relying exclusively on a single vulnerable pipeline, combining low-cost sensors with overhead vision achieves high reliability while cutting per-bay deployment costs.
          </p>
        </div>

        {/* 3 Aligned Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-[12px] bg-white p-7 flex flex-col justify-between transition-all duration-160 shadow-xs ${
                  plan.isFeatured
                    ? 'border-2 border-[#074ce0] ring-1 ring-[#074ce0]/20'
                    : 'border border-[#dde0e6]'
                }`}
              >
                {plan.isFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-[#074ce0] px-3 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Our Proposed Architecture</span>
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="font-display text-xl font-bold text-[#16191f]">
                      {plan.name}
                    </h3>
                    <p className="text-[13px] text-[#454c58] mt-0.5">{plan.subtitle}</p>
                  </div>

                  {/* Pricing / Metric Alignment */}
                  <div className="pb-6 mb-6 border-b border-[#dde0e6]">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-3xl font-bold text-[#16191f] tabular-nums">
                        {plan.estimatedCost}
                      </span>
                      <span className="text-[12px] text-[#454c58] font-medium">approx.</span>
                    </div>
                    <div className="text-[12px] text-[#454c58] mt-1">{plan.costUnit}</div>
                    <div className="mt-3 inline-flex items-center gap-2 text-[13px]">
                      <span className="text-[#454c58]">Tested Accuracy:</span>
                      <strong className={`font-mono tabular-nums ${plan.isFeatured ? 'text-[#074ce0]' : 'text-[#16191f]'}`}>
                        {plan.accuracy}
                      </strong>
                    </div>
                  </div>

                  {/* Aligned Feature Checklist */}
                  <ul className="space-y-3.5 text-[14px]">
                    {plan.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5">
                        {feat.supported ? (
                          <Check className="w-4 h-4 text-[#074ce0] shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-4 h-4 text-[#9ca3af] shrink-0 mt-0.5" />
                        )}
                        <span className={feat.supported ? 'text-[#16191f]' : 'text-[#9ca3af]'}>
                          {feat.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <button
                    onClick={() => setSelectedPlan(plan.id)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-[8px] py-2.5 px-4 text-[14px] font-semibold transition-all duration-160 ease-out focus-visible:outline-2 focus-visible:outline-[#074ce0] ${
                      isSelected
                        ? 'bg-[#074ce0] text-white shadow-xs hover:bg-[#063ec0]'
                        : 'border border-[#dde0e6] bg-white text-[#16191f] hover:border-[#16191f]'
                    }`}
                  >
                    {isSelected ? 'Selected Model' : `Inspect ${plan.name}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
