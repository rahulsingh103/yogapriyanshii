import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';

interface StickyBookBarProps {
  onOpenBooking: () => void;
}

/** Mobile-only bottom bar that appears once the hero (#home) has left the screen. */
export function StickyBookBar({ onOpenBooking }: StickyBookBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('home');
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <m.aside
          aria-label="Quick booking bar"
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-md border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <button
            type="button"
            onClick={onOpenBooking}
            className="w-full inline-flex items-center justify-center min-h-12 px-[22px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition-opacity duration-200"
          >
            Book a free class
          </button>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
