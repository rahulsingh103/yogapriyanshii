import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';
// Pure, relative modules only (no `@/` alias, no import.meta.env): the config is bundled on its own.
import { FAQ_ITEMS } from './src/constants/faq.ts';
import { faqJsonLd } from './src/lib/faq-schema.ts';
import { HOME_META, absoluteUrl, headTags } from './src/lib/page-meta.ts';
import { CLASS_SLUGS, classPath, type Route } from './src/lib/route.ts';
import { SEO_END, SEO_START, applyRoute } from './src/lib/route-html.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Puts the FAQ's FAQPage JSON-LD into <head>, so it's in the first HTML response (dev and build). */
function faqStructuredData(): Plugin {
  return {
    name: 'faq-structured-data',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'application/ld+json', id: 'faq-jsonld' },
          children: faqJsonLd(FAQ_ITEMS),
          injectTo: 'head',
        },
      ];
    },
  };
}

/**
 * Build only: from the finished home HTML (hashed asset URLs included) it emits the 11 prerendered class
 * pages (classes/<slug>/index.html), 404.html, sitemap.xml and robots.txt, with the same pure transform
 * the dev server uses (src/lib/route-html.ts). It fails the build rather than ship a wrong page.
 */
function routePages(): Plugin {
  return {
    name: 'route-pages',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const home = bundle['index.html'];
        if (!home || home.type !== 'asset') return this.error('route-pages: index.html is missing from the bundle');
        const html = typeof home.source === 'string' ? home.source : new TextDecoder().decode(home.source);
        const once = (part: string) => html.split(part).length === 2;
        if (!once(SEO_START) || !once(SEO_END)) return this.error('route-pages: the seo markers must appear exactly once in index.html');
        if (!once('id="faq-jsonld"')) return this.error('route-pages: the FAQ JSON-LD is missing from the home page');
        // HOME_META must mirror index.html, or the class pages would inherit stale tags.
        const block = html
          .slice(html.indexOf(SEO_START) + SEO_START.length, html.indexOf(SEO_END))
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        if (block.join('\n') !== headTags(HOME_META).join('\n'))
          return this.error('route-pages: HOME_META (src/lib/page-meta.ts) no longer matches the seo block in index.html');

        // Each page preloads its lazy route chunk (and that chunk's own imports), so React mounts it without a waterfall.
        const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
        const preloadFor = (component: string) => {
          const chunk = chunks.find((c) => c.facadeModuleId?.endsWith(`/src/components/${component}.tsx`));
          if (!chunk) return this.error(`route-pages: no lazy chunk for ${component}`);
          const entries = new Set(chunks.filter((c) => c.isEntry).map((c) => c.fileName));
          return [chunk.fileName, ...chunk.imports.filter((f) => !entries.has(f))].map((f) => `/${f}`);
        };

        const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source });
        const classPreload = preloadFor('ClassPage');
        for (const slug of CLASS_SLUGS) {
          const route: Route = { kind: 'class', slug };
          emit(`classes/${slug}/index.html`, applyRoute(html, route, { preload: classPreload }));
        }
        emit('404.html', applyRoute(html, { kind: 'notFound' }, { preload: preloadFor('NotFound') }));

        const urls = ['/', ...CLASS_SLUGS.map(classPath)];
        emit(
          'sitemap.xml',
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls.map((u) => `  <url><loc>${absoluteUrl(u)}</loc></url>`),
            '</urlset>',
            '',
          ].join('\n')
        );
        emit('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`);
      },
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), faqStructuredData(), routePages()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
