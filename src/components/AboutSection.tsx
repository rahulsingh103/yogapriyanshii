import { Reveal } from './Reveal';

/** Trust numbers (design/PRIYANSHI-FACTS.md, owner answer 9): the value, then what it means. */
const TRUST_NUMBERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '7 years', label: 'Teaching since 2019' },
  { value: '300 hours', label: 'Yoga Alliance registered training' },
  { value: "Bachelor's", label: 'In Yogic Science' },
  { value: 'Up to 500', label: 'People led on International Yoga Day' },
];

export function AboutSection() {
  return (
    <section id="about" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
        <img
          src="/media/images/real/burj-forearm-stand-1-800.webp"
          srcSet="/media/images/real/burj-forearm-stand-1-480.webp 480w, /media/images/real/burj-forearm-stand-1-800.webp 800w, /media/images/real/burj-forearm-stand-1-1200.webp 1200w"
          sizes="(min-width: 640px) 500px, min(100vw, 400px)"
          width={800}
          height={1067}
          loading="lazy"
          decoding="async"
          alt="Priyanshi in a forearm stand on a mat on the lawn below the Burj Khalifa, Dubai"
          className="w-full aspect-[4/5] object-cover object-[50%_70%] rounded-[18px] bg-surface-alt"
        />
        <div className="flex flex-col gap-6">
          <h2 className="font-display font-normal text-h2 text-ink">
            Hi, I&apos;m Priyanshi.
          </h2>
          <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            Seven years of teaching, one simple aim: that you leave lighter than you came.
          </p>
          <p data-testid="about-credentials" className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            I trained in Rishikesh and at Dev Sanskriti Vishwavidyalaya. I&apos;ve taught group classes at one of
            the UAE&apos;s largest yoga studios, and now I teach in Dubai and online. I&apos;m also trained in
            prenatal yoga.
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-6 pt-6 border-t border-line">
            {TRUST_NUMBERS.map((n) => (
              <div key={n.value} className="flex flex-col-reverse justify-end gap-1">
                <dt className="text-sm leading-[1.5] text-ink-soft">{n.label}</dt>
                <dd className="font-display text-h3 text-ink">{n.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </section>
  );
}
