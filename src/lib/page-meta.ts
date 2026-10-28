/**
 * The <head> SEO block (title, description, Open Graph, Twitter, canonical) for every page. The build
 * and the dev server write it into the HTML (route-html.ts); the client updates it on in-app
 * navigation (setDocumentHead). Pure: relative imports only, no `@/` alias and no `import.meta.env`.
 *
 * HOME_META mirrors index.html's `<!-- seo:start -->` block exactly; the build fails if they drift.
 */

export const SITE_URL = 'https://www.yogapriyanshi.com';
const OG_IMAGE = `${SITE_URL}/og-image.jpg?v=3`;
const OG_IMAGE_ALT = 'YogaPriyanshi: Connect with your body. Yoga with Priyanshi in Dubai.';

export interface PageMeta {
  title: string;
  description: string;
  /** The page's path ("/classes/hatha"): its canonical and og:url. Null on the 404 page (no canonical). */
  path: string | null;
  /** The home page keeps its shorter Twitter line; every other page uses the description. */
  twitterDescription?: string;
  /** The 404 page only. */
  noindex?: boolean;
}

export const HOME_META: PageMeta = {
  title: 'YogaPriyanshi · Yoga in Dubai',
  description:
    'Yoga with Priyanshi in Dubai: Hatha, Barre, Wheel and Chakra Flow classes, in person or online. Your first class is free.',
  path: '/',
  twitterDescription: 'Yoga with Priyanshi in Dubai, in person or online. Your first class is free.',
};

export const NOT_FOUND_META: PageMeta = {
  title: 'Page not found · YogaPriyanshi',
  description: 'This page could not be found. See the classes and book a free first class with Priyanshi in Dubai.',
  path: null,
  noindex: true,
};

// The Guides metas (GUIDES_META, articleMeta, DRAFT_META) are in article-meta.ts, outside the homepage bundle.

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The SEO block as HTML lines (index.html's order and format), without the markers. Only the title,
 * description, og:url, canonical and the Twitter title and description change from page to page;
 * a page with no path drops og:url and the canonical and gets robots noindex.
 */
export function headTags(meta: PageMeta): string[] {
  const d = escapeAttr(meta.description);
  const t = escapeAttr(meta.title);
  const url = meta.path === null ? null : escapeAttr(absoluteUrl(meta.path));
  return [
    `<title>${escapeText(meta.title)}</title>`,
    `<meta name="description" content="${d}" />`,
    ...(meta.noindex ? ['<meta name="robots" content="noindex" />'] : []),
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="YogaPriyanshi" />',
    ...(url ? [`<meta property="og:url" content="${url}" />`] : []),
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:secure_url" content="${OG_IMAGE}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${OG_IMAGE_ALT}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.twitterDescription ?? meta.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:image:alt" content="${OG_IMAGE_ALT}" />`,
    ...(url ? [`<link rel="canonical" href="${url}" />`] : []),
  ];
}

/** Sets (or, with null, removes) one head element, matched by selector. */
function setHeadElement(selector: string, create: () => HTMLElement, attr: string, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (value === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

const metaEl = (key: 'name' | 'property', value: string) => () => {
  const el = document.createElement('meta');
  el.setAttribute(key, value);
  return el;
};

/** Client-side navigation: brings the live <head> in line with headTags(meta). */
export function setDocumentHead(meta: PageMeta) {
  document.title = meta.title;
  const url = meta.path === null ? null : absoluteUrl(meta.path);
  setHeadElement('meta[name="description"]', metaEl('name', 'description'), 'content', meta.description);
  setHeadElement('meta[name="robots"]', metaEl('name', 'robots'), 'content', meta.noindex ? 'noindex' : null);
  setHeadElement('meta[property="og:title"]', metaEl('property', 'og:title'), 'content', meta.title);
  setHeadElement('meta[property="og:description"]', metaEl('property', 'og:description'), 'content', meta.description);
  setHeadElement('meta[property="og:url"]', metaEl('property', 'og:url'), 'content', url);
  setHeadElement('meta[name="twitter:title"]', metaEl('name', 'twitter:title'), 'content', meta.title);
  setHeadElement(
    'meta[name="twitter:description"]',
    metaEl('name', 'twitter:description'),
    'content',
    meta.twitterDescription ?? meta.description
  );
  setHeadElement(
    'link[rel="canonical"]',
    () => {
      const el = document.createElement('link');
      el.rel = 'canonical';
      return el;
    },
    'href',
    url
  );
}
