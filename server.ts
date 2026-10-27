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
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    // The same pure transform the build uses (src/lib/route-html.ts), so dev and tests serve each route's
    // own head and static content, and unknown paths get a real 404 (DESIGN_SYSTEM "Not found").
    const { resolveRoute } = await import('./src/lib/route.ts');
    const { applyRoute, isNotFound } = await import('./src/lib/route-html.ts');

    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const route = resolveRoute(new URL(req.originalUrl, 'http://x').pathname);
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        // Always transformed as '/', so every route gets exactly the home HTML before applyRoute.
        template = await vite.transformIndexHtml('/', template);
        const html = applyRoute(template, route);
        res.status(isNotFound(route) ? 404 : 200).set({ 'Content-Type': 'text/html' }).end(html);
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

    // Slugs match exactly, also on case-insensitive disks (/classes/Hatha is a 404, never the Hatha page).
    app.use('/classes', (req: Request, res: Response, next: NextFunction) => {
      const slug = req.path.split('/')[1];
      if (slug && !classSlugs.has(slug)) return notFound(res);
      next();
    });
    // index: 'index.html' (serve-static wants the file name; `true` is refused) serves /classes/<slug>/ from its folder.
    app.use(express.static(distPath, { redirect: false, index: 'index.html' }));
    app.get('/classes/:slug', (req: Request, res: Response, next: NextFunction) => {
      if (!classSlugs.has(req.params.slug)) return next();
      res.sendFile(path.resolve(classesDir, req.params.slug, 'index.html'));
    });
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
