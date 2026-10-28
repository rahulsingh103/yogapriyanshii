import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { useLenis } from 'lenis/react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowLeft } from '@/components/animate-ui/icons/arrow-left';
import { loadArticle } from '@/content/articles';
import { CLASS_PAGE_ON_REQUEST_LINE } from '@/constants/on-request';
import { parseArticle, type Article, type Inline, type ListItem } from '@/lib/article-md';
import { articleMeta } from '@/lib/article-meta';
import { setDocumentHead } from '@/lib/page-meta';
import { GUIDES_PATH, articlePath } from '@/lib/route';
import { isPlainClick } from '@/hooks/use-route';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';

const FOCUS_HEADING =
  'focus-visible:outline-none focus-visible:underline focus-visible:decoration-line-strong focus-visible:decoration-1 focus-visible:underline-offset-[6px]';
const LINK = 'underline underline-offset-4 decoration-line-strong hover:decoration-ink text-ink transition-colors duration-200';
/** Long-form reading: the FAQ's 64ch measure, not the 46ch body measure (DESIGN_SYSTEM "Article page"). */
const PROSE = 'text-base leading-[1.6] text-ink-soft max-w-[64ch]';
/** The Sources list: a step quieter than the article (DESIGN_SYSTEM "Article page"). */
const SOURCES = 'text-sm leading-[1.5] text-ink-soft max-w-[64ch]';
/** The closing line of a bookable article; an on-request one (`action: ask`) uses the class pages' line. */
const BOOK_LINE = 'Your first class with Priyanshi is free, in person in Dubai or live online.';

export interface ArticleViewProps {
  article: Article;
  /** The dev draft preview's banner; never shown on a published article. */
  banner?: string;
  back: { href: string; label: string; onClick: (e: MouseEvent<HTMLAnchorElement>) => void };
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onBook: () => void;
  /** `action: ask`: opens Contact with the article's interest. */
  onAsk: (interest: string) => void;
  onOpenQuiz: () => void;
}

function InlineText({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((part, i) =>
        part.kind === 'link' ? (
          // Sources open in a new tab; article-md only lets https: links through.
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {part.text}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/** A bullet: its label (if any) in `ink`, then the rest. */
function ItemText({ item }: { item: ListItem }) {
  return (
    <>
      {item.label && <span className="font-medium text-ink">{item.label} </span>}
      <InlineText inlines={item.inlines} />
    </>
  );
}

/**
 * DESIGN_SYSTEM "Article page": one guide, in a narrow reading column. Plain blocks from article-md.ts,
 * rendered as text (React escapes it); no raw HTML ever reaches the page.
 */
export function ArticleView({ article, banner, back, headingRef, onBook, onAsk, onOpenQuiz }: ArticleViewProps) {
  const { meta, blocks } = article;
  const ask = meta.action === 'ask' && meta.interest ? meta.interest : null;
  return (
    <main className="flex-1">
      <article
        aria-labelledby="article-title"
        className="max-w-[680px] mx-auto px-5 pt-24 pb-24 lg:pt-32 lg:pb-32 flex flex-col gap-8"
      >
        {banner && (
          <p data-testid="draft-banner" className={cn(ui.notice, 'self-start')}>
            {banner}
          </p>
        )}
        <AnimateIcon animateOnHover asChild>
          <a
            href={back.href}
            onClick={back.onClick}
            className="self-start inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-ink-soft hover:text-ink transition-colors duration-200"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {back.label}
          </a>
        </AnimateIcon>

        <header className="flex flex-col gap-4">
          <h1
            id="article-title"
            ref={headingRef}
            tabIndex={-1}
            className={cn('font-display font-normal text-h2 text-ink text-balance', FOCUS_HEADING)}
          >
            {meta.title}
          </h1>
          <p className="text-base leading-[1.6] text-ink max-w-[64ch]">{meta.description}</p>
        </header>

        <div data-testid="article-body" className="flex flex-col gap-6 pt-8 border-t border-line">
          {blocks.map((block, i) => {
            if (block.kind === 'heading')
              return block.sources ? (
                <h2 key={i} id={block.id} className={cn(ui.eyebrow, 'pt-4')}>
                  {block.text}
                </h2>
              ) : (
                <h2 key={i} id={block.id} className="pt-4 font-display font-normal text-h4 text-ink text-balance">
                  {block.text}
                </h2>
              );
            if (block.kind === 'list' && block.sources)
              return (
                <ul key={i} data-testid="article-sources" className={cn('flex flex-col gap-2', SOURCES)}>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <ItemText item={item} />
                    </li>
                  ))}
                </ul>
              );
            if (block.kind === 'list')
              return (
                <ul key={i} className="flex flex-col gap-2 max-w-[64ch]">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-3 text-base leading-[1.6] text-ink-soft">
                      <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-accent" />
                      <span>
                        <ItemText item={item} />
                      </span>
                    </li>
                  ))}
                </ul>
              );
            return (
              <p key={i} className={PROSE}>
                <InlineText inlines={block.inlines} />
              </p>
            );
          })}
        </div>

        <section
          id="article-actions"
          aria-label="Try a class"
          className="flex flex-col gap-4 pt-6 border-t border-line"
        >
          <p className={PROSE}>{ask ? CLASS_PAGE_ON_REQUEST_LINE : BOOK_LINE}</p>
          <div className="flex flex-wrap gap-3">
            {ask ? (
              <button type="button" onClick={() => onAsk(ask)} className={cn(ui.primary, 'w-full sm:w-auto whitespace-nowrap')}>
                Ask about this class
              </button>
            ) : (
              <button type="button" onClick={onBook} className={cn(ui.primary, 'w-full sm:w-auto whitespace-nowrap')}>
                Book a free class
              </button>
            )}
            <button type="button" onClick={onOpenQuiz} className={cn(ui.secondary, 'w-full sm:w-auto whitespace-nowrap')}>
              Take the 30-second quiz
            </button>
          </div>
        </section>
      </article>
    </main>
  );
}

