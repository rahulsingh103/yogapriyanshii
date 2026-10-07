import React, { useState } from 'react';
import { Menu, X, Lock, Palette } from 'lucide-react';

interface HeaderProps {
  onOpenBooking: () => void;
  onOpenCancel: () => void;
  onOpenAdmin: () => void;
  onOpenEmails?: () => void;
  onOpenDesignShowcase?: () => void;
  activeView: 'studio' | 'tutor';
  onSwitchView: (view: 'studio' | 'tutor') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBooking,
  onOpenCancel,
  onOpenAdmin,
  onOpenDesignShowcase,
  activeView,
  onSwitchView,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#0f0e0b]/92 backdrop-blur-md border-b border-white/10 text-[#faf8f3] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Wordmark */}
          <div className="flex items-center">
            <a
              href="#home"
              onClick={() => onSwitchView('studio')}
              className="group flex flex-col"
            >
              <span className="font-serif text-2xl sm:text-[26px] tracking-tight text-[#faf8f3] group-hover:text-[#c4b48a] transition-colors leading-none">
                YogaPriyanshi
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-[#c4b48a] font-medium mt-1">
                BurJuman Residence Block D · Dubai
              </span>
            </a>
          </div>

          {/* Clean Center Navigation */}
          {activeView === 'studio' ? (
            <nav className="hidden lg:flex items-center gap-10 text-xs uppercase tracking-[0.2em] font-medium text-[#faf8f3]/70">
              <a href="#classes" className="hover:text-[#faf8f3] transition-colors">
                Classes
              </a>
              <a href="#schedule" className="hover:text-[#faf8f3] transition-colors">
                Schedule
              </a>
              <a href="#about" className="hover:text-[#faf8f3] transition-colors">
                About
              </a>
              <a href="#contact" className="hover:text-[#faf8f3] transition-colors">
                Contact
              </a>
            </nav>
          ) : (
            <div className="hidden lg:flex items-center">
              <button
                type="button"
                onClick={() => onSwitchView('studio')}
                className="text-xs uppercase tracking-wider text-[#c4b48a] hover:text-[#faf8f3] transition-colors"
              >
                ← Return to Yoga Studio
              </button>
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={onOpenCancel}
              className="hidden sm:inline-block text-xs uppercase tracking-wider text-[#faf8f3]/60 hover:text-[#faf8f3] transition-colors"
            >
              Manage Booking
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-xs uppercase tracking-wider text-[#faf8f3]/45 hover:text-[#faf8f3] transition-colors px-1 py-1"
              title="Studio Admin Portal & Email Logs"
            >
              <span className="hidden sm:inline">Admin</span>
              <Lock className="w-3.5 h-3.5 sm:hidden" />
            </button>

            <button
              type="button"
              onClick={onOpenBooking}
              className="px-5 py-2.5 bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest transition-all rounded-xs shadow-xs hover:shadow-sm"
            >
              Book Free Class
            </button>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-[#faf8f3]/80 hover:text-[#faf8f3]"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0f0e0b] border-b border-white/10 px-6 py-6 space-y-4">
          <nav className="flex flex-col space-y-3.5 text-xs uppercase tracking-wider text-[#faf8f3]/80">
            <a
              href="#classes"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-[#c4b48a] transition-colors"
            >
              Classes & Pricing
            </a>
            <a
              href="#schedule"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-[#c4b48a] transition-colors"
            >
              Schedule
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-[#c4b48a] transition-colors"
            >
              About Priyanshi
            </a>
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-[#c4b48a] transition-colors"
            >
              Contact & Location
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCancel();
              }}
              className="py-1 text-left text-xs uppercase tracking-wider text-[#faf8f3]/60 hover:text-[#faf8f3]"
            >
              Manage Booking
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAdmin();
              }}
              className="py-1 text-left text-xs uppercase tracking-wider text-[#faf8f3]/60 hover:text-[#faf8f3]"
            >
              Studio Admin Portal
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};
