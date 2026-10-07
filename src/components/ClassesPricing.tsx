import React, { useState } from 'react';
import { Check, Info, ShieldCheck, X } from 'lucide-react';
import { PricingPlan } from '../types';

interface ClassesPricingProps {
  onOpenBooking: (planKey?: 'free' | 'single' | 'pack10' | 'pack20') => void;
  onOpenContact: () => void;
}

export const ClassesPricing: React.FC<ClassesPricingProps> = ({
  onOpenBooking,
  onOpenContact,
}) => {
  const [phase2ModalOpen, setPhase2ModalOpen] = useState(false);
  const [selectedPlanTitle, setSelectedPlanTitle] = useState<string>('');

  const plans: PricingPlan[] = [
    {
      key: 'free',
      title: 'First Class',
      priceText: 'Free',
      priceAed: 0,
      credits: 1,
      validity: 'One-time',
      tag: 'Start Here',
      description: 'Any signature style, no card required, one per person ever.',
      features: [
        '1 complimentary group class credit',
        'Valid for Hatha, Barre, Wheel or Chakra',
        'In-person at BurJuman Residence Block D or Online Stream',
        'No credit card required',
        'Instant confirmation & booking token',
      ],
    },
    {
      key: 'single',
      title: 'Single Drop-in',
      priceText: 'AED 350',
      priceAed: 350,
      credits: 1,
      validity: 'No expiry',
      description: 'Single session drop-in whenever your calendar allows.',
      features: [
        '1 class credit for any signature style',
        'Flexible reservation window',
        'Free cancellation ≥ 6h before class',
        'Studio mats & props provided',
      ],
    },
    {
      key: 'pack10',
      title: '10-Class Pack',
      priceText: 'AED 3,000',
      priceAed: 3000,
      credits: 10,
      validity: '3 months',
      popular: true,
      tag: 'Most Popular',
      description: 'AED 300/class. Ideal for regular weekly practice.',
      features: [
        '10 class credits (AED 300 / class)',
        '3 months validity from first use',
        'Shareable with a friend on your credits',
        'Access to 7-day class recordings library',
        'Free cancellation up to 6 hours before class',
      ],
    },
    {
      key: 'pack20',
      title: '20-Class Pack',
      priceText: 'AED 5,600',
      priceAed: 5600,
      credits: 20,
      validity: '6 months',
      tag: 'Best Value',
      description: 'AED 280/class, save AED 400. Includes private session.',
      features: [
        '20 class credits (AED 280 / class)',
        'Save AED 400 total vs drop-in',
        '1 private 1-to-1 session included (value AED 500)',
        '6 months validity & shareable with friends',
        'Priority booking access for limited classes',
      ],
    },
  ];

  const handleSelectPlan = (plan: PricingPlan) => {
    onOpenBooking(plan.key as any);
  };

  return (
    <section id="classes" className="py-24 bg-[#0f0e0b] text-[#faf8f3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-[#c4b48a] font-semibold mb-3">
            03. Pricing & Membership
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-[#faf8f3] tracking-tight mb-4">
            Choose your practice
          </h2>
          <p className="text-base text-[#faf8f3]/70 leading-relaxed">
            Begin with your complimentary introductory class. When you are ready to deepen your commitment, packs offer shareable credits and guaranteed studio reservation.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative bg-[#171512] border p-8 flex flex-col justify-between transition-all ${
                plan.popular
                  ? 'border-[#c4b48a] shadow-[0_0_30px_rgba(196,180,138,0.12)]'
                  : 'border-[#faf8f3]/10 hover:border-[#faf8f3]/25'
              }`}
            >
              {plan.tag && (
                <div className="mb-4">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-widest ${
                      plan.popular ? 'text-[#c4b48a]' : 'text-[#faf8f3]/60'
                    }`}
                  >
                    {plan.tag}
                  </span>
                </div>
              )}

              <div>
                <h3 className="font-serif text-xl sm:text-2xl text-[#faf8f3] mb-2">
                  {plan.title}
                </h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-serif text-3xl sm:text-4xl text-[#faf8f3] font-semibold">
                    {plan.priceText}
                  </span>
                  {plan.validity !== '—' && (
                    <span className="text-xs text-[#faf8f3]/50">/ {plan.validity}</span>
                  )}
                </div>

                <p className="text-xs text-[#faf8f3]/70 leading-relaxed mb-6">
                  {plan.description}
                </p>

                <div className="w-full h-px bg-[#faf8f3]/10 mb-6" />

                <ul className="space-y-3 mb-8 text-xs text-[#faf8f3]/80">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="w-3.5 h-3.5 text-[#c4b48a] shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-3.5 text-xs font-semibold uppercase tracking-[0.2em] transition-colors text-center ${
                    plan.key === 'free'
                      ? 'bg-[#c4b48a] text-[#0f0e0b] hover:bg-[#b3a277]'
                      : plan.popular
                      ? 'bg-[#faf8f3] text-[#0f0e0b] hover:bg-[#faf8f3]/90'
                      : 'border border-[#faf8f3]/30 text-[#faf8f3] hover:border-[#faf8f3]'
                  }`}
                >
                  {plan.key === 'free' ? 'Claim Free Class' : 'Get Started'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Notes Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-[#faf8f3]/10 text-xs text-[#faf8f3]/70">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[#c4b48a] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#faf8f3] mb-1 uppercase tracking-wider text-[11px]">
                Private 1-to-1 Sessions
              </p>
              <p>
                AED 500 per 60 min. Tailored anatomical analysis, restorative therapy, or advanced inversions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#c4b48a] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#faf8f3] mb-1 uppercase tracking-wider text-[11px]">
                Shareable Packs
              </p>
              <p>
                All 10 & 20 packs are shareable. Bring a partner or friend on your credits at any time.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[#c4b48a] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#faf8f3] mb-1 uppercase tracking-wider text-[11px]">
                Cancellation Policy
              </p>
              <p>
                Free cancellation up to 6 hours before class. First class is always free.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 1 Launching Soon Modal */}
      {phase2ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f0e0b]/80 backdrop-blur-xs">
          <div className="bg-[#f2ede4] text-[#0f0e0b] border border-[#0f0e0b]/10 max-w-md w-full p-8 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setPhase2ModalOpen(false)}
              className="absolute top-6 right-6 text-[#0f0e0b]/50 hover:text-[#0f0e0b]"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[11px] uppercase tracking-widest text-[#c4b48a] font-semibold block mb-2">
              Phase 1 Notice
            </span>

            <h3 className="font-serif text-2xl text-[#0f0e0b] mb-4">
              Online payments are launching soon
            </h3>

            <p className="text-sm text-[#0f0e0b]/75 leading-relaxed mb-6">
              Thank you for your interest in the <strong>{selectedPlanTitle}</strong>. 
              Automated card checkout via Stripe will go live in Phase 2.
            </p>

            <p className="text-sm text-[#0f0e0b]/75 leading-relaxed mb-8">
              In the meantime, you can experience your <strong>free first class</strong> today, 
              or write directly to Priyanshi to arrange pack payment via bank transfer or at the studio.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setPhase2ModalOpen(false);
                  onOpenBooking('free');
                }}
                className="flex-1 py-3 bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest text-center"
              >
                Book Free Class
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase2ModalOpen(false);
                  onOpenContact();
                }}
                className="flex-1 py-3 border border-[#0f0e0b]/30 hover:border-[#0f0e0b] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest text-center"
              >
                Message Priyanshi
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
