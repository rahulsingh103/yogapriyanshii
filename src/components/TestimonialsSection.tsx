import { TESTIMONIALS } from '@/constants/testimonials';
import { useOverflowsX } from '@/hooks/use-overflows';
import { Reveal } from './Reveal';

/**
 * DESIGN_SYSTEM §4 Testimonials: three verified reviews as glass cards. On phones they sit in a native
 * scroll-snap track (no auto-advance, no arrows); from `lg` they are three columns.
 */
export function TestimonialsSection() {
  const [trackRef, overflows] = useOverflowsX<HTMLUListElement>();
  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        <h2 id="testimonials-title" className="font-display font-normal text-h2 text-ink">
          What students say
        </h2>
        <ul
          ref={trackRef}
          role="list"
          tabIndex={overflows ? 0 : undefined}
          aria-label="Student reviews"
          className="snap-track grid grid-flow-col auto-cols-[min(85%,340px)] gap-4 overflow-x-auto snap-x snap-mandatory pt-2 pb-3 rounded-[18px] lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:overflow-visible"
        >
          {TESTIMONIALS.map((t) => (
            <li key={t.className} data-testid="testimonial" className="snap-start min-w-0 flex">
              <figure className="flex-1 flex flex-col justify-between gap-6 p-5 bg-glass backdrop-blur-[8px] rounded-[18px]">
                <blockquote className="text-base leading-[1.6] text-ink">
                  <p>{t.quote}</p>
                </blockquote>
                <figcaption className="text-sm leading-[1.5] text-ink-soft">Verified ClassPass review · {t.className} class</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
