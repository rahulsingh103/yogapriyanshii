import { useCallback, useEffect, useState } from 'react';
import { PUBLISHED_ARTICLES } from '@/content/articles';
import { resolveRoute, type Route } from '@/lib/route';

/**
 * Draft previews exist only in dev, and only when the dev server was started with SHOW_DRAFTS=1 (it then
 * adds `<meta name="yp-drafts" content="on">`). In a build `import.meta.env.DEV` is false, so this, the
 * draft route and the preview component are all dropped from the bundle (P7).
 */
export const draftsEnabled = () =>
  import.meta.env.DEV && !!document.querySelector('meta[name="yp-drafts"][content="on"]');

/**
 * DEV ONLY: where the draft preview loads its Markdown, or null. A draft route (SHOW_DRAFTS=1) reads
 * `/__drafts/<slug>`; the e2e test page `/__test/article` (APP_ENV=test only, flagged by the server with
 * `<meta name="yp-test-article">`) reads a synthetic lorem fixture (P9). Always null in a build.
 */
export function devPreviewSource(pathname: string, route: Route): string | null {
  if (!import.meta.env.DEV) return null;
  if (route.kind === 'draft' && draftsEnabled()) return `/__drafts/${route.slug}`;
  if (pathname === '/__test/article' && document.querySelector('meta[name="yp-test-article"][content="on"]'))
    return '/__test/article.md';
  return null;
}

/** Every pathname resolves with the published articles and (dev only) the draft flag. */
export const routeFor = (pathname: string): Route =>
  resolveRoute(pathname, { publishedArticles: PUBLISHED_ARTICLES, drafts: draftsEnabled() });

/** What App needs to restore home after Back: where the page was and which class card was used. */
export interface HomeHistoryState {
  yp: 'home';
  y: number;
  cardSlug: string | null;
}

/** A page reached in the app. `from: 'home'` means Back lands on our home page (P13: never the referrer). */
export interface PageHistoryState {
  yp: 'class' | 'page';
  from: 'home' | 'other';
}

export type NavigationKind = 'initial' | 'push' | 'pop';

export interface RouteState {
  pathname: string;
  route: Route;
  /** How we got here: a direct load, an in-app link, or Back / Forward. */
  kind: NavigationKind;
  /** Bumps on every navigation, so effects re-run even when the path repeats. */
  key: number;
}

export const homeHistoryState = (): HomeHistoryState | null => {
  const state = window.history.state as Partial<HomeHistoryState> | null;
  return state?.yp === 'home' ? (state as HomeHistoryState) : null;
};

export const pageHistoryState = (): PageHistoryState | null => {
  const state = window.history.state as Partial<PageHistoryState> | null;
  return state?.yp === 'class' || state?.yp === 'page' ? (state as PageHistoryState) : null;
};

let manualRestoration = false;

/**
 * The current route, from the pathname, kept in sync with Back and Forward. `navigate(path)` is an
 * in-app link: it first saves the home scroll position and card in the home entry (replaceState),
 * then pushes the new page with a marker that says where it came from.
 */
export function useRoute() {
  const [state, setState] = useState<RouteState>(() => ({
    pathname: window.location.pathname,
    route: routeFor(window.location.pathname),
    kind: 'initial',
    key: 0,
  }));

  useEffect(() => {
    const onPop = () =>
      setState((prev) =>
        // An in-page hash link (#schedule on home) also fires popstate: same page, the browser scrolls.
        prev.pathname === window.location.pathname
          ? prev
          : {
              pathname: window.location.pathname,
              route: routeFor(window.location.pathname),
              kind: 'pop',
              key: prev.key + 1,
            }
      );
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((path: string, { cardSlug = null }: { cardSlug?: string | null } = {}) => {
    // Only once we manage history ourselves: a direct load keeps the browser's own restoration.
    if (!manualRestoration && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
      manualRestoration = true;
    }
    const fromHome = routeFor(window.location.pathname).kind === 'home';
    if (fromHome) {
      const home: HomeHistoryState = { yp: 'home', y: window.scrollY, cardSlug };
      window.history.replaceState(home, '', window.location.pathname);
    }
    const target = routeFor(new URL(path, window.location.origin).pathname);
    const next: PageHistoryState | HomeHistoryState =
      target.kind === 'home'
        ? { yp: 'home', y: 0, cardSlug: null }
        : { yp: target.kind === 'class' ? 'class' : 'page', from: fromHome ? 'home' : 'other' };
    window.history.pushState(next, '', path);
    setState((prev) => ({
      pathname: window.location.pathname,
      route: routeFor(window.location.pathname),
      kind: 'push',
      key: prev.key + 1,
    }));
  }, []);

  return { ...state, navigate };
}

/** A plain left click that we can take over (no modifier keys, no new tab). */
export const isPlainClick = (e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
