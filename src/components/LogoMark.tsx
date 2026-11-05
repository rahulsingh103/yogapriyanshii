import type { SVGProps } from 'react';

/**
 * The YP logo (chosen 2026-11-03): a raised P and a lowered Y whose right arm flows up
 * into the P's stem, in the same colours as the primary button (`on-ink` on `ink`). Colours come from the tokens (DESIGN_SYSTEM §4).
 * Decorative: it always sits next to the "YogaPriyanshi" wordmark, which names the link.
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" {...props}>
      <rect width="100" height="100" rx="22" className="fill-ink" />
      <g transform="translate(19 17) scale(0.62)" className="fill-on-ink">
        <rect x="52.3" y="1.4" width="4.6" height="61.4" />
        <rect x="47.6" y="1" width="9.3" height="0.8" />
        <rect x="47.4" y="62.4" width="18.6" height="0.8" />
        <path d="M56.9 1 H70 C88 1 96.6 9 96.6 19.4 C96.6 29.6 88 37.6 70 37.6 H56.9 V36.8 H69 C84 36.8 92.6 29.2 92.6 19.4 C92.6 9.6 84 1.8 69 1.8 H56.9 Z" />
        <path d="M1.6 38.4 C4.5 34.4 18 32.2 36.4 68.5 H31.9 C25.5 49.5 14.5 37.8 4.6 37.2 C3.4 37.2 2.4 37.6 1.6 38.4 Z" />
        <rect x="31.9" y="64" width="4.5" height="34.4" />
        <rect x="25" y="98" width="18.2" height="0.8" />
        <path d="M34.6 67.5 C38.8 53 45.2 44.2 52.6 40" fill="none" className="stroke-on-ink" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
