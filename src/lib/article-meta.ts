/**
 * The head metadata for the Guides pages. Kept out of page-meta.ts on purpose: only the lazy article
 * chunks (ArticlePage, GuidesIndex, the dev draft preview), route-html.ts and the build import it, so
 * none of it is in the homepage bundle. Pure: relative imports only, no `@/` alias and no `import.meta.env`.
 */
import type { PageMeta } from './page-meta';

/** The Guides index (only served once an article is published). */
export const GUIDES_META: PageMeta = {
  title: 'Guides · YogaPriyanshi',
  description: 'Short, practical guides to starting and enjoying yoga, from Priyanshi in Dubai.',
  path: '/guides',
};

/** A published article: its own title and description, canonical at /guides/<slug>. */
export const articleMeta = (path: string, article: { title: string; description: string }): PageMeta => ({
  title: `${article.title} · YogaPriyanshi`,
  description: article.description,
  path,
});

/** The dev-only draft preview: never indexed, no canonical, and none of the draft's own text in the head. */
export const DRAFT_META: PageMeta = {
  title: 'Draft preview · YogaPriyanshi',
  description: 'A draft that is not published.',
  path: null,
  noindex: true,
};
