import { Reveal } from './Reveal';

export function AboutSection() {
  return (
    <section id="about" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
        <img
          src="/media/images/practice/teacher-800.webp"
          srcSet="/media/images/practice/teacher-480.webp 480w, /media/images/practice/teacher-800.webp 800w"
          sizes="(min-width: 640px) 500px, 100vw"
          width={800}
          height={993}
          loading="lazy"
          decoding="async"
          alt="Yoga teacher smiling, seated cross-legged with one arm raised"
          className="w-full aspect-[4/5] object-cover rounded-[18px] bg-surface-alt"
        />
        <div className="flex flex-col gap-6">
          <h2 className="font-display font-normal text-h2 text-ink">
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
