import type { CSSProperties } from 'react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';

interface HeroProps {
  onOpenBooking: () => void;
}

export function Hero({ onOpenBooking }: HeroProps) {
  return (
    <section id="home" className="min-h-[92vh] flex items-center justify-center px-5 pt-24 pb-16">
      <div className="word-fade flex flex-col items-center gap-6 text-center">
        <p className="wf-after text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft [text-wrap:balance]" style={{ '--i': 0 } as CSSProperties}>
          BurJuman Residence Block D · Dubai
        </p>
        {/* Keep the space before <br/>: the heading must read "Connect with your body." as text. */}
        <h1 className="font-display font-normal text-[clamp(44px,8vw,92px)] leading-[0.98] tracking-[-0.01em] text-ink">
          <span className="wf-word" style={{ '--i': 0 } as CSSProperties}>Connect</span>{' '}
          <span className="wf-word" style={{ '--i': 1 } as CSSProperties}>with</span> <br />
          <span className="wf-word" style={{ '--i': 2 } as CSSProperties}>your</span>{' '}
          <span className="wf-word" style={{ '--i': 3 } as CSSProperties}>
            <em className="italic text-accent-text">body</em>.
          </span>
        </h1>
        <p className="wf-after text-base leading-[1.6] text-ink-soft max-w-[46ch]" style={{ '--i': 4 } as CSSProperties}>
          Yoga with Priyanshi. Your first class is on us.
        </p>
        <AnimateIcon animateOnHover asChild>
          <button
            type="button"
            onClick={onOpenBooking}
            style={{ '--i': 5 } as CSSProperties}
            className="wf-after inline-flex items-center justify-center gap-2 min-h-12 px-[22px] py-[14px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition-opacity duration-200"
          >
            Book a free class
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </AnimateIcon>
      </div>
    </section>
  );
}
