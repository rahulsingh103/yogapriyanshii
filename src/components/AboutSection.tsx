import { Reveal } from './Reveal';

export function AboutSection() {
  return (
    <section id="about" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
        <div
          className="bg-linear-160 from-surface-alt to-line-strong min-h-[380px] rounded-[4px] flex items-end p-4"
          aria-hidden="true"
        >
          <span className="bg-surface/90 text-ink-soft text-xs px-2 py-1 rounded-[2px]">Photo · Priyanshi teaching</span>
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="font-display font-normal text-[clamp(34px,5.5vw,58px)] leading-[1.05] text-ink">
            Hi, I&apos;m Priyanshi.
          </h2>
          <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            Seven years of teaching, one simple aim: that you leave lighter than you came.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
