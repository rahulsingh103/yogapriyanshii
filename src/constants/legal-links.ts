/**
 * The legal pages' slugs, paths and titles only, for the footer and the router (both in the home bundle).
 * The full text is in legal.ts, which only the lazy LegalPage and the build load. Pure.
 */
export type LegalSlug = 'privacy' | 'terms' | 'refund' | 'health';

export const LEGAL_LINKS: ReadonlyArray<{ slug: LegalSlug; path: string; title: string }> = [
  { slug: 'privacy', path: '/privacy', title: 'Privacy policy' },
  { slug: 'terms', path: '/terms', title: 'Terms of use' },
  { slug: 'refund', path: '/refund-and-cancellation', title: 'Refund and cancellation' },
  { slug: 'health', path: '/health-data', title: 'Health data' },
];

export const legalLink = (slug: LegalSlug) => LEGAL_LINKS.find((l) => l.slug === slug)!;
