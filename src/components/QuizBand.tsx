import { ui } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

interface QuizBandProps {
  onOpenClassFinder: () => void;
}

/**
 * DESIGN_SYSTEM §4 Quiz band: between the hero and the classes, for the moment someone is deciding.
 * One heading, one line, one button. No `id`: it isn't a nav destination, and it stays outside
 * `#classes`, so the nav link and the card restore still land on the carousel heading.
 */
export function QuizBand({ onOpenClassFinder }: QuizBandProps) {
  return (
    <section aria-labelledby="quiz-band-title">
      <Reveal className="max-w-[1040px] mx-auto px-5">
        <div className="p-6 sm:p-8 rounded-[18px] bg-surface-alt flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-col gap-2 min-w-0 flex-[1_1_260px]">
            <h2 id="quiz-band-title" className="font-display font-normal text-h3 text-ink text-balance">
              Not sure which class suits you?
            </h2>
            <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch] text-pretty">
              Answer a few quick questions and get a suggestion from Priyanshi&apos;s classes.
            </p>
          </div>
          <button type="button" onClick={onOpenClassFinder} className={cn(ui.secondary, 'border-line-strong whitespace-nowrap')}>
            Take the quiz
          </button>
        </div>
      </Reveal>
    </section>
  );
}
