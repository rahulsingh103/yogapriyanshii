/**
 * Node only (vite.config.ts and server.ts): reads the PUBLISHED articles in src/content/articles/.
 * Never import it from the app, and never point it at the drafts folder: drafts live outside the
 * repo (content-drafts/) and only the dev server's `/__drafts` route, behind SHOW_DRAFTS=1, reads them.
 *
 * Every file here must be approved: `status: published`, a `published` date and `reviewedBy`, and no
 * unverified source left ("(link to verify)" or "URL to confirm"), or the build fails rather than ship
 * an unreviewed article.
 */
import fs from 'fs';
import path from 'path';
import { parseArticle, type Article } from './article-md';

export interface PublishedArticle {
  slug: string;
  article: Article;
}

const SLUG = /^[a-z0-9-]{1,60}$/;
/** The drafts' markers for a source nobody has checked yet. */
const UNVERIFIED = ['(link to verify)', 'URL to confirm'];

/** The published articles, newest first. An empty or missing folder is fine (none published yet). */
export function readPublishedArticles(dir: string): PublishedArticle[] {
  if (!fs.existsSync(dir)) return [];
  const list = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.slice(0, -3);
      if (!SLUG.test(slug)) throw new Error(`articles: "${f}" is not a valid slug (a-z, 0-9 and dashes)`);
      const md = fs.readFileSync(path.join(dir, f), 'utf-8');
      const article = parseArticle(md);
      const { status, published, reviewedBy } = article.meta;
      if (status !== 'published' || !published || !reviewedBy.trim())
        throw new Error(`articles: "${f}" needs status: published, a published date and reviewedBy before it can ship`);
      // Every source must be checked before it ships: the drafts mark each unchecked one.
      if (UNVERIFIED.some((marker) => md.includes(marker)))
        throw new Error(`articles: "${f}" still has unverified sources ("(link to verify)" or "URL to confirm")`);
      return { slug, article };
    });
  return list.sort((a, b) => (b.article.meta.published ?? '').localeCompare(a.article.meta.published ?? ''));
}
