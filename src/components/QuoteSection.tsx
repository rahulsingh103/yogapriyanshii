import { Reveal } from './Reveal';

export function QuoteSection() {
  return (
    <section aria-label="Quote" className="py-20 lg:py-32 px-5">
      <Reveal>
        <blockquote className="font-display italic text-[clamp(26px,4vw,40px)] leading-[1.25] text-center text-ink max-w-[24ch] mx-auto [text-wrap:balance]">
          Yoga is the journey of the self, through the self, to the self.
        </blockquote>
      </Reveal>
    </section>
  );
}
