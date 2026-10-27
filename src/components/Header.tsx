import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useLenis } from 'lenis/react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { Menu } from '@/components/animate-ui/icons/menu';
import { X } from '@/components/animate-ui/icons/x';
import { cn } from '@/lib/utils';
import { isPlainClick } from '@/hooks/use-route';

interface HeaderProps {
  onOpenBooking: () => void;
  onOpenCancel: () => void;
  onOpenAdmin: () => void;
  /** Tells App when the mobile menu opens or closes (the WhatsApp button hides behind it). */
  onMenuOpenChange?: (open: boolean) => void;
  /** False on a class page or the 404: the section links then go home first. */
  isHome?: boolean;
  /** Goes home in the app, then to the section (top of the page without one). */
  onNavigateHome?: (sectionId?: string) => void;
}

const LINKS = [
  { href: '#classes', label: 'Classes' },
  { href: '#schedule', label: 'Schedule' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
] as const;

export function Header({ onOpenBooking, onOpenCancel, onOpenAdmin, onMenuOpenChange, isHome = true, onNavigateHome }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lenis = useLenis();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);

  useEffect(() => onMenuOpenChange?.(menuOpen), [menuOpen, onMenuOpenChange]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The overlay only exists below 900px: if the viewport grows past that while it's open
  // (rotation, resized window), close it so the inert page and the Lenis stop never get stuck.
  useEffect(() => {
    if (!menuOpen) return;
    const wide = window.matchMedia('(min-width: 900px)');
    const onChange = () => {
      if (wide.matches) setMenuOpen(false);
    };
    onChange();
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, [menuOpen]);

  // While the overlay is open: page scroll stops, the page behind is inert (including the
  // header's own logo and pill, and the sticky bar), Escape closes it, and Tab / Shift+Tab
  // cycle between the toggle and the overlay's links and buttons.
  useEffect(() => {
    if (!menuOpen) return;
    lenis?.stop();
    const background = [
      document.querySelector('main'),
      document.querySelector('footer'),
      document.querySelector('[aria-label="Quick booking bar"]'),
      logoRef.current,
      pillRef.current,
    ].filter((el): el is HTMLElement => el instanceof HTMLElement);
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

  // Restart Lenis before the anchor click reaches it, so it can scroll to the section. The link is about
  // to unmount with the overlay, so focus goes back to the toggle (off home, App then moves it on to the
  // section's heading once home has rendered).
  const closeForLink = () => {
    lenis?.start();
    toggleRef.current?.focus({ preventScroll: true });
    setMenuOpen(false);
  };

  // Off home, "#schedule" becomes "/#schedule" and the click goes home in the app, then to the section.
  // On home nothing changes: Lenis's anchor handling scrolls as before.
  const hrefFor = (hash: string) => (isHome ? hash : `/${hash}`);
  const goHome = (hash: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (isHome || !onNavigateHome || !isPlainClick(e)) return;
    e.preventDefault();
    // Lenis (anchors: true) listens on window: it must not start its own smooth scroll to "/#id".
    e.stopPropagation();
    const id = hash.slice(1);
    onNavigateHome(id === 'home' ? undefined : id);
  };

  const closeThen = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <header className="fixed top-0 inset-x-0 z-[45]">
      <div
        className={cn(
          'relative z-10 border-b border-transparent transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-spring',
          scrolled && !menuOpen
            ? 'material-bar bg-bg/85 backdrop-blur-[20px] backdrop-saturate-[1.8] shadow-glass-edge'
            : 'bg-transparent backdrop-blur-[0px] shadow-none'
        )}
      >
        {/* Scroll edge (DS §6): content softens as it slides under the glass, instead of a hard line. */}
        <div
          aria-hidden="true"
          className={cn(
            'scroll-edge pointer-events-none absolute inset-x-0 top-[calc(100%-1px)] h-4 bg-linear-to-b from-bg/85 to-transparent transition-opacity duration-300 ease-spring',
            scrolled && !menuOpen ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div className="max-w-[1040px] mx-auto px-5 h-[72px] flex items-center justify-between gap-4">
          <a ref={logoRef} href={isHome ? '#home' : '/'} onClick={goHome('#home')} className="inline-flex items-center min-h-11 font-display text-2xl leading-none text-ink">
            YogaPriyanshi
          </a>

          <nav aria-label="Main" className="hidden min-[900px]:flex items-center gap-8">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={hrefFor(link.href)}
                onClick={goHome(link.href)}
                className="inline-flex items-center min-h-11 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft hover:text-ink transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              ref={pillRef}
              type="button"
              onClick={onOpenBooking}
              className="press hidden sm:inline-flex items-center justify-center min-h-12 px-[22px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition duration-200 ease-spring active:duration-100"
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
                className="press min-[900px]:hidden inline-flex items-center justify-center size-11 rounded-full border border-line text-ink hover:border-ink transition duration-200 ease-spring active:duration-100"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </AnimateIcon>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <m.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-0 bg-bg min-[900px]:hidden overflow-y-auto"
            data-lenis-prevent
            // Full-screen, so it settles in from the centre rather than growing from the toggle.
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            <div className="min-h-full flex flex-col items-center justify-center gap-12 px-5 pt-24 pb-12 text-center">
              <nav aria-label="Menu links" className="flex flex-col items-center gap-4">
                {LINKS.map((link, i) => (
                  <a
                    key={link.href}
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={hrefFor(link.href)}
                    onClick={(e) => {
                      closeForLink();
                      goHome(link.href)(e);
                    }}
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
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
