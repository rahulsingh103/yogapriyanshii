/**
 * The article ("Guides") format: front matter plus a small Markdown subset, parsed into plain data.
 * Shared by the client (ArticlePage, the dev draft preview), the build (vite.config.ts, through
 * article-files.ts) and the dev server. Pure: relative imports only, no `@/` alias, no
 * `import.meta.env` and no DOM.
 *
 * It returns structured blocks, never HTML: whoever renders them escapes the text (React does it for
 * free; route-html.ts uses escapeHtml). Supported:
 *   ---                       front matter: `key: value` lines (title, description, status,
 *   title: …                  reviewedBy, published, and optionally action and interest),
 *   ---                       values optionally in quotes
 *   ## Heading                section headings (h2 only; the title is the page's h1)
 *   A paragraph …             lines up to a blank line join into one paragraph
 *   - A bullet                list items (a following indented line continues the item)
 *   - Label: the rest         a short lead-in up to the first colon (or `**Label.**`) is the item's label
 *   [text](https://…)         links, https only; anything else stays as plain text
 *
 * `## Sources` is special: its heading and list are marked `sources` (rendered smaller, no labels).
 * `action: ask` with `interest: <a contact interest>` turns the page's actions into the on-request
 * pattern (ask about the class instead of booking it); the default is `book`.
 * Error messages name the problem and, for a bad line, its number; never the line's text.
 */
import { CONTACT_INTERESTS } from '../../backend/validate';

export type Inline = { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

/** A bullet: an optional short label (with its own punctuation, e.g. "Cat-cow:") and the rest. */
export interface ListItem {
  label: string | null;
  inlines: Inline[];
}

export type Block =
  | { kind: 'heading'; text: string; id: string; sources: boolean }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'list'; items: ListItem[]; sources: boolean };

export type ArticleStatus = 'draft' | 'published';

/** What the page's actions offer: a free class (default) or, for an on-request class, a message. */
export type ArticleAction = 'book' | 'ask';

export interface ArticleMeta {
  title: string;
  description: string;
  status: ArticleStatus;
  /** Empty until Priyanshi has approved the article in writing. */
  reviewedBy: string;
  /** ISO date (YYYY-MM-DD) once published; null for a draft. */
  published: string | null;
  action: ArticleAction;
  /** The contact form's preset interest for `action: ask` (one of backend/validate.ts CONTACT_INTERESTS). */
  interest: string | null;
}

