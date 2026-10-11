import express from 'express';
import { createApp } from '../backend/app.js';

// Vercel entry point. All API logic lives in backend/ and is shared with server.ts,
// so the live site runs exactly the code the tests exercise.
const app = express();
app.disable('x-powered-by');

// Route normalization: Vercel may hand the function a path without the /api prefix.
app.use((req, _res, next) => {
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.endsWith('.html') && req.url !== '/') {
    req.url = '/api' + req.url;
  }
  next();
});

app.use(createApp());

export default app;
