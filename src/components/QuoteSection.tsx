import { ui } from '@/lib/ui';
import { Reveal } from './Reveal';

/** Priyanshi's chosen quote (design/PRIYANSHI-FACTS.md): Patanjali, Yoga Sutras 1.2, with its meaning. */
export function QuoteSection() {
  return (
    <section aria-label="Quote" className="py-20 lg:py-32 px-5">
      <Reveal>
        <figure className="flex flex-col items-center gap-6 text-center">
          {/* 15.5em = 24ch of Italiana. Not `ch`: it follows the fallback font's "0" during the font swap and reflows the quote. */}
          <blockquote className="flex flex-col items-center gap-4">
            <p lang="sa-Latn" className="font-display italic text-quote text-ink max-w-[15.5em] [text-wrap:balance]">
              Yogas citta vritti nirodhah.
            </p>
            <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch] [text-wrap:balance]">
              Yoga is the stilling of the fluctuations of the mind.
            </p>
          </blockquote>
          <figcaption className={ui.eyebrow}>
            Patanjali · Yoga Sutras 1.2
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
