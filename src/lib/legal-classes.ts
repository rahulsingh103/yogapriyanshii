/**
 * The legal pages' classes (design/concepts/footer-legal, owner-approved 2026-11-14: small, quiet type),
 * shared by LegalPage and its prerendered HTML (route-html.ts) so both look the same. Pure.
 */
export const LEGAL_CLASSES = {
  wrap: 'max-w-[1320px] mx-auto px-5 md:px-12 pt-28 md:pt-32 pb-24 grid md:grid-cols-[240px_minmax(0,1fr)] gap-8 md:gap-16',
  nav: 'md:sticky md:top-28 md:self-start min-w-0',
  navTitle: 'hidden md:block mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft',
  navList: 'flex md:flex-col gap-1.5 md:gap-0.5 overflow-x-auto pb-1 md:pb-0 -mx-5 px-5 md:mx-0 md:px-0',
  article: 'max-w-[68ch] min-w-0 flex flex-col gap-2.5',
  h1: 'mb-1.5 font-display font-normal text-[28px] leading-[1.15] text-ink text-balance',
  section: 'flex flex-col gap-2.5 mt-3',
  h2: 'text-sm font-semibold text-ink',
  p: 'text-sm leading-[1.6] text-ink-soft',
  list: 'list-disc pl-[18px] flex flex-col gap-1 text-sm leading-[1.6] text-ink-soft',
  updated: 'mt-2 text-xs text-ink-soft',
} as const;

/** A menu link: a pill on phones, a soft row from md; the current page is sage. */
export const legalMenuClass = (current: boolean) =>
  `inline-flex md:flex items-center min-h-11 px-3.5 rounded-full md:rounded-[10px] whitespace-nowrap text-sm text-ink border md:border-0 transition-colors duration-200 ${
    current ? 'bg-sage-soft border-sage-soft font-semibold' : 'border-line hover:bg-sage-soft/60'
  }`;
