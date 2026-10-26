import type { CSSProperties } from 'react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { FindClassLink } from './FindClassLink';

interface HeroProps {
  onOpenBooking: () => void;
  onOpenClassFinder: () => void;
}

export function Hero({ onOpenBooking, onOpenClassFinder }: HeroProps) {
  return (
    <section id="home" className="min-h-[92vh] flex items-center justify-center px-5 pt-24 pb-16">
      <div className="word-fade flex flex-col items-center gap-6 text-center">
        {/* Keep the space before <br/>: the heading must read "Connect with your body." as text. */}
        <h1 className="font-display font-normal text-display text-ink">
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
        {/* The class finder link sits just under the one primary, quieter (DESIGN_SYSTEM §5). */}
        <div className="flex flex-col items-center gap-3">
          <AnimateIcon animateOnHover asChild>
            <button
              type="button"
              onClick={onOpenBooking}
              style={{ '--i': 5 } as CSSProperties}
              className="wf-after press inline-flex items-center justify-center gap-2 min-h-12 px-[22px] py-[14px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition duration-200 ease-spring active:duration-100"
            >
              Book a free class
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </AnimateIcon>
          <FindClassLink onOpen={onOpenClassFinder} className="wf-after justify-center" style={{ '--i': 6 } as CSSProperties} />
        </div>
      </div>
    </section>
  );
}
