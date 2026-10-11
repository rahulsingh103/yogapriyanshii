import { useCallback } from 'react';
import { useLenis } from 'lenis/react';

/**
 * Scrolls to a section id through Lenis, falling back to native scrolling
 * when Lenis isn't running (e.g. before it mounts). The header offset comes from
 * `scroll-padding-top` on <html> (index.css), which both Lenis and the browser honour,
 * so no extra offset is passed here.
 */
export function useScrollToSection() {
  const lenis = useLenis();
  return useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (lenis) {
        lenis.scrollTo(el);
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [lenis]
  );
}
