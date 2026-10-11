import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useLenis } from 'lenis/react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { X } from '@/components/animate-ui/icons/x';
import { cn } from '@/lib/utils';

interface ModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** id of the visible heading that names the dialog. */
  labelledBy: string;
  /** Accessible name of the close button (the e2e helpers find modals by it). */
  closeLabel: string;
  /** Admin needs room for its tables. */
  size?: 'default' | 'wide';
  children: ReactNode;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;
const PHONE_QUERY = '(max-width: 639px)';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal shell (DESIGN_SYSTEM §4, §7) for Booking, Cancel, Admin and Contact.
 * Centred sheet from 640px, a bottom sheet below. While open: Escape closes it, Tab stays
 * inside, the page behind is inert and Lenis is stopped; on close, focus returns to the opener.
 * The outer `div.fixed.inset-0` and "close button first" order are relied on by the e2e helpers.
 */
export function ModalSheet({ isOpen, onClose, labelledBy, closeLabel, size = 'default', children }: ModalSheetProps) {
  const lenis = useLenis();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lenis?.stop();
    const background = Array.from(document.querySelectorAll<HTMLElement>('header, main, footer'));
    background.forEach((el) => el.setAttribute('inert', ''));
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0
      );
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && panel.contains(active) && active !== panel;
      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      background.forEach((el) => el.removeAttribute('inert'));
      lenis?.start();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen, lenis]);

  // Phone: slides up from the bottom (350ms). Wider: fades in with a 12px rise (300ms).
  const panelMotion = isPhone
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { duration: 0.35, ease: EASE } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 12 },
        transition: { duration: 0.3, ease: EASE },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="modal" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <m.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            data-lenis-prevent
            className={cn(
              'relative w-full bg-surface text-ink shadow-raised overflow-y-auto overscroll-contain focus:outline-none',
              'rounded-t-[20px] max-h-[92dvh] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
              'sm:rounded-[20px] sm:max-h-[90vh] sm:p-8',
              size === 'wide' ? 'sm:max-w-[1040px]' : 'sm:max-w-[560px]'
            )}
            {...panelMotion}
          >
            <AnimateIcon animateOnHover asChild>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 inline-flex items-center justify-center size-11 rounded-full border border-line bg-surface text-ink hover:border-ink transition-colors duration-200"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </AnimateIcon>
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