export interface Article {
  meta: ArticleMeta;
  blocks: Block[];
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `Label: rest`: up to 48 characters before the first colon, with no double quotes, brackets or emphasis. */
const COLON_LABEL = /^([^:"“”[\]()*]{1,48}:)\s+(\S[\s\S]*)$/;
/** `**Label.** rest` or `**Label:** rest`. */
const BOLD_LABEL = /^\*\*([^*\n]{1,48}[.:])\*\*\s+(\S[\s\S]*)$/;
const SOURCES_HEADING = 'Sources';

/** True for an absolute https: URL, the only kind of link an article may carry. */
export function isSafeHref(href: string): boolean {
  if (!href.startsWith('https://')) return false;
  try {
    return new URL(href).protocol === 'https:';
  } catch {
    return false;
  }
}

/** A heading's anchor id: lowercase words joined by dashes. */
export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';

const unquote = (s: string) => {
  const v = s.trim();
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v;
};

/** Text with `[label](url)` links. A link that isn't https keeps its label as plain text and loses the URL. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const push = (part: Inline) => {
    const last = out[out.length - 1];
    if (part.kind === 'text' && last?.kind === 'text') last.text += part.text;
    else if (part.kind === 'link' || part.text) out.push(part);
  };
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    push({ kind: 'text', text: text.slice(at, m.index) });
    const [, label, href] = m;
    push(isSafeHref(href) ? { kind: 'link', text: label, href } : { kind: 'text', text: label });
    at = m.index! + m[0].length;
  }
  push({ kind: 'text', text: text.slice(at) });
  return out;
}

/** Splits the front matter from the body. Throws if there is none. */
export function splitFrontMatter(md: string): { fields: Record<string, string>; body: string } {
  const m = md.replace(/^﻿/, '').match(FRONT_MATTER);
  if (!m) throw new Error('article: front matter (--- … ---) is missing');
  const fields: Record<string, string> = {};
  for (const [n, line] of m[1].split(/\r?\n/).entries()) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    // The line number only (counting the opening ---), never the line itself.
    if (colon < 1) throw new Error(`article: bad front matter on line ${n + 2}`);
    fields[line.slice(0, colon).trim()] = unquote(line.slice(colon + 1));
  }
  return { fields, body: md.replace(/^﻿/, '').slice(m[0].length) };
}

function parseMeta(fields: Record<string, string>): ArticleMeta {
  const title = fields.title ?? '';
  const description = fields.description ?? '';
  const status = fields.status;
  if (!title) throw new Error('article: title is required');
  if (!description) throw new Error('article: description is required');
  if (status !== 'draft' && status !== 'published') throw new Error('article: status must be draft or published');
  const published = fields.published ? fields.published : null;
  if (published !== null && !DATE.test(published)) throw new Error('article: published must be YYYY-MM-DD');
  const action = fields.action || 'book';
  if (action !== 'book' && action !== 'ask') throw new Error('article: action must be book or ask');
  const interest = fields.interest || null;
  if (action === 'ask' && !interest) throw new Error('article: action: ask needs an interest');
  if (interest !== null && action !== 'ask') throw new Error('article: interest is only for action: ask');
  if (interest !== null && !(CONTACT_INTERESTS as ReadonlyArray<string>).includes(interest))
    throw new Error('article: interest must be one of the contact interests (backend/validate.ts)');
  return { title, description, status, reviewedBy: fields.reviewedBy ?? '', published, action, interest };
}

/** A bullet's label, if it starts with one ("Label: …" or "**Label.** …"). Sources never get one. */
export function parseListItem(text: string, sources = false): ListItem {
  const m = sources ? null : text.match(BOLD_LABEL) ?? text.match(COLON_LABEL);
  return m ? { label: m[1].trim(), inlines: parseInline(m[2]) } : { label: null, inlines: parseInline(text) };
}

/** The body's blocks, in order. */
export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let items: string[] | null = null;
  let sources = false;
  const ids = new Set<string>();

  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', inlines: parseInline(para.join(' ')) });
    if (items?.length) blocks.push({ kind: 'list', items: items.map((t) => parseListItem(t, sources)), sources });
    para = [];
    items = null;
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      const text = line.slice(3).trim();
      let id = headingId(text);
      for (let n = 2; ids.has(id); n++) id = `${headingId(text)}-${n}`;
      ids.add(id);
      sources = text === SOURCES_HEADING;
      blocks.push({ kind: 'heading', text, id, sources });
      continue;
    }
    if (line.startsWith('- ')) {
      if (para.length) flush();
      (items ??= []).push(line.slice(2).trim());
      continue;
    }
    // An indented line right after a bullet continues it; any other line is paragraph text.
    if (items?.length && /^\s/.test(raw)) {
      items[items.length - 1] += ` ${line}`;
      continue;
    }
    if (items) flush();
    para.push(line);
  }
  flush();
  return blocks;
}

/** Parses a whole article file. Throws on missing or invalid front matter. */
export function parseArticle(md: string): Article {
  const { fields, body } = splitFrontMatter(md);
  return { meta: parseMeta(fields), blocks: parseBlocks(body) };
}

/** The plain text of some inlines (link labels included). */
export const inlineText = (inlines: Inline[]) => inlines.map((i) => i.text).join('');

/** A bullet's plain text, its label included ("Label: the rest"). */
export const itemText = (item: ListItem) => (item.label ? `${item.label} ` : '') + inlineText(item.inlines);
