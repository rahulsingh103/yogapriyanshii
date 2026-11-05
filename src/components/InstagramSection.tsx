import { Instagram } from 'lucide-react';
import { INSTAGRAM_URL } from '@/constants/contact';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { useOverflowsX } from '@/hooks/use-overflows';
import { Reveal } from './Reveal';

/** AI placeholders in the class-card style, until the photo shoot (owner decision 2026-11-04). */
const PHOTOS: ReadonlyArray<{ slug: string; alt: string }> = [
  { slug: 'teacher', alt: 'Yoga teacher seated cross-legged on a mat, smiling, one arm raised' },
  { slug: 'vinyasa', alt: 'Yoga teacher in a low lunge on a mat, one arm reaching up' },
  { slug: 'chakra-flow', alt: 'Yoga teacher seated cross-legged in meditation' },
  { slug: 'barre', alt: 'Yoga teacher at a ballet barre, rising onto her toes' },
  { slug: 'yin', alt: 'Yoga teacher resting in a seated forward fold' },
];

/**
 * DESIGN_SYSTEM §4 Instagram: a heading, five lazy photos (a native snap track on phones, five columns
 * from 768px) and one "Follow" link to her profile. No feed embed and no third-party script.
 */
export function InstagramSection() {
  const [trackRef, overflows] = useOverflowsX<HTMLUListElement>();
  return (
    <section id="instagram" aria-labelledby="instagram-title" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        <h2 id="instagram-title" className="font-display font-normal text-h2 text-ink">
          Follow along on Instagram
        </h2>
        <ul
          ref={trackRef}
          role="list"
          tabIndex={overflows ? 0 : undefined}
          aria-label="Yoga poses"
          className="snap-track grid grid-flow-col auto-cols-[min(44%,200px)] gap-4 overflow-x-auto snap-x snap-mandatory pb-3 rounded-[18px] md:grid-flow-row md:grid-cols-5 md:auto-cols-auto md:overflow-visible md:pb-0"
        >
          {PHOTOS.map((photo) => (
            <li key={photo.slug} className="snap-start min-w-0">
              <img
                src={`/media/images/practice/${photo.slug}-480.webp`}
                width={480}
                height={596}
                loading="lazy"
                decoding="async"
                alt={photo.alt}
                data-testid="instagram-photo"
                className="w-full h-auto aspect-[4/5] object-cover rounded-[18px] bg-surface-alt"
              />
            </li>
          ))}
        </ul>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(ui.secondary, 'self-start')}
        >
          <Instagram className="size-4" aria-hidden="true" />
          Follow @yogapriyanshi
        </a>
      </Reveal>
    </section>
  );
}