/** Scroll to the top, then (in-app only) focus the title. The same hand-off as ClassPage (P14). */
export function useArticleMount(ready: boolean, focusHeading: boolean, onReady: () => void) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lenis = useLenis();
  useEffect(() => {
    if (!ready) return;
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    if (focusHeading) headingRef.current?.focus({ preventScroll: true });
    onReady();
    // Once, when the content is there.
  }, [ready]);
  return headingRef;
}

interface ArticlePageProps {
  slug: string;
  focusHeading: boolean;
  onReady: () => void;
  onNavigate: (path: string) => void;
  onNavigateHome: (sectionId?: string) => void;
  /** What to show for a missing article: App's lazy NotFound (kept in its own chunk). */
  missing: ReactNode;
  onBook: () => void;
  onAsk: (interest: string) => void;
  onOpenQuiz: () => void;
}

type Loaded = { state: 'loading' } | { state: 'ready'; article: Article } | { state: 'missing' };

/** A published guide at /guides/<slug>. Its text is its own chunk (src/content/articles.ts). */
export function ArticlePage({ slug, focusHeading, onReady, onNavigate, onNavigateHome, missing, onBook, onAsk, onOpenQuiz }: ArticlePageProps) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [failed, setFailed] = useState<Error | null>(null);

  useEffect(() => {
    let live = true;
    const load = loadArticle(slug);
    if (!load) {
      setLoaded({ state: 'missing' });
      return;
    }
    load
      .then((md) => {
        if (!live) return;
        const article = parseArticle(md);
        if (article.meta.status !== 'published') return setLoaded({ state: 'missing' });
        setDocumentHead(articleMeta(articlePath(slug), article.meta));
        setLoaded({ state: 'ready', article });
      })
      // A failed chunk goes to the page's error boundary (one reload, then the calm message).
      .catch((e: Error) => live && setFailed(e));
    return () => {
      live = false;
    };
  }, [slug]);

  const headingRef = useArticleMount(loaded.state === 'ready', focusHeading, onReady);

  if (failed) throw failed;
  if (loaded.state === 'missing') return missing;
  if (loaded.state === 'loading') return <main className="flex-1" />;

  const onBack = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    e.stopPropagation();
    onNavigate(GUIDES_PATH);
  };

  return (
    <ArticleView
      article={loaded.article}
      back={{ href: GUIDES_PATH, label: 'All guides', onClick: onBack }}
      headingRef={headingRef}
      onBook={onBook}
      onAsk={onAsk}
      onOpenQuiz={onOpenQuiz}
    />
  );
}
