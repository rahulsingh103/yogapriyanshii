import { useRef, type KeyboardEvent } from 'react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowLeft } from '@/components/animate-ui/icons/arrow-left';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { PRACTICE_CLASSES, type PracticeClass } from '../constants/classes';
import { Reveal } from './Reveal';

interface PracticeCarouselProps {
  onSelectClass: (practice: PracticeClass) => void;
}

/** Photo placeholders until real photos exist: token-only gradients at different angles (no new colours). */
const PLACEHOLDERS = [
  'bg-linear-160 from-surface-alt to-line-strong',
  'bg-linear-200 from-surface to-line',
  'bg-linear-135 from-surface-alt via-line to-line-strong',
  'bg-linear-180 from-surface to-line-strong',
  'bg-linear-120 from-line to-surface-alt',
  'bg-linear-215 from-surface-alt to-line',
  'bg-linear-150 from-surface via-surface-alt to-line-strong',
  'bg-linear-190 from-line to-line-strong',
];

const ICON_BUTTON =
  'hidden lg:inline-flex items-center justify-center size-11 rounded-full border border-line bg-bg/85 text-ink hover:border-ink transition-colors duration-200';

export function PracticeCarousel({ onSelectClass }: PracticeCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('button');
    const step = (card?.getBoundingClientRect().width ?? 280) + 16;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: direction * step, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // cards keep their own keys
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollByCard(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollByCard(-1);
    }
  };

  return (
    <section id="classes" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display font-normal text-[clamp(34px,5.5vw,58px)] leading-[1.05] text-ink">
            Choose your practice
          </h2>
          <div className="flex gap-2">
            <AnimateIcon animateOnHover asChild>
              <button type="button" aria-label="Previous classes" onClick={() => scrollByCard(-1)} className={ICON_BUTTON}>
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            </AnimateIcon>
            <AnimateIcon animateOnHover asChild>
              <button type="button" aria-label="Next classes" onClick={() => scrollByCard(1)} className={ICON_BUTTON}>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </AnimateIcon>
          </div>
        </div>

        <div
          ref={trackRef}
          role="group"
          tabIndex={0}
          aria-label="Classes, swipe or use the arrow keys"
          onKeyDown={onTrackKey}
          className="practice-track grid grid-flow-col auto-cols-[min(78%,300px)] gap-4 overflow-x-auto snap-x snap-mandatory pt-2 pb-3 rounded-[18px]"
        >
          {PRACTICE_CLASSES.map((practice, i) => (
            <button
              key={practice.name}
              type="button"
              data-testid="practice-card"
              onClick={() => onSelectClass(practice)}
              className="card-lift snap-start grid grid-rows-[auto_1fr] min-w-0 text-left bg-glass backdrop-blur-[8px] rounded-[18px] overflow-hidden transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className={`${PLACEHOLDERS[i % PLACEHOLDERS.length]} min-h-[260px] flex items-end p-3.5`} aria-hidden="true">
                <span className="bg-surface/75 text-ink-soft text-xs px-2 py-1 rounded-[2px]">
                  Photo · {practice.name}
                </span>
              </div>
              <div className="p-4 pb-5 flex flex-col gap-1">
                <h3 className="font-display font-normal text-[28px] leading-[1.1] text-ink">{practice.name}</h3>
                <p className="text-sm leading-[1.5] text-ink-soft">{practice.line}</p>
              </div>
            </button>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
