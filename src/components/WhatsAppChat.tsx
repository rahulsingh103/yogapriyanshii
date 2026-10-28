import { useEffect, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { WHATSAPP_PREFILL, whatsappUrl } from '@/constants/contact';
import { WhatsAppGlyph } from './WhatsAppGlyph';

interface WhatsAppChatProps {
  /** True while a modal sheet or the mobile menu is open. */
  hidden: boolean;
  /** Changes once a new page has mounted, so the sections are looked up again. */
  pageKey?: number | null;
}

const SPRING = { type: 'spring', bounce: 0, duration: 0.3 } as const;
const FADE = { duration: 0.2 } as const;

/** Tracks the browser's connection, like OfflineNotice: the wa.me link is no use offline. */
function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Sections with their own WhatsApp link or actions: How it works (the call link), Contact (the pill), a class page's and an article's actions. */
const OWN_LINK_SECTIONS = ['how-it-works', 'contact', 'class-actions', 'article-actions'];

/**
 * True while any of those sections is on screen (the same IntersectionObserver pattern as
 * StickyBookBar), so the floating button steps aside and two WhatsApp links never show together.
 */
function useOwnLinkSectionInView(pageKey: number | null | undefined) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    setInView(false); // the last page's sections are gone
    const targets = OWN_LINK_SECTIONS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (targets.length === 0) return;
    const seen = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target, entry.isIntersecting);
      setInView([...seen.values()].some(Boolean));
    });
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pageKey]);
  return inView;
}

/**
 * The floating WhatsApp button (DESIGN_SYSTEM §4): the familiar green circle that opens a chat with
 * Priyanshi in one tap, with the first message typed in. Bottom right; on phones it sits above the
 * sticky book bar. Hidden while a modal or the menu is open, while How it works or Contact (each with its own
 * WhatsApp link) is on screen, and while offline. Render it only when WHATSAPP_ENABLED.
 */
export function WhatsAppChat({ hidden, pageKey }: WhatsAppChatProps) {
  const online = useOnline();
  const sectionInView = useOwnLinkSectionInView(pageKey);
  const reduceMotion = useReducedMotion();
  const visible = !hidden && online && !sectionInView;

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: FADE }
    : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 }, transition: SPRING };

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="whatsapp-chat"
          data-testid="whatsapp-chat"
          className="fixed z-40 right-5 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] sm:right-6 sm:bottom-6 origin-bottom-right"
          {...motionProps}
        >
          <a
            href={whatsappUrl(WHATSAPP_PREFILL)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with Priyanshi on WhatsApp"
            className="press inline-flex items-center justify-center size-14 rounded-full bg-whatsapp text-on-whatsapp shadow-[0_8px_24px_color-mix(in_srgb,var(--color-ink)_22%,transparent)] hover:brightness-105 transition duration-200 ease-spring active:duration-100 contrast-more:outline contrast-more:outline-2 contrast-more:outline-ink"
          >
            <WhatsAppGlyph size={28} />
          </a>
        </m.div>
      )}
    </AnimatePresence>
  );
}
