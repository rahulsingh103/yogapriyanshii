import { Instagram } from 'lucide-react';
import { INSTAGRAM_URL } from '@/constants/contact';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { useOverflowsX } from '@/hooks/use-overflows';
import { Reveal } from './Reveal';

/** Real photos of Priyanshi at the Burj Khalifa park (449px tiles until the photo shoot). */
const PHOTOS: ReadonlyArray<{ slug: string; width: number; height: number; alt: string }> = [
  { slug: 'flying-split', width: 449, height: 525, alt: 'Priyanshi in a flying split arm balance on the lawn below the Burj Khalifa' },
  { slug: 'forearm-split', width: 443, height: 525, alt: 'Priyanshi in a forearm stand with her legs split, the Burj Khalifa behind her' },
  { slug: 'king-pigeon', width: 443, height: 530, alt: 'Priyanshi in a king pigeon backbend on a mat in a Dubai park' },
  { slug: 'plow-variation', width: 449, height: 529, alt: 'Priyanshi in a shoulder stand variation with one leg raised, in a Dubai park' },
  { slug: 'seated-backbend', width: 443, height: 529, alt: 'Priyanshi in a seated backbend holding her raised foot, the Burj Khalifa behind her' },
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
          See Priyanshi in action
        </h2>
        <ul
          ref={trackRef}
          role="list"
          tabIndex={overflows ? 0 : undefined}
          aria-label="Photos from Instagram"
          className="snap-track grid grid-flow-col auto-cols-[min(44%,200px)] gap-4 overflow-x-auto snap-x snap-mandatory pb-3 rounded-[18px] md:grid-flow-row md:grid-cols-5 md:auto-cols-auto md:overflow-visible md:pb-0"
        >
          {PHOTOS.map((photo) => (
            <li key={photo.slug} className="snap-start min-w-0">
              <img
                src={`/media/images/real/${photo.slug}-480.webp`}
                width={photo.width}
                height={photo.height}
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
