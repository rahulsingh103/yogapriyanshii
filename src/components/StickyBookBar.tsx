import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';

interface StickyBookBarProps {
  onOpenBooking: () => void;
}

/**
 * Mobile-only bottom bar. It shows once the hero (#home) has left the screen, and hides again while
 * the first-class band (#first-class) or Contact (#contact) is on screen, since both carry their own
 * dark buttons.
 */
export function StickyBookBar({ onOpenBooking }: StickyBookBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = ['home', 'first-class', 'contact']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const inView = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) inView.set(entry.target, entry.isIntersecting);
      setVisible(![...inView.values()].some(Boolean));
    });
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <m.aside
          aria-label="Quick booking bar"
          className="material-bar sm:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-[20px] backdrop-saturate-[1.8] shadow-glass-edge px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          // Rises from the bottom edge and leaves the same way.
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        >
          {/* Scroll edge (DS §6) in place of a top hairline. */}
          <div aria-hidden="true" className="scroll-edge pointer-events-none absolute inset-x-0 bottom-full h-4 bg-linear-to-t from-bg/90 to-transparent" />
          <button
            type="button"
            onClick={onOpenBooking}
            className="press w-full inline-flex items-center justify-center min-h-12 px-[22px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition duration-200 ease-spring active:duration-100"
          >
            Book a free class
          </button>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
