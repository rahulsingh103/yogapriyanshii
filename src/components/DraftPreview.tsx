import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { parseArticle, type Article } from '@/lib/article-md';
import { DRAFT_META } from '@/lib/article-meta';
import { setDocumentHead } from '@/lib/page-meta';
import { isPlainClick } from '@/hooks/use-route';
import { ArticleView, useArticleMount } from './ArticlePage';

interface DraftPreviewProps {
  /** Where the dev server serves the Markdown: /__drafts/<slug> (SHOW_DRAFTS=1) or the e2e fixture. */
  source: string;
  focusHeading: boolean;
  onReady: () => void;
  onNavigateHome: (sectionId?: string) => void;
  /** What to show for a missing article: App's lazy NotFound (kept in its own chunk). */
  missing: ReactNode;
  onBook: () => void;
  onAsk: (interest: string) => void;
  onOpenQuiz: () => void;
}

/** A plain line, not a live region: it is there from the start, not an update. */
const DRAFT_BANNER = 'Draft, not published. Not yet reviewed by Priyanshi.';

type Loaded = { state: 'loading' } | { state: 'ready'; article: Article } | { state: 'missing' };

/**
 * DEV ONLY. App imports this behind `import.meta.env.DEV`, so it is never in a build. It shows a draft
 * from content-drafts/ (outside the repo) exactly as the article page would, under a
 * "Draft, not published. Not yet reviewed by Priyanshi." banner, so the owner can review it before Priyanshi signs it off.
 */
export function DraftPreview({ source, focusHeading, onReady, onNavigateHome, missing, onBook, onAsk, onOpenQuiz }: DraftPreviewProps) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    setDocumentHead(DRAFT_META);
    fetch(source, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`draft ${res.status}`);
        const article = parseArticle(await res.text());
        if (live) setLoaded({ state: 'ready', article });
      })
      .catch(() => live && setLoaded({ state: 'missing' }));
    return () => {
      live = false;
    };
  }, [source]);

  const headingRef = useArticleMount(loaded.state === 'ready', focusHeading, onReady);

  if (loaded.state === 'missing') return missing;
  if (loaded.state === 'loading') return <main className="flex-1" />;

  const onBack = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigateHome();
  };

  return (
    <ArticleView
      article={loaded.article}
      banner={DRAFT_BANNER}
      back={{ href: '/', label: 'Back to the homepage', onClick: onBack }}
      headingRef={headingRef}
      onBook={onBook}
      onAsk={onAsk}
      onOpenQuiz={onOpenQuiz}
    />
  );
}
