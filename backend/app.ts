import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { buildRouter } from './routes.js';
import { HttpError } from './validate.js';

const FRIENDLY_500 = 'Something went wrong on our side. Please try again, or contact the studio directly.';

/** The whole API as one Express app. Mounted by api/index.ts (Vercel) and server.ts (dev and tests). */
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', express.json({ limit: '100kb' }));
  app.use(buildRouter());

  // Unknown API routes get JSON, not the SPA.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // Final error handler: human messages only, never stack traces.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) {
      res.status(err.status).json(err.code ? { error: err.message, code: err.code } : { error: err.message });
      return;
    }
    const e = err as { type?: string; status?: number; code?: string; name?: string };
    if (e?.type === 'entity.too.large') {
      res.status(413).json({ error: 'That request is too large.' });
      return;
    }
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'The request could not be read. Please try again.' });
      return;
    }
    console.log(`request_failed error=${e?.code ?? e?.name ?? 'unknown'}`);
    res.status(500).json({ error: FRIENDLY_500 });
  });

  return app;
}
