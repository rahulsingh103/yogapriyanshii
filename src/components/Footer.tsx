import type { MouseEvent } from 'react';
import { Instagram } from 'lucide-react';
import { INSTAGRAM_URL } from '@/constants/contact';
import { PUBLISHED_ARTICLES } from '@/content/articles';
import { GUIDES_PATH } from '@/lib/route';
import { isPlainClick } from '@/hooks/use-route';

interface FooterProps {
  onOpenCancel: () => void;
  onOpenAdmin: () => void;
  /** False on a class page or the 404: the wordmark then goes home in the app. */
  isHome?: boolean;
  onNavigateHome?: (sectionId?: string) => void;
  /** In-app navigation (the Guides link). */
  onNavigate?: (path: string) => void;
}

const QUIET_BUTTON =
  'inline-flex items-center min-h-11 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft hover:text-ink transition-colors duration-200';

export function Footer({ onOpenCancel, onOpenAdmin, isHome = true, onNavigateHome, onNavigate }: FooterProps) {
  const goGuides = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || !isPlainClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigate(GUIDES_PATH);
  };
  const goHome = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isHome || !onNavigateHome || !isPlainClick(e)) return;
    e.preventDefault();
    // Lenis (anchors: true) listens on window: it must not start its own smooth scroll.
    e.stopPropagation();
    onNavigateHome();
  };
  return (
    <footer className="border-t border-line">
      <div className="max-w-[1040px] mx-auto px-5 py-16 flex flex-col gap-12">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
          <div className="flex flex-col gap-3">
            <a href={isHome ? '#home' : '/'} onClick={goHome} className="self-start inline-flex items-center min-h-11 font-display text-2xl leading-none text-ink">
              YogaPriyanshi
            </a>
            <p className="text-sm leading-[1.5] text-ink-soft">Dubai, UAE · In person &amp; online</p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start inline-flex items-center gap-2 min-h-11 text-sm text-ink-soft hover:text-ink transition-colors duration-200"
            >
              <Instagram className="size-4 text-accent-text" aria-hidden="true" />
              @yogapriyanshi
            </a>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1">
            {/* Only once an article is published: until then there is no public Guides page. */}
            {PUBLISHED_ARTICLES.length > 0 && (
              <a href={GUIDES_PATH} onClick={goGuides} className={QUIET_BUTTON}>
                Guides
              </a>
            )}
            <button type="button" onClick={onOpenCancel} className={QUIET_BUTTON}>
              Manage booking
            </button>
            <button type="button" onClick={onOpenAdmin} className={QUIET_BUTTON}>
              Studio admin
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-line text-sm leading-[1.5] text-ink-soft">
          <p>© {new Date().getFullYear()} YogaPriyanshi · Dubai</p>
        </div>
      </div>
    </footer>
  );
}
