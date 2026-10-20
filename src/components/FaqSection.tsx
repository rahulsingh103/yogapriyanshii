import { useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from '@/constants/faq';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

/**
 * DESIGN_SYSTEM §4 FAQ: a hairline list like Pricing. Each question is a button that opens its answer
 * below it; several can be open at once and none is open at first. The answer's height springs to
 * `auto` (critically damped); with reduced motion it opens and closes at once.
 */
export function FaqSection() {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, bounce: 0, duration: 0.35 };

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section id="faq" aria-labelledby="faq-title" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        <h2 id="faq-title" className="font-display font-normal text-h2 text-ink">
          Questions, answered
        </h2>
        <ul className="border-t border-line">
          {FAQ_ITEMS.map((item) => {
            const open = openIds.has(item.id);
            const buttonId = `faq-q-${item.id}`;
            // No role="region": with up to 9 answers open it would crowd the landmarks. The id is kept
            // for the button's aria-controls.
            const panelId = `faq-a-${item.id}`;
            return (
              <li key={item.id} className="border-b border-line">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-expanded={open}
                    aria-controls={open ? panelId : undefined}
                    className="group w-full min-h-[72px] grid grid-cols-[1fr_auto] items-center gap-4 sm:gap-6 py-4 px-2 sm:px-4 text-left rounded-[4px] hover:bg-glass press-soft transition duration-200 ease-spring active:duration-100"
                  >
                    <span className="font-display text-h4 text-ink">{item.question}</span>
                    <span className="inline-flex items-center justify-center size-11 rounded-full border border-line text-ink group-hover:border-ink transition-colors duration-200">
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          'size-4 transition-transform duration-300 ease-spring motion-reduce:transition-none',
                          open && 'rotate-180'
                        )}
                      />
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {open && (
                    <m.div
                      key="answer"
                      id={panelId}
                      className="overflow-hidden"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={transition}
                    >
                      <p className="px-2 sm:px-4 pb-6 max-w-[64ch] text-base leading-[1.6] text-ink-soft">{item.answer}</p>
                    </m.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}
