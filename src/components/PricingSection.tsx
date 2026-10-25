import React from 'react';
import { Check } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { MEMBERSHIP } from '../constants/membership';
import { Reveal } from './Reveal';

export type PlanKey = 'free' | 'single' | 'pack10' | 'pack20';

interface PricingSectionProps {
  onOpenBooking: (planKey: PlanKey) => void;
  /** "Join the membership": the contact pop-up preset to the membership. */
  onJoinMembership: () => void;
}

/** The four plans; prices and terms match the server (backend) and the booking modal. */
const PLANS: ReadonlyArray<{ key: PlanKey; name: string; line: string; price: string }> = [
  { key: 'free', name: 'First class', line: 'Any style, one per person', price: 'Free' },
  { key: 'single', name: 'Single class', line: 'One drop-in, no expiry', price: 'AED 350' },
  { key: 'pack10', name: '10-class pack', line: 'AED 300 a class · 3 months', price: 'AED 3,000' },
  { key: 'pack20', name: '20-class pack', line: 'Includes a private session · 6 months', price: 'AED 5,600' },
];

/**
 * DESIGN_SYSTEM §5 step 8: a compact list (each row opens booking with that plan selected) and, beside it
 * from lg, the monthly membership card. Its button sits outside every list item, so the first
 * `#pricing li button` is still the first plan row.
 */
export function PricingSection({ onOpenBooking, onJoinMembership }: PricingSectionProps) {
  return (
    <section id="pricing" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        <h2 className="font-display font-normal text-h2 text-ink">Pricing</h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <ul className="border-t border-line">
            {PLANS.map((plan) => (
              <li key={plan.key} className="border-b border-line">
                <AnimateIcon animateOnHover asChild>
                  <button
                    type="button"
                    onClick={() => onOpenBooking(plan.key)}
                    className="group w-full min-h-[88px] grid grid-cols-[1fr_auto_auto] items-center gap-4 sm:gap-6 py-5 px-2 sm:px-4 text-left rounded-[4px] hover:bg-glass press-soft transition duration-200 ease-spring active:duration-100"
                  >
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="font-display text-h3 text-ink"><span className="sr-only">Book </span>{plan.name}</span>
                      <span className="text-sm leading-[1.5] text-ink-soft">
                        {plan.line.split(' · ').map((part, i) => (
                          <React.Fragment key={part}>
                            {i > 0 && <span className="hidden sm:inline"> · </span>}
                            <span className="block sm:inline whitespace-nowrap">{part}</span>
                          </React.Fragment>
                        ))}
                      </span>
                    </span>
                    <span className="text-base font-semibold tabular-nums text-ink whitespace-nowrap">
                      {plan.price}
                    </span>
                    <span className="inline-flex items-center justify-center size-11 rounded-full border border-line text-ink group-hover:border-ink transition-colors duration-200">
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </button>
                </AnimateIcon>
              </li>
            ))}
          </ul>
          <div
            data-testid="membership-card"
            className="bg-glass backdrop-blur-[8px] rounded-[18px] border border-line-strong p-5 sm:p-6 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <h3 className="font-display font-normal text-h3 text-ink">{MEMBERSHIP.name}</h3>
              <p>
                <span className="text-base font-semibold tabular-nums text-ink">{MEMBERSHIP.price}</span>
                <span className="text-sm text-ink-soft"> {MEMBERSHIP.period}</span>
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {MEMBERSHIP.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-base leading-[1.6] text-ink-soft">
                  <Check className="size-4 shrink-0 mt-1 text-accent-text" aria-hidden="true" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <AnimateIcon animateOnHover asChild>
              <button type="button" onClick={onJoinMembership} className={cn(ui.primary, 'w-full sm:w-auto sm:self-start')}>
                <span>{MEMBERSHIP.cta}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </AnimateIcon>
          </div>
        </div>
        <p className="text-sm leading-[1.5] text-ink-soft">
          Pay in person at your session, or online with the details Priyanshi sends after you book. Free
          cancellation up to 6 hours before class.
        </p>
      </Reveal>
    </section>
  );
}
