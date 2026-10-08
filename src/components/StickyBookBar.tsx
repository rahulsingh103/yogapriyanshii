import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface StickyBookBarProps {
  onOpenBooking: () => void;
}

export const StickyBookBar: React.FC<StickyBookBarProps> = ({ onOpenBooking }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 350) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <aside
      aria-label="Quick booking bar"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#0f0e0b]/95 backdrop-blur-md border-t border-[#c4b48a]/30 text-[#faf8f3] px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] transition-transform duration-300 shadow-xl"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#c4b48a] animate-pulse" />
          <span className="font-serif italic hidden sm:inline text-sm text-[#faf8f3]">
            Start with your first class free
          </span>
          <span className="text-[11px] uppercase tracking-wider text-[#c4b48a] font-semibold sm:hidden">
            First Class Free
          </span>
          <span className="text-[11px] text-[#faf8f3]/60 hidden md:inline">
            · No card required · 1 per person
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenBooking}
          className="px-5 py-2.5 min-h-[44px] bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-[11px] font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shrink-0 rounded-xs shadow-xs"
        >
          <span>Book Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
