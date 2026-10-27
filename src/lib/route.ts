/**
 * Which page a path is. Shared by the client (App), the dev server (server.ts) and the build
 * (vite.config.ts), so all three agree on every URL. Pure: relative imports only, no `@/` alias
 * and no `import.meta.env`.
 */
import { PRACTICE_CLASSES } from '../constants/classes';

export type Route =
  | { kind: 'home' }
  | { kind: 'class'; slug: string }
  | { kind: 'article'; slug: string }
  | { kind: 'draft'; slug: string }
  | { kind: 'notFound' };

export interface RouteOptions {
  /** Slugs of the published articles (none yet: articles stay hidden until Priyanshi approves them). */
  publishedArticles?: ReadonlyArray<string>;
  /** Dev-only draft previews. Never true in a build. */
  drafts?: boolean;
}

/** The class page slugs, in carousel order. */
export const CLASS_SLUGS: ReadonlyArray<string> = PRACTICE_CLASSES.map((c) => c.slug);

const SLUG = /^[a-z0-9-]{1,60}$/;

export const classPath = (slug: string) => `/classes/${slug}`;

/**
 * Resolves a pathname (no query or hash). A trailing slash (or a trailing `/index.html`, the file a
 * static host serves) is fine; slugs match exactly, so `/classes/Hatha` is notFound.
 */
export function resolveRoute(pathname: string, { publishedArticles = [], drafts = false }: RouteOptions = {}): Route {
  if (pathname === '/' || pathname === '/index.html') return { kind: 'home' };
  const path = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  const [, section, slug, ...rest] = path.split('/');
  if (rest.length > 0 || !slug || !SLUG.test(slug)) return { kind: 'notFound' };
  if (section === 'classes' && CLASS_SLUGS.includes(slug)) return { kind: 'class', slug };
  if (section === 'guides' && publishedArticles.includes(slug)) return { kind: 'article', slug };
  if (section === 'drafts' && drafts) return { kind: 'draft', slug };
  return { kind: 'notFound' };
}
