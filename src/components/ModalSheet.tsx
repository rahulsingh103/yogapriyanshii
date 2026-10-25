import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  AnimatePresence,
  animateSingleValue,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from 'motion/react';
import { useLenis } from 'lenis/react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { X } from '@/components/animate-ui/icons/x';
import { DRAG_THRESHOLD, project, recordSample, releaseVelocity, rubberBand, type Sample } from '@/lib/gesture';
import { cn } from '@/lib/utils';

interface ModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** id of the visible heading that names the dialog. */
  labelledBy: string;
  /** Optional space-separated ids that describe the dialog, read out when it opens (the class finder's first question). */
  describedBy?: string;
  /** Accessible name of the close button (the e2e helpers find modals by it). */
  closeLabel: string;
  /** Admin needs room for its tables. */
  size?: 'default' | 'wide';
  /** Phone only: drag the grabber strip down to dismiss. Off for Admin and while a form is sending. */
  dismissible?: boolean;
  children: ReactNode;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;
const PHONE_QUERY = '(max-width: 639px)';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal shell (DESIGN_SYSTEM §4, §7) for Booking, Cancel, Admin, Contact and the class finder.
 * Centred sheet from 640px, a bottom sheet below. While open: Escape closes it, Tab stays
 * inside, the page behind is inert and Lenis is stopped; on close, focus returns to the opener.
 * The outer `div.fixed.inset-0` and "close button first" order are relied on by the e2e helpers.
 *
 * On a phone the sheet can be dragged down by its grabber strip (the top 48px only, so content
 * scrolling and form fields stay native): it follows the finger 1:1, resists upwards, and on release
 * projects the flick's momentum. Past half its height it springs away with the finger's velocity and
 * closes; otherwise it springs back. Grabbing it mid-flight stops the spring and keeps tracking.
 */
