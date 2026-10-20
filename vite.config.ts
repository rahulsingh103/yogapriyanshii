import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';
// Pure, relative modules only (no `@/` alias, no import.meta.env): the config is bundled on its own.
import { FAQ_ITEMS } from './src/constants/faq.ts';
import { faqJsonLd } from './src/lib/faq-schema.ts';

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

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), faqStructuredData()],
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
