/**
 * The published articles ("Guides"). Each one is a Markdown file in ./articles/ (format: src/lib/article-md.ts),
 * added only after Priyanshi has approved it in writing (content-drafts/README.md in the workspace has the
 * steps). The folder holds only .gitkeep today, so nothing is public and the footer shows no Guides link.
 *
 * Lazy: only the slugs are in the homepage bundle; each article's text is its own chunk, loaded by
 * ArticlePage or GuidesIndex. Drafts are never here: they stay outside the repo.
 */
const loaders = import.meta.glob('./articles/*.md', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;

const slugOf = (key: string) => key.replace(/^\.\/articles\//, '').replace(/\.md$/, '');

/** The published slugs, in file order (GuidesIndex sorts by date). */
export const PUBLISHED_ARTICLES: ReadonlyArray<string> = Object.keys(loaders).map(slugOf);

/** The raw Markdown of a published article, or null for an unknown slug. */
export function loadArticle(slug: string): Promise<string> | null {
  const load = loaders[`./articles/${slug}.md`];
  return load ? load() : null;
}
