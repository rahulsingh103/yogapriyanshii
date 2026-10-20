/**
 * FAQPage structured data (schema.org) for the FAQ section. Pure on purpose: vite.config.ts imports
 * it to inject the JSON-LD into index.html at build time, so no `@/` imports and no `import.meta.env`.
 * This only describes the page; it doesn't promise rich results in search.
 */
import type { FaqItem } from '../constants/faq.ts';

export function faqJsonLd(items: ReadonlyArray<FaqItem>): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
  // Escape "<" so no answer can ever close the <script> element it sits in.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
