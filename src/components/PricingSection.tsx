import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { Reveal } from './Reveal';

export type PlanKey = 'free' | 'single' | 'pack10' | 'pack20';

interface PricingSectionProps {
  onOpenBooking: (planKey: PlanKey) => void;
}

/** The four plans; prices and terms match the server (backend) and the booking modal. */
const PLANS: ReadonlyArray<{ key: PlanKey; name: string; line: string; price: string }> = [
  { key: 'free', name: 'First class', line: 'Any style, one per person', price: 'Free' },
  { key: 'single', name: 'Single class', line: 'One drop-in, no expiry', price: 'AED 350' },
  { key: 'pack10', name: '10-class pack', line: 'AED 300 a class · 3 months', price: 'AED 3,000' },
  { key: 'pack20', name: '20-class pack', line: 'AED 280 a class · 6 months', price: 'AED 5,600' },
];

/** DESIGN_SYSTEM §5 step 6: a compact list; each row opens booking with that plan selected. */
export function PricingSection({ onOpenBooking }: PricingSectionProps) {
  return (
    <section id="pricing" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        <h2 className="font-display font-normal text-[clamp(34px,5.5vw,58px)] leading-[1.05] text-ink">Pricing</h2>
        <ul className="border-t border-line">
          {PLANS.map((plan) => (
            <li key={plan.key} className="border-b border-line">
              <AnimateIcon animateOnHover asChild>
                <button
                  type="button"
                  onClick={() => onOpenBooking(plan.key)}
                  className="group w-full min-h-[88px] grid grid-cols-[1fr_auto_auto] items-center gap-4 sm:gap-6 py-5 px-2 sm:px-4 text-left rounded-[4px] hover:bg-glass transition-colors duration-200"
                >
                  <span className="flex flex-col gap-1 min-w-0">
                    <span className="font-display text-[28px] leading-[1.1] text-ink">{plan.name}</span>
                    <span className="text-sm leading-[1.5] text-ink-soft">{plan.line}</span>
                  </span>
                  <span className="text-base sm:text-lg font-semibold tabular-nums text-ink whitespace-nowrap">
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
        <p className="text-sm leading-[1.5] text-ink-soft">
          Pay at the studio. Free cancellation up to 6 hours before class.
        </p>
      </Reveal>
    </section>
  );
}
