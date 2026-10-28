import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Tests never load the local env file, so they can't pick up live database or email keys.
if (process.env.APP_ENV !== 'test') dotenv.config({ quiet: true });

const { createApp } = await import('./backend/app.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(createApp());

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      // No HMR under Playwright (APP_ENV=test): its websocket port would clash with a dev server already running.
      server: { middlewareMode: true, ...(process.env.APP_ENV === 'test' ? { hmr: false } : {}) },
      appType: 'custom',
    });
    // Dev-only previews, registered before Vite so nothing else can answer these paths.
    const showDrafts = process.env.SHOW_DRAFTS === '1';
    const isTest = process.env.APP_ENV === 'test';
    const SLUG = /^[a-z0-9-]{1,60}$/;
    // Drafts live OUTSIDE the repo (content-drafts/ in the workspace). Only this route reads them, only
    // with SHOW_DRAFTS=1, and the build never does (docs/SECURITY.md, spec 14's canary test).
    const draftsDir = path.resolve(__dirname, process.env.DRAFTS_DIR || '../content-drafts/articles');
    /** The draft's real path, or null: a known-safe slug, inside the folder, a plain file and no symlinks (P8). */
    const draftFile = (slug: string): string | null => {
      if (!SLUG.test(slug)) return null;
      const file = path.resolve(draftsDir, `${slug}.md`);
      if (!file.startsWith(draftsDir + path.sep)) return null;
      try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) return null;
        const realDir = fs.realpathSync(draftsDir);
        const real = fs.realpathSync(file);
        return real.startsWith(realDir + path.sep) ? real : null;
      } catch {
        return null;
      }
    };
    const isLoopback = (req: Request) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
    const PREVIEW_HEADERS = { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' };

    if (showDrafts) {
      app.get('/__drafts/:slug', (req: Request, res: Response) => {
        const file = isLoopback(req) ? draftFile(req.params.slug) : null;
        if (!file) return res.status(404).set(PREVIEW_HEADERS).type('text/plain').end('Not found');
        res.status(200).set(PREVIEW_HEADERS).type('text/plain; charset=utf-8').end(fs.readFileSync(file, 'utf-8'));
      });
    }
    // Tests only (P9): a synthetic lorem fixture, rendered by the same article view as a draft.
    const testArticle = path.resolve(__dirname, 'e2e', 'fixtures', 'article.md');
    if (isTest) {
      app.get('/__test/article.md', (_req: Request, res: Response) => {
        res.status(200).set(PREVIEW_HEADERS).type('text/plain; charset=utf-8').end(fs.readFileSync(testArticle, 'utf-8'));
      });
    }

    app.use(vite.middlewares);

    const { readPublishedArticles } = await import('./src/lib/article-files.ts');
    const articlesDir = path.resolve(__dirname, 'src', 'content', 'articles');
    const withMeta = (html: string, name: string) =>
      html.replace('</head>', () => `  <meta name="${name}" content="on" />\n  </head>`);

    // The same pure transform the build uses (src/lib/route-html.ts), so dev and tests serve each route's
    // own head and static content, and unknown paths get a real 404 (DESIGN_SYSTEM "Not found").
    const { resolveRoute } = await import('./src/lib/route.ts');
    const { applyRoute, isNotFound } = await import('./src/lib/route-html.ts');

    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const pathname = new URL(req.originalUrl, 'http://x').pathname;
        // Read on every request in dev, so a newly published article shows without a restart.
        const published = readPublishedArticles(articlesDir);
        let route = resolveRoute(pathname, { publishedArticles: published.map((a) => a.slug), drafts: showDrafts });
        const testPage = isTest && pathname === '/__test/article';
        if (testPage) route = { kind: 'draft', slug: 'test-fixture' };
        // A draft preview for a file that isn't there is a plain 404.
        else if (route.kind === 'draft' && !draftFile(route.slug)) route = { kind: 'notFound' };
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        // Always transformed as '/', so every route gets exactly the home HTML before applyRoute.
        template = await vite.transformIndexHtml('/', template);
        let html = applyRoute(template, route, {
          article: route.kind === 'article' ? published.find((a) => a.slug === route.slug)?.article : undefined,
          guides: published.map((a) => ({ slug: a.slug, meta: a.article.meta })),
        });
        if (showDrafts) html = withMeta(html, 'yp-drafts');
        if (testPage) html = withMeta(html, 'yp-test-article');
        res.status(isNotFound(route) ? 404 : 200).set({ 'Content-Type': 'text/html' });
        if (route.kind === 'draft') res.set(PREVIEW_HEADERS);
        res.end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    // The prerendered class pages (vite.config.ts) are the known list: dist/classes/<slug>/index.html.
    const classesDir = path.resolve(distPath, 'classes');
    const classSlugs = new Set(
      fs.existsSync(classesDir)
        ? fs
            .readdirSync(classesDir)
            .filter((slug) => /^[a-z0-9-]{1,60}$/.test(slug) && fs.existsSync(path.resolve(classesDir, slug, 'index.html')))
        : []
    );
    const notFound = (res: Response) => res.status(404).sendFile(path.resolve(distPath, '404.html'));

    // The published guides, prerendered the same way (none yet): dist/guides/<slug>/index.html.
    const guidesDir = path.resolve(distPath, 'guides');
    const guideSlugs = new Set(
      fs.existsSync(guidesDir)
        ? fs
            .readdirSync(guidesDir)
            .filter((slug) => /^[a-z0-9-]{1,60}$/.test(slug) && fs.existsSync(path.resolve(guidesDir, slug, 'index.html')))
        : []
    );

    // Slugs match exactly, also on case-insensitive disks (/classes/Hatha is a 404, never the Hatha page).
    app.use('/classes', (req: Request, res: Response, next: NextFunction) => {
      const slug = req.path.split('/')[1];
      if (slug && !classSlugs.has(slug)) return notFound(res);
      next();
    });
    app.use('/guides', (req: Request, res: Response, next: NextFunction) => {
      const slug = req.path.split('/')[1];
      if (guideSlugs.size === 0 || (slug && !guideSlugs.has(slug))) return notFound(res);
      next();
    });
    // index: 'index.html' (serve-static wants the file name; `true` is refused) serves /classes/<slug>/ from its folder.
    app.use(express.static(distPath, { redirect: false, index: 'index.html' }));
    app.get('/classes/:slug', (req: Request, res: Response, next: NextFunction) => {
      if (!classSlugs.has(req.params.slug)) return next();
      res.sendFile(path.resolve(classesDir, req.params.slug, 'index.html'));
    });
    app.get('/guides/:slug', (req: Request, res: Response, next: NextFunction) => {
      if (!guideSlugs.has(req.params.slug)) return next();
      res.sendFile(path.resolve(guidesDir, req.params.slug, 'index.html'));
    });
    app.get('/guides', (_req: Request, res: Response) => res.sendFile(path.resolve(guidesDir, 'index.html')));
    app.get('*', (_req: Request, res: Response) => notFound(res));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YogaPriyanshi server active at http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
