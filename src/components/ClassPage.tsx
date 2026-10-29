import { useEffect, useRef, type MouseEvent } from 'react';
import { useLenis } from 'lenis/react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowLeft } from '@/components/animate-ui/icons/arrow-left';
import { WHATSAPP_ENABLED, whatsappUrl } from '@/constants/contact';
import {
  classBeforeList,
  classDetailRows,
  classPage,
  classPageKind,
  classPageLine,
  classPagePrefill,
  classPagePrimaryLabel,
  classPhotoMaxClass,
  classPhotoSizes,
} from '@/constants/class-pages';
import { setDocumentHead } from '@/lib/page-meta';
import { metaFor } from '@/lib/route-html';
import { isPlainClick } from '@/hooks/use-route';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import type { ClassStyle } from '@/types';
import { WhatsAppGlyph } from './WhatsAppGlyph';

interface ClassPageProps {
  slug: string;
  /** In-app navigation moves focus to the h1; a direct load leaves focus alone (P14). */
  focusHeading: boolean;
  /** Called once the page has mounted, so the preloader can fade (P3). */
  onReady: () => void;
  onBook: (style: ClassStyle) => void;
  onContact: (interest: string) => void;
  /** "All classes": back to home's carousel (App decides between history.back() and a fresh visit). */
  onAllClasses: () => void;
}

const FOCUS_HEADING =
  'focus-visible:outline-none focus-visible:underline focus-visible:decoration-line-strong focus-visible:decoration-1 focus-visible:underline-offset-[6px]';
const SECTION_TITLE = 'font-display font-normal text-h4 text-ink text-balance';
const BODY = 'text-base leading-[1.6] text-ink-soft max-w-[46ch]';

/**
 * DESIGN_SYSTEM "Class page": one class, opened from its carousel card's "Learn more" or directly at
 * /classes/<slug>. Stacked on phones, photo | text from lg. The actions are honest: only the 4
 * timetabled classes say "Book"; the others open the contact pop-up with that class preset.
 */
export function ClassPage({ slug, focusHeading, onReady, onBook, onContact, onAllClasses }: ClassPageProps) {
  const page = classPage(slug);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    if (!page) return;
    setDocumentHead(metaFor({ kind: 'class', slug }));
    // Every class page opens at the top, then (in-app only) focus moves to its name.
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    if (focusHeading) headingRef.current?.focus({ preventScroll: true });
    onReady();
    // Runs once per page: Lenis arriving later must not scroll the reader back up.
  }, [slug]);

  // resolveRoute only yields known slugs, so this never shows.
  if (!page) return null;

  const { cls, content } = page;
  const kind = classPageKind(cls);
  const benefit = cls.line.split(' · ')[0];
  const rows = classDetailRows(cls, content);
  const photo = content.photo;

  const onPrimary = () => {
    if (cls.style) onBook(cls.style);
    else onContact(cls.contactInterest ?? 'General enquiry');
  };

  const onBack = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    // Same as the header links: keep Lenis's anchor handling out of "/#classes".
    e.stopPropagation();
    onAllClasses();
  };

  return (
    <main className="flex-1">
      <article
        aria-labelledby="class-title"
        className="max-w-[1040px] mx-auto px-5 pt-24 pb-24 lg:pt-32 lg:pb-32 flex flex-col gap-8 lg:gap-12"
      >
        <AnimateIcon animateOnHover asChild>
          <a
            href="/#classes"
            onClick={onBack}
            className="self-start inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-ink-soft hover:text-ink transition-colors duration-200"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            All classes
          </a>
        </AnimateIcon>

        <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-x-16 lg:items-start">
          <header className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1">
            <h1
              id="class-title"
              ref={headingRef}
              tabIndex={-1}
              // cn() keeps text-h2 next to text-ink: the size tokens are registered in lib/utils.ts.
              className={cn('font-display font-normal text-h2 text-ink text-balance', FOCUS_HEADING)}
            >
              {cls.name}
            </h1>
            <p className={BODY}>{benefit}</p>
          </header>

          <img
            src={photo.src}
            srcSet={photo.srcSet}
            sizes={photo.srcSet ? classPhotoSizes(photo) : undefined}
            width={photo.width}
            height={photo.height}
            fetchPriority="high"
            decoding="async"
            alt={photo.alt}
            style={{ objectPosition: photo.position }}
            className={cn(
              // From lg the photo stays in view beside the longer text column (no motion, just sticky).
              'w-full aspect-[4/5] object-cover rounded-[18px] bg-surface-alt lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-32 lg:self-start',
              classPhotoMaxClass(photo)
            )}
          />

          <div className="flex flex-col gap-12 lg:col-start-2 lg:row-start-2">
            <section aria-labelledby="class-who" className="flex flex-col gap-3">
              <h2 id="class-who" className={SECTION_TITLE}>
                Who it&apos;s for
              </h2>
              <p data-testid="class-who-for" className={BODY}>
                {content.whoFor}
              </p>
            </section>

            <section aria-labelledby="class-about" className="flex flex-col gap-3">
              <h2 id="class-about" className={SECTION_TITLE}>
                About the class
              </h2>
              <p className={BODY}>{content.about}</p>
            </section>

            {/* The About block's hairline <dl> pattern: label, then value. Focus and origin span both columns. */}
            <dl data-testid="class-details" className="grid grid-cols-2 gap-x-4 gap-y-6 pt-6 border-t border-line">
              {rows.map((row) => (
                <div key={row.key} className={cn('flex flex-col gap-1 min-w-0', row.wide && 'col-span-2')}>
                  <dt className="text-sm leading-[1.5] text-ink-soft">{row.label}</dt>
                  <dd data-testid={`class-${row.key}`} className={cn('text-base leading-[1.5] text-ink', row.wide && 'max-w-[46ch]')}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <section aria-labelledby="class-bring" className="flex flex-col gap-3">
              <h2 id="class-bring" className={SECTION_TITLE}>
                What to bring
              </h2>
              <ul data-testid="class-before" className="flex flex-col gap-2 max-w-[52ch]">
                {classBeforeList(kind).map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-[1.6] text-ink-soft">
                    <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {content.notices.map((notice) => (
              <p key={notice} className={cn(ui.notice, 'max-w-[52ch]')}>
                {notice}
              </p>
            ))}

            {content.testimonial && (
              <figure className="flex flex-col gap-6 p-5 bg-glass backdrop-blur-[8px] rounded-[18px] max-w-[52ch]">
                <blockquote className="text-base leading-[1.6] text-ink">
                  <p>{content.testimonial.quote}</p>
                </blockquote>
                <figcaption className="text-sm leading-[1.5] text-ink-soft">
                  Verified ClassPass review · {content.testimonial.className} class
                </figcaption>
              </figure>
            )}

            <section id="class-actions" aria-label={`${cls.name}: next step`} className="flex flex-col gap-4 pt-6 border-t border-line">
              <p className={BODY}>{classPageLine(kind)}</p>
              {/* Labels never wrap: a pill that doesn't fit on the row drops to its own line instead. */}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onPrimary} className={cn(ui.primary, 'w-full sm:w-auto whitespace-nowrap')}>
                  {classPagePrimaryLabel(kind)}
                </button>
                {WHATSAPP_ENABLED && (
                  <a
                    href={whatsappUrl(classPagePrefill(cls.name))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(ui.secondary, 'w-full sm:w-auto whitespace-nowrap')}
                  >
                    <WhatsAppGlyph size={16} />
                    Ask Priyanshi on WhatsApp
                  </a>
                )}
              </div>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
