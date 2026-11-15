import type { MouseEvent, ReactNode } from 'react';
import { INSTAGRAM_URL } from '@/constants/contact';
import { LEGAL_LINKS } from '@/constants/legal-links';
import { PUBLISHED_ARTICLES } from '@/content/articles';
import { GUIDES_PATH } from '@/lib/route';
import { isPlainClick } from '@/hooks/use-route';
import { LogoMark } from './LogoMark';
import { PrivacyChoicesIcon } from './PrivacyChoicesIcon';

interface FooterProps {
  onOpenCancel: () => void;
  onOpenAdmin: () => void;
  onOpenBooking: () => void;
  onOpenClassFinder: () => void;
  onOpenPrivacyChoices: () => void;
  /** False on a class page, a legal page or the 404: section links then go home in the app. */
  isHome?: boolean;
  onNavigateHome?: (sectionId?: string) => void;
  /** In-app navigation (Guides and the legal pages). */
  onNavigate?: (path: string) => void;
}

const LINK =
  'inline-flex items-center gap-2 min-h-8 text-left text-sm text-ink hover:underline underline-offset-4 decoration-line-strong transition-colors duration-200';
const HEAD = 'mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft';

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col items-start gap-1 min-w-0">
      <h2 className={HEAD}>{title}</h2>
      {children}
    </nav>
  );
}

/** The footer in columns (owner-approved 2026-11-14, design/concepts/footer-legal): Studio, Classes, Legal, Social. */
export function Footer({
  onOpenCancel,
  onOpenAdmin,
  onOpenBooking,
  onOpenClassFinder,
  onOpenPrivacyChoices,
  isHome = true,
  onNavigateHome,
  onNavigate,
}: FooterProps) {
  const go = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || !isPlainClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigate(path);
  };
  /** A home section: a plain anchor on home, an in-app trip home elsewhere. */
  const section = (id?: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (isHome || !onNavigateHome || !isPlainClick(e)) return;
    e.preventDefault();
    // Lenis (anchors: true) listens on window: it must not start its own smooth scroll.
    e.stopPropagation();
    onNavigateHome(id);
  };
  const sectionHref = (id: string) => (isHome ? `#${id}` : `/#${id}`);

  return (
    <footer className="border-t border-line">
      <div className="max-w-[1320px] mx-auto px-5 md:px-12 pt-14 pb-7 flex flex-col gap-10">
        <div className="grid grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)] gap-8">
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-3">
            <a
              href={isHome ? '#home' : '/'}
              onClick={section()}
              className="self-start inline-flex items-center gap-3 min-h-11 font-display text-2xl leading-none text-ink"
            >
              <LogoMark className="size-10 shrink-0" />
              YogaPriyanshi
            </a>
            <p className="text-sm leading-[1.5] text-ink-soft max-w-[30ch]">Yoga with Priyanshi in Dubai, UAE. In person and online.</p>
          </div>

          <Column title="Studio">
            <a href={sectionHref('contact')} onClick={section('contact')} className={LINK}>
              Contact
            </a>
            <button type="button" onClick={onOpenCancel} className={LINK}>
              Manage booking
            </button>
            {/* Only once an article is published: until then there is no public Guides page. */}
            {PUBLISHED_ARTICLES.length > 0 && (
              <a href={GUIDES_PATH} onClick={go(GUIDES_PATH)} className={LINK}>
                Guides
              </a>
            )}
            <button type="button" onClick={onOpenAdmin} className={LINK}>
              Studio admin
            </button>
          </Column>

          <Column title="Classes">
            <button type="button" onClick={onOpenBooking} className={LINK}>
              Book a trial class
            </button>
            <a href={sectionHref('schedule')} onClick={section('schedule')} className={LINK}>
              Schedule
            </a>
            <a href={sectionHref('pricing')} onClick={section('pricing')} className={LINK}>
              Pricing
            </a>
            <button type="button" onClick={onOpenClassFinder} className={LINK}>
              Find your class
            </button>
          </Column>

          <Column title="Legal">
            {LEGAL_LINKS.map((p) => (
              <a key={p.slug} href={p.path} onClick={go(p.path)} className={LINK}>
                {p.title}
              </a>
            ))}
            <button type="button" onClick={onOpenPrivacyChoices} className={LINK}>
              <PrivacyChoicesIcon className="w-[30px] h-[14px] shrink-0" />
              Your privacy choices
            </button>
          </Column>

          <Column title="Social">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
              Instagram
            </a>
          </Column>
        </div>

        <div className="pt-5 border-t border-line text-sm leading-[1.5] text-ink-soft">
          <p>© {new Date().getFullYear()} YogaPriyanshi · Dubai</p>
        </div>
      </div>
    </footer>
  );
}
