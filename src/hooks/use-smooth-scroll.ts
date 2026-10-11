import { useCallback } from 'react';
import { useLenis } from 'lenis/react';

/** Header height the anchors land below (matches ReactLenis anchors.offset and scroll-padding-top). */
export const SCROLL_OFFSET = -88;

/**
 * Scrolls to a section id through Lenis, falling back to native scrolling
 * when Lenis isn't running (e.g. before it mounts).
 */
export function useScrollToSection() {
  const lenis = useLenis();
  return useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (lenis) {
        lenis.scrollTo(el, { offset: SCROLL_OFFSET });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [lenis]
  );
}