export function ModalSheet({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  closeLabel,
  size = 'default',
  dismissible = true,
  children,
}: ModalSheetProps) {
  const lenis = useLenis();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Drag offset of the panel (px, down is positive). Separate from the enter/exit animation, which
  // runs on the wrapper, so the two never fight over one `y`.
  const dragY = useMotionValue(0);
  const heightRef = useRef(1);
  const scrimOpacity = useTransform(dragY, (y) => 1 - Math.min(Math.max(y / heightRef.current, 0), 1));
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);
  const dismissTokenRef = useRef(0);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    base: number;
    tracking: boolean;
    history: Sample[];
  } | null>(null);
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

  // Closed some other way (Escape, the close button) while a dismiss spring was running: void it.
  // Reopened before the exit finished: start from rest again.
  useEffect(() => {
    if (!isOpen) {
      dismissTokenRef.current += 1;
      dragRef.current = null;
      return;
    }
    controlsRef.current?.stop();
    controlsRef.current = null;
    dragY.jump(0);
  }, [isOpen, dragY]);

  const canDrag = isPhone && dismissible;

  // The grabber went away mid-drag (rotated past 640px, or `dismissible` turned off while sending):
  // drop the drag and put the sheet back at rest.
  useEffect(() => {
    if (canDrag) return;
    if (!dragRef.current && !controlsRef.current && dragY.get() === 0) return;
    dragRef.current = null;
    dismissTokenRef.current += 1; // a pending dismiss no longer applies
    controlsRef.current?.stop();
    controlsRef.current = null;
    dragY.jump(0);
  }, [canDrag, dragY]);

  const onGrabStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDrag || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const midFlight = !!controlsRef.current;
    controlsRef.current?.stop();
    controlsRef.current = null;
    dismissTokenRef.current += 1; // a re-grab cancels a pending dismiss
    heightRef.current = panelRef.current?.offsetHeight || 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      base: dragY.get(),
      tracking: midFlight, // caught mid-flight: follow at once, no threshold
      history: [{ t: e.timeStamp, v: dragY.get() }],
    };
  };

  const onGrabMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const delta = e.clientY - drag.startY;
    if (!drag.tracking) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      drag.tracking = true;
    }
    // 1:1 from where it was grabbed; above the resting point it rubber-bands.
    const raw = drag.base + delta;
    const y = raw < 0 ? rubberBand(raw, heightRef.current) : raw;
    dragY.set(y);
    recordSample(drag.history, e.timeStamp, y);
  };

  // Also runs on pointercancel and lostpointercapture (capture taken away without a pointerup):
  // both count as a cancel, which springs back and never dismisses.
  const onGrabEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isOpen) return;
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drag.tracking) return; // a tap on the grabber does nothing
    const cancelled = e.type !== 'pointerup';

    suppressClickRef.current = true;
    window.setTimeout(() => (suppressClickRef.current = false), 0);

    const y = dragY.get();
    const velocity = cancelled ? 0 : releaseVelocity(drag.history, e.timeStamp);
    const height = heightRef.current;
    const dismiss = !cancelled && y + project(velocity) > height * 0.5;

    if (dismiss) {
      const token = ++dismissTokenRef.current;
      if (reduceMotion) {
        onCloseRef.current(); // the exit cross-fades instead of sliding
        return;
      }
      const controls = animateSingleValue(dragY, height, { type: 'spring', bounce: 0, duration: 0.3, velocity });
      controlsRef.current = controls;
      controls.then(() => {
        if (dismissTokenRef.current !== token) return; // grabbed again before it finished
        controlsRef.current = null;
        onCloseRef.current();
      });
    } else if (reduceMotion) {
      dragY.jump(0);
    } else {
      // The one place the sheet may overshoot: a released drag carries the finger's momentum.
      const controls = animateSingleValue(dragY, 0, { type: 'spring', bounce: 0.15, duration: 0.3, velocity });
      controlsRef.current = controls;
      controls.then(() => {
        if (controlsRef.current === controls) controlsRef.current = null;
      });
    }
  };

  // Springs, not fixed curves (apple-design §4). Phone sheet: slides up and back down the same
  // path, critically damped (a programmatic open has no momentum to overshoot with); with reduced
  // motion it cross-fades. Wider: critically damped fade, rise and scale.
  const panelMotion = isPhone
    ? reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring' as const, bounce: 0, duration: 0.35 } }
    : {
        initial: { opacity: 0, y: 12, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.98 },
        transition: { type: 'spring' as const, bounce: 0, duration: 0.35 },
      };

  return (
    <AnimatePresence
      onExitComplete={() => {
        controlsRef.current?.stop();
        controlsRef.current = null;
        dragY.jump(0);
      }}
    >
      {isOpen && (
        <div key="modal" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <m.div
            aria-hidden="true"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <m.div className="material-scrim absolute inset-0 bg-ink/60 backdrop-blur-sm" style={{ opacity: scrimOpacity }} onClick={onClose} />
          </m.div>
          <m.div className={cn('relative w-full', size === 'wide' ? 'sm:max-w-[1040px]' : 'sm:max-w-[560px]')} {...panelMotion}>
            <m.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              aria-describedby={describedBy}
              tabIndex={-1}
              data-lenis-prevent
              style={{ y: dragY }}
              onClickCapture={(e) => {
                if (!suppressClickRef.current) return;
                e.preventDefault();
                e.stopPropagation();
              }}
              className={cn(
                'relative w-full bg-surface text-ink shadow-raised overflow-y-auto overscroll-contain focus:outline-none',
                'rounded-t-[20px] max-h-[92dvh] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
                canDrag && 'pt-7',
                'sm:rounded-[20px] sm:max-h-[90vh] sm:p-8'
              )}
            >
              <AnimateIcon animateOnHover asChild>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeLabel}
                  className="press absolute top-3 right-3 sm:top-5 sm:right-5 z-10 inline-flex items-center justify-center size-11 rounded-full border border-line bg-surface text-ink hover:border-ink transition duration-200 ease-spring active:duration-100"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </AnimateIcon>
              {canDrag && (
                // The grab strip: the top 48px of the sheet, under the close button. Decorative to
                // assistive tech (the close button and Escape do the same job).
                <div
                  aria-hidden="true"
                  data-testid="sheet-grabber"
                  className="absolute inset-x-0 top-0 z-[5] h-12 flex justify-center touch-none cursor-grab active:cursor-grabbing"
                  onPointerDown={onGrabStart}
                  onPointerMove={onGrabMove}
                  onPointerUp={onGrabEnd}
                  onPointerCancel={onGrabEnd}
                  onLostPointerCapture={onGrabEnd}
                >
                  <span className="mt-1.5 h-[5px] w-9 rounded-full bg-line-strong" />
                </div>
              )}
              {children}
            </m.div>
            {/* Phone only: surface below the sheet's bottom edge, moving with it, so an upward
                rubber-band (or a snap-back's small overshoot) never opens a gap onto the scrim. */}
            <m.div aria-hidden="true" className="sm:hidden pointer-events-none absolute inset-x-0 top-full h-[60dvh] bg-surface" style={{ y: dragY }} />
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
