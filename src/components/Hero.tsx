import type { CSSProperties } from 'react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';

interface HeroProps {
  onOpenBooking: () => void;
  onOpenClassFinder: () => void;
}

const HERO_IMG = '/media/images/hero/priyanshi-namaste-full';

/** Warm shade under the words: strongest bottom-left, gone by the middle, so the photo stays bright. */
const SHADE: CSSProperties = {
  backgroundImage:
    'linear-gradient(20deg, rgb(40 26 18 / 0.62) 0%, rgb(40 26 18 / 0.28) 38%, rgb(40 26 18 / 0) 62%), linear-gradient(180deg, rgb(40 26 18 / 0.18) 0%, rgb(40 26 18 / 0) 22%)',
};
const SHADE_PHONE: CSSProperties = {
  backgroundImage: 'linear-gradient(0deg, rgb(40 26 18 / 0.7) 0%, rgb(40 26 18 / 0.35) 40%, rgb(40 26 18 / 0) 65%)',
};

/**
 * Full-photo hero (owner-approved 2026-11-14, design/concepts/hero-fullbleed, version 1): Priyanshi's namaste
 * photo fills the hero and white display type sits low on the left over a warm shade.
 */
export function Hero({ onOpenBooking, onOpenClassFinder }: HeroProps) {
  return (
    <section
      id="home"
      className="relative isolate overflow-hidden h-[min(100svh,760px)] md:h-[min(100svh,860px)] min-h-[600px] text-[#fbf8f2]"
    >
      <img
        src={`${HERO_IMG}-1400.webp`}
        srcSet={`${HERO_IMG}-900.webp 900w, ${HERO_IMG}-1400.webp 1400w, ${HERO_IMG}-2000.webp 2000w`}
        sizes="100vw"
        width={2000}
        height={3000}
        fetchPriority="high"
        alt="Priyanshi seated with her hands together and eyes closed, among soft green leaves"
        className="absolute inset-0 -z-20 w-full h-full object-cover object-[52%_30%] md:object-[62%_38%]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 hidden md:block" style={SHADE} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 md:hidden" style={SHADE_PHONE} />
      <div className="word-fade absolute inset-x-0 bottom-0 max-w-[1320px] mx-auto px-5 md:px-12 pb-9 md:pb-[clamp(36px,7vh,72px)] flex flex-col items-center text-center md:items-start md:text-left gap-[18px]">
        <h1 className="font-display font-normal text-display max-w-[11ch] [text-shadow:0_2px_24px_rgb(30_20_14/0.25)]">
          <span className="wf-word" style={{ '--i': 0 } as CSSProperties}>Connect</span>{' '}
          <span className="wf-word" style={{ '--i': 1 } as CSSProperties}>with</span>{' '}
          <span className="wf-word" style={{ '--i': 2 } as CSSProperties}>your</span>{' '}
          <span className="wf-word" style={{ '--i': 3 } as CSSProperties}>
            <em className="italic">body</em>.
          </span>
        </h1>
        <p className="wf-after text-base leading-[1.6] max-w-[40ch]" style={{ '--i': 4 } as CSSProperties}>
          Yoga with Priyanshi. Start with a trial class.
        </p>
        {/* Book stays the one primary and comes first; the quiz is the secondary beside it (DESIGN_SYSTEM §5). */}
        <div className="w-full flex flex-col sm:flex-row items-center sm:justify-center md:justify-start gap-3 mt-1">
          <AnimateIcon animateOnHover asChild>
            <button
              type="button"
              onClick={onOpenBooking}
              style={{ '--i': 5 } as CSSProperties}
              className="wf-after press w-full max-w-[280px] sm:w-auto sm:max-w-none inline-flex items-center justify-center gap-2 min-h-12 px-[22px] py-[14px] rounded-full bg-[#fbf8f2] text-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition duration-200 ease-spring active:duration-100"
            >
              Book a trial class
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </AnimateIcon>
          <button
            type="button"
            onClick={onOpenClassFinder}
            style={{ '--i': 6 } as CSSProperties}
            className="wf-after press w-full max-w-[280px] sm:w-auto sm:max-w-none inline-flex items-center justify-center gap-2 min-h-12 px-[22px] py-[14px] rounded-full border border-[#fbf8f2]/70 bg-[#fbf8f2]/10 backdrop-blur-[8px] text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[#fbf8f2]/20 transition duration-200 ease-spring active:duration-100"
          >
            Find your class
          </button>
        </div>
      </div>
    </section>
  );
}
