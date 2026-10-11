import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLenis } from 'lenis/react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { Menu } from '@/components/animate-ui/icons/menu';
import { X } from '@/components/animate-ui/icons/x';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onOpenBooking: () => void;
  onOpenCancel: () => void;
  onOpenAdmin: () => void;
}

const LINKS = [
  { href: '#classes', label: 'Classes' },
  { href: '#schedule', label: 'Schedule' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
] as const;

export function Header({ onOpenBooking, onOpenCancel, onOpenAdmin }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lenis = useLenis();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // While the overlay is open: page scroll stops, the page behind is inert, Escape closes it,
  // and Tab / Shift+Tab cycle between the toggle and the overlay's links and buttons.
  useEffect(() => {
    if (!menuOpen) return;
    lenis?.stop();
    const background = [document.querySelector('main'), document.querySelector('footer')].filter(
      (el): el is HTMLElement => el !== null
    );
    background.forEach((el) => el.setAttribute('inert', ''));
    firstLinkRef.current?.focus();

    const focusables = () => {
      const menu = document.getElementById('mobile-menu');
      const inside = menu
        ? Array.from(menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
        : [];
      return [toggleRef.current, ...inside].filter((el): el is HTMLElement => el !== null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (current === -1) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === 0) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === items.length - 1) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      background.forEach((el) => el.removeAttribute('inert'));
      lenis?.start();
    };
  }, [menuOpen, lenis]);

  // Restart Lenis before the anchor click reaches it, so it can scroll to the section.
  const closeForLink = () => {
    lenis?.start();
    setMenuOpen(false);
  };

  const closeThen = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <header className="fixed top-0 inset-x-0 z-[45]">
      <div
        className={cn(
          'relative z-10 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]',
          scrolled && !menuOpen
            ? 'bg-bg/85 backdrop-blur-md border-line shadow-raised'
            : 'bg-transparent backdrop-blur-[0px] border-transparent shadow-none'
        )}
      >
        <div className="max-w-[1040px] mx-auto px-5 h-[72px] flex items-center justify-between gap-4">
          <a href="#home" className="inline-flex items-center min-h-11 font-display text-2xl leading-none text-ink">
            YogaPriyanshi
          </a>

          <nav aria-label="Main" className="hidden min-[900px]:flex items-center gap-8">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex items-center min-h-11 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft hover:text-ink transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenBooking}
              className="hidden sm:inline-flex items-center justify-center min-h-12 px-[22px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition-opacity duration-200"
            >
              Book free class
            </button>

            <AnimateIcon animateOnHover asChild>
              <button
                ref={toggleRef}
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Toggle Navigation Menu"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? 'mobile-menu' : undefined}
                className="min-[900px]:hidden inline-flex items-center justify-center size-11 rounded-full border border-line text-ink hover:border-ink transition-colors duration-200"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </AnimateIcon>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-0 bg-bg min-[900px]:hidden overflow-y-auto"
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="min-h-full flex flex-col items-center justify-center gap-12 px-5 pt-24 pb-12 text-center">
              <nav aria-label="Menu links" className="flex flex-col items-center gap-4">
                {LINKS.map((link, i) => (
                  <a
                    key={link.href}
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={link.href}
                    onClick={closeForLink}
                    className="font-display text-[34px] leading-tight text-ink hover:text-accent-text transition-colors duration-200 px-4 py-1"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={closeThen(onOpenCancel)}
                  className="min-h-[44px] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft hover:text-ink transition-colors duration-200"
                >
                  Manage booking
                </button>
                <button
                  type="button"
                  onClick={closeThen(onOpenAdmin)}
                  className="min-h-[44px] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft hover:text-ink transition-colors duration-200"
                >
                  Studio admin
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
