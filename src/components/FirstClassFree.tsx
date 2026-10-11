import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { ui } from '@/lib/ui';
import { Reveal } from './Reveal';

interface FirstClassFreeProps {
  onPickTime: () => void;
}

/** DESIGN_SYSTEM §5 step 7: the free-first-class invitation, pointing back to the live schedule. */
export function FirstClassFree({ onPickTime }: FirstClassFreeProps) {
  return (
    <section aria-labelledby="first-class-title" className="py-20 lg:py-32 px-5">
      <Reveal className="max-w-[640px] mx-auto flex flex-col items-center gap-6 text-center">
        <h2
          id="first-class-title"
          className="font-display font-normal text-[clamp(34px,5.5vw,58px)] leading-[1.05] text-ink"
        >
          Your first class is <em className="italic text-accent-text">free</em>
        </h2>
        <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
          Classes every day except Friday · in person or online
        </p>
        <AnimateIcon animateOnHover asChild>
          <button type="button" onClick={onPickTime} className={ui.primary}>
            Pick a time
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </AnimateIcon>
      </Reveal>
    </section>
  );
}
