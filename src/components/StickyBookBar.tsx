import { useEffect, useState } from 'react';

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

  if (!visible) return null;

  return (
    <aside
      aria-label="Quick booking bar"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-md border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <button
        type="button"
        onClick={onOpenBooking}
        className="w-full inline-flex items-center justify-center min-h-12 px-[22px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition-opacity duration-200"
      >
        Book a free class
      </button>
    </aside>
  );
}
