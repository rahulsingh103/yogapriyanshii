import { useEffect, type MouseEvent } from 'react';
import { useLenis } from 'lenis/react';
import { NOT_FOUND_META, setDocumentHead } from '@/lib/page-meta';
import { isPlainClick } from '@/hooks/use-route';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';

interface NotFoundProps {
  /** Called once mounted, so the preloader can fade (P3). */
  onReady: () => void;
  /** Goes home in the app, then to the section if one is given. */
  onNavigateHome: (sectionId?: string) => void;
}

/** DESIGN_SYSTEM "Not found": a heading, one line and two ways back. Served with a 404 status. */
export function NotFound({ onReady, onNavigateHome }: NotFoundProps) {
  const lenis = useLenis();

  useEffect(() => {
    setDocumentHead(NOT_FOUND_META);
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    onReady();
    // Once, on mount.
  }, []);

  const go = (sectionId?: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    // Lenis (anchors: true) listens on window: it must not start its own smooth scroll to "/#classes".
    e.stopPropagation();
    onNavigateHome(sectionId);
  };

  return (
    <main className="flex-1">
      <section
        aria-labelledby="not-found-title"
        className="max-w-[640px] mx-auto px-5 pt-32 pb-24 lg:pb-32 flex flex-col items-start gap-6"
      >
        <h1 id="not-found-title" className="font-display font-normal text-h2 text-ink text-balance">
          Page not found
        </h1>
        <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">This page has moved or never existed.</p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <a href="/" onClick={go()} className={cn(ui.primary, 'w-full sm:w-auto')}>
            Back to the homepage
          </a>
          <a href="/#classes" onClick={go('classes')} className={cn(ui.secondary, 'w-full sm:w-auto')}>
            See all classes
          </a>
        </div>
      </section>
    </main>
  );
}
