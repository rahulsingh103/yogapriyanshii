/**
 * Turns the home page HTML into the HTML for any route: the build (vite.config.ts) prerenders the class
 * pages and 404.html with it, and the dev server (server.ts) runs it on every page request. Pure:
 * relative imports only, no `@/` alias and no `import.meta.env`.
 *
 * It swaps the `<!-- seo:start -->` block, drops the FAQ JSON-LD off home and fills `<div id="root">`
 * with readable static content (React replaces it on load; with JS off it stays). Everything is
 * HTML-escaped; no raw HTML from the data is ever written. The home route is returned unchanged.
 */
import {
  classBeforeList,
  classDuration,
  classPage,
  classPageKind,
  classPageLine,
  classPhotoMaxClass,
  classPhotoSizes,
} from '../constants/class-pages';
import { HOME_META, NOT_FOUND_META, headTags, type PageMeta } from './page-meta';
import { classPath, type Route } from './route';

export const SEO_START = '<!-- seo:start -->';
export const SEO_END = '<!-- seo:end -->';
const ROOT = '<div id="root"></div>';
const FAQ_JSONLD = /\s*<script type="application\/ld\+json" id="faq-jsonld">[\s\S]*?<\/script>/;

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const count = (s: string, part: string) => s.split(part).length - 1;

/** The head metadata for a route. Articles and drafts aren't served yet, so they are the 404. */
export function metaFor(route: Route): PageMeta {
  if (route.kind === 'home') return HOME_META;
  if (route.kind === 'class') {
    const page = classPage(route.slug);
    if (page) return { title: page.content.metaTitle, description: page.content.metaDescription, path: classPath(route.slug) };
  }
  return NOT_FOUND_META;
}

const LINK = 'underline underline-offset-4 decoration-line-strong hover:decoration-ink text-ink';

function classBody(slug: string): string | null {
  const page = classPage(slug);
  if (!page) return null;
  const { cls, content } = page;
  const e = escapeHtml;
  const duration = classDuration(cls);
  const rows: Array<[string, string]> = [
    ...(duration ? [['Duration', duration] as [string, string]] : []),
    ['Intensity', content.intensity],
    ...(content.level ? [['Level', content.level] as [string, string]] : []),
    ['Format', content.format],
  ];
  const p = content.photo;
  const kind = classPageKind(cls);
  return [
    '<main class="flex-1"><article class="max-w-[1040px] mx-auto px-5 pt-24 pb-24 flex flex-col gap-8">',
    `<p><a href="/#classes" class="${LINK}">All classes</a></p>`,
    `<h1 class="font-display font-normal text-h2 text-ink">${e(cls.name)}</h1>`,
    // Same source, sizes, priority and width cap as ClassPage, so the browser fetches the photo once.
    `<img src="${e(p.src)}"${p.srcSet ? ` srcset="${e(p.srcSet)}" sizes="${e(classPhotoSizes(p))}"` : ''} width="${p.width}" height="${p.height}" fetchpriority="high" alt="${e(p.alt)}" class="w-full ${classPhotoMaxClass(p)} aspect-[4/5] object-cover rounded-[18px]" />`,
    `<section class="flex flex-col gap-2"><h2 class="font-display font-normal text-h4 text-ink">Who it&#39;s for</h2><p data-testid="class-who-for" class="text-base leading-[1.6] text-ink-soft max-w-[46ch]">${e(content.whoFor)}</p></section>`,
    `<section class="flex flex-col gap-2"><h2 class="font-display font-normal text-h4 text-ink">About the class</h2><p class="text-base leading-[1.6] text-ink-soft max-w-[46ch]">${e(content.about)}</p></section>`,
    `<dl class="grid gap-2">${rows.map(([k, v]) => `<div><dt class="text-sm text-ink-soft">${e(k)}</dt><dd class="text-base text-ink">${e(v)}</dd></div>`).join('')}</dl>`,
    `<section class="flex flex-col gap-2"><h2 class="font-display font-normal text-h4 text-ink">What to bring</h2><ul data-testid="class-before" class="list-disc pl-5 text-base leading-[1.6] text-ink-soft">${classBeforeList(kind).map((b) => `<li>${e(b)}</li>`).join('')}</ul></section>`,
    ...content.notices.map((n) => `<p class="p-4 rounded-[12px] bg-calm-bg text-ink text-sm leading-[1.5]">${e(n)}</p>`),
    ...(content.testimonial
      ? [`<figure class="flex flex-col gap-2"><blockquote class="text-base leading-[1.6] text-ink">${e(content.testimonial.quote)}</blockquote><figcaption class="text-sm text-ink-soft">Verified ClassPass review · ${e(content.testimonial.className)} class</figcaption></figure>`]
      : []),
    `<p class="text-base leading-[1.6] text-ink-soft">${e(classPageLine(kind))}</p>`,
    '</article></main>',
  ].join('');
}

const NOT_FOUND_BODY = [
  '<main class="flex-1"><section class="max-w-[640px] mx-auto px-5 pt-32 pb-24 flex flex-col gap-6">',
  '<h1 class="font-display font-normal text-h2 text-ink">Page not found</h1>',
  '<p class="text-base leading-[1.6] text-ink-soft">This page has moved or never existed.</p>',
  `<p><a href="/" class="${LINK}">Back to the homepage</a> · <a href="/#classes" class="${LINK}">See all classes</a></p>`,
  '</section></main>',
].join('');

export interface ApplyRouteOptions {
  /** Module URLs to preload (the route's lazy chunk), so React can mount it without a waterfall. */
  preload?: ReadonlyArray<string>;
}

/**
 * Pure: the HTML for `route`, from the home HTML. Throws if the markers or the root are missing,
 * so a changed index.html fails the build instead of shipping wrong pages.
 */
export function applyRoute(html: string, route: Route, { preload = [] }: ApplyRouteOptions = {}): string {
  if (route.kind === 'home') return html;
  if (count(html, SEO_START) !== 1 || count(html, SEO_END) !== 1) throw new Error('applyRoute: seo markers must appear exactly once');
  if (count(html, ROOT) !== 1) throw new Error('applyRoute: <div id="root"></div> must appear exactly once');
  const start = html.indexOf(SEO_START);
  const end = html.indexOf(SEO_END);
  if (end < start) throw new Error('applyRoute: seo markers out of order');
  const indent = html.slice(html.lastIndexOf('\n', start) + 1, start);
  const meta = metaFor(route);
  const block = [SEO_START, ...headTags(meta), SEO_END].join(`\n${indent}`);
  let out = html.slice(0, start) + block + html.slice(end + SEO_END.length);
  out = out.replace(FAQ_JSONLD, '');
  // Dev HTML keeps index.html's `./node_modules/...` font preloads; from /classes/<slug> they must be root-relative.
  out = out.replace(/(href|src)="\.\//g, '$1="/');
  const body = (route.kind === 'class' && classBody(route.slug)) || NOT_FOUND_BODY;
  // Function replacers, so a `$` in the content is never read as a replacement pattern.
  out = out.replace(ROOT, () => `<div id="root">${body}</div>`);
  if (preload.length) {
    const links = preload.map((href) => `<link rel="modulepreload" crossorigin href="${escapeHtml(href)}">`).join(`\n${indent}`);
    out = out.replace('</head>', () => `  ${links}\n  </head>`);
  }
  return out;
}

/** True when the route should answer 404 (anything but home or a known class). */
export const isNotFound = (route: Route) => route.kind !== 'home' && !(route.kind === 'class' && classPage(route.slug));
