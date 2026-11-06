import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { ui } from '@/lib/ui';
import { Reveal } from './Reveal';

interface FirstClassTrialProps {
  onPickTime: () => void;
}

/** DESIGN_SYSTEM §5 step 12: the trial class invitation, pointing back to the live schedule. */
export function FirstClassTrial({ onPickTime }: FirstClassTrialProps) {
  return (
    <section id="first-class" aria-labelledby="first-class-title" className="py-20 lg:py-32 px-5">
      <Reveal className="max-w-[640px] mx-auto flex flex-col items-center gap-6 text-center">
        <h2
          id="first-class-title"
          className="font-display font-normal text-h2 text-ink"
        >
          Start with a <em className="italic text-accent-text">trial</em> class
        </h2>
        <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
          AED 90 · Classes every day<span className="hidden sm:inline"> ·</span> <br className="sm:hidden" />in person or online
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
