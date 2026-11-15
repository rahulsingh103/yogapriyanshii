import { useEffect, type MouseEvent } from 'react';
import { useLenis } from 'lenis/react';
import { legalMeta, setDocumentHead } from '@/lib/page-meta';
import { isPlainClick } from '@/hooks/use-route';
import { LEGAL_PAGES, legalPage, type LegalSlug } from '@/constants/legal';
import { LEGAL_CLASSES as C, legalMenuClass } from '@/lib/legal-classes';

interface LegalPageProps {
  slug: LegalSlug;
  /** Called once mounted, so the preloader can fade. */
  onReady: () => void;
  /** In-app navigation between the legal pages. */
  onNavigate: (path: string) => void;
}

/** The legal pages (src/constants/legal.ts): the menu on the left, the page on the right. Same markup as its prerendered HTML. */
export function LegalPage({ slug, onReady, onNavigate }: LegalPageProps) {
  const lenis = useLenis();
  const page = legalPage(slug);

  useEffect(() => {
    setDocumentHead(legalMeta(page));
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    // Phones: the menu is a sideways row of tabs, so bring the current one into view.
    document.querySelector('nav[aria-label="Legal pages"] [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    onReady();
    // On mount and on each page change.
  }, [slug]);

  const go = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigate(path);
  };

  return (
    <main className="flex-1">
      <div className={C.wrap}>
        <nav aria-label="Legal pages" className={C.nav}>
          <p className={C.navTitle}>Legal</p>
          <ul className={C.navList}>
            {LEGAL_PAGES.map((p) => (
              <li key={p.slug}>
                <a
                  href={p.path}
                  onClick={go(p.path)}
                  aria-current={p.slug === slug ? 'page' : undefined}
                  className={legalMenuClass(p.slug === slug)}
                >
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <article className={C.article}>
          <h1 className={C.h1}>{page.title}</h1>
          <p className={C.p}>{page.intro}</p>
          {page.sections.map((s) => (
            <section key={s.heading} className={C.section}>
              <h2 className={C.h2}>{s.heading}</h2>
              {s.items && (
                <ul className={C.list}>
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
              {s.paragraphs?.map((p) => (
                <p key={p} className={C.p}>
                  {p}
                </p>
              ))}
            </section>
          ))}
          <p className={C.updated}>Last updated {page.updated}</p>
        </article>
      </div>
    </main>
  );
}
