import { useEffect, useState, type MouseEvent } from 'react';
import { PUBLISHED_ARTICLES, loadArticle } from '@/content/articles';
import { parseArticle, type ArticleMeta } from '@/lib/article-md';
import { GUIDES_META } from '@/lib/article-meta';
import { setDocumentHead } from '@/lib/page-meta';
import { articlePath } from '@/lib/route';
import { isPlainClick } from '@/hooks/use-route';
import { cn } from '@/lib/utils';
import { useArticleMount } from './ArticlePage';

const FOCUS_HEADING =
  'focus-visible:outline-none focus-visible:underline focus-visible:decoration-line-strong focus-visible:decoration-1 focus-visible:underline-offset-[6px]';

interface GuidesIndexProps {
  focusHeading: boolean;
  onReady: () => void;
  onNavigate: (path: string) => void;
}

type Entry = { slug: string; meta: ArticleMeta };

/** DESIGN_SYSTEM "Guides": the published articles, newest first. Only routed once one is published. */
export function GuidesIndex({ focusHeading, onReady, onNavigate }: GuidesIndexProps) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState<Error | null>(null);

  useEffect(() => {
    let live = true;
    setDocumentHead(GUIDES_META);
    Promise.all(
      PUBLISHED_ARTICLES.map(async (slug) => ({ slug, meta: parseArticle((await loadArticle(slug)) ?? '').meta }))
    )
      .then((list) => {
        if (!live) return;
        setEntries(
          list
            .filter((e) => e.meta.status === 'published')
            .sort((a, b) => (b.meta.published ?? '').localeCompare(a.meta.published ?? ''))
        );
      })
      .catch((e: Error) => live && setFailed(e));
    return () => {
      live = false;
    };
  }, []);

  const headingRef = useArticleMount(entries !== null, focusHeading, onReady);
  if (failed) throw failed;
  if (!entries) return <main className="flex-1" />;

  const go = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigate(path);
  };

  return (
    <main className="flex-1">
      <section
        aria-labelledby="guides-title"
        className="max-w-[680px] mx-auto px-5 pt-24 pb-24 lg:pt-32 lg:pb-32 flex flex-col gap-8"
      >
        <h1
          id="guides-title"
          ref={headingRef}
          tabIndex={-1}
          className={cn('font-display font-normal text-h2 text-ink text-balance', FOCUS_HEADING)}
        >
          Guides
        </h1>
        <p className="text-base leading-[1.6] text-ink-soft max-w-[64ch]">{GUIDES_META.description}</p>
        <ul className="flex flex-col border-t border-line">
          {entries.map((entry) => (
            <li key={entry.slug} className="border-b border-line">
              <a
                href={articlePath(entry.slug)}
                onClick={go(articlePath(entry.slug))}
                className="flex flex-col gap-2 py-6 min-h-11 group"
              >
                <h2 className="font-display text-h4 text-ink text-balance underline decoration-transparent underline-offset-4 group-hover:decoration-line-strong transition-colors duration-200">
                  {entry.meta.title}
                </h2>
                <span className="text-base leading-[1.6] text-ink-soft max-w-[64ch]">{entry.meta.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
