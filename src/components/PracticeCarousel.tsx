import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { animateSingleValue, type AnimationPlaybackControls } from 'motion/react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowLeft } from '@/components/animate-ui/icons/arrow-left';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { DRAG_THRESHOLD, project, recordSample, releaseVelocity, rubberBand, type Sample } from '@/lib/gesture';
import { PRACTICE_CLASSES, type PracticeClass } from '../constants/classes';
import { isPlainClick } from '../hooks/use-route';
import { classPath } from '../lib/route';
import { FindClassLink } from './FindClassLink';
import { Reveal } from './Reveal';

interface PracticeCarouselProps {
  onSelectClass: (practice: PracticeClass) => void;
  onOpenClassFinder: () => void;
  /** "Learn more": the class page, in the app (no reload). */
  onLearnMore: (practice: PracticeClass) => void;
}

const ICON_BUTTON =
  'press hidden lg:inline-flex items-center justify-center size-11 rounded-full border border-line bg-bg/85 text-ink hover:border-ink transition duration-200 ease-spring active:duration-100';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The scrollLeft at which each card snaps (snap-start, clamped to the scroll range), ascending. */
function snapOffsets(track: HTMLDivElement) {
  const max = track.scrollWidth - track.clientWidth;
  const origin = track.getBoundingClientRect().left - track.scrollLeft + track.clientLeft;
  const offsets = Array.from(track.querySelectorAll<HTMLElement>('[data-testid="practice-card"]')).map((card) =>
    Math.min(Math.max(Math.round(card.getBoundingClientRect().left - origin), 0), max)
  );
  return [...new Set(offsets)].sort((a, b) => a - b);
}

const nearest = (offsets: number[], x: number) =>
  offsets.reduce((best, o) => (Math.abs(o - x) < Math.abs(best - x) ? o : best), offsets[0] ?? 0);

/**
 * Touch scrolling stays native (scroll-snap). Arrows and arrow keys glide on a critically damped
 * spring to the exact next snap; a desktop mouse can grab the track and throw it (1:1, rubber-band
 * at the ends, momentum projected to a snap). Any glide can be interrupted by a new press, a grab,
 * a wheel or a touch.
 */
export function PracticeCarousel({ onSelectClass, onOpenClassFinder, onLearnMore }: PracticeCarouselProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const glideRef = useRef<{ controls: AnimationPlaybackControls; target: number; lastSet: number } | null>(null);
  const bandRef = useRef<AnimationPlaybackControls | null>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    dragging: boolean;
    position: number;
    /** Scroll range and track width, measured once at the press so pointermove never reads layout. */
    max: number;
    width: number;
    history: Sample[];
  } | null>(null);

  const stopGlide = () => {
    const glide = glideRef.current;
    if (!glide) return;
    glideRef.current = null;
    glide.controls.stop();
    const track = trackRef.current;
    if (!track) return;
    // Turning snap back on makes Chrome re-snap to the card it last snapped to, not the nearest one.
    // Keep the position the user (or their scroll) left it at, and let snap settle from there.
    const left = track.scrollLeft;
    delete track.dataset.gliding;
    if (Math.abs(track.scrollLeft - left) > 0.5) track.scrollLeft = left;
  };

  const glideTo = (target: number, { velocity = 0, bounce = 0 }: { velocity?: number; bounce?: number } = {}) => {
    const track = trackRef.current;
    if (!track) return;
    stopGlide();
    if (prefersReducedMotion()) {
      track.scrollLeft = target;
      return;
    }
    track.dataset.gliding = '';
    const controls = animateSingleValue(track.scrollLeft, target, {
      type: 'spring',
      bounce,
      duration: 0.45,
      velocity,
      onUpdate: (left) => {
        const glide = glideRef.current;
        if (!glide) return;
        // Something else scrolled the track since the last frame: hand it back, don't overwrite it.
        if (Math.abs(track.scrollLeft - glide.lastSet) > 2) {
          stopGlide();
          return;
        }
        track.scrollLeft = left;
        glide.lastSet = track.scrollLeft;
      },
    });
    glideRef.current = { controls, target, lastSet: track.scrollLeft };
    controls.then(() => {
      if (glideRef.current?.controls !== controls) return;
      glideRef.current = null;
      delete track.dataset.gliding;
    });
  };

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const offsets = snapOffsets(track);
    // Repeated presses build on the glide already in flight.
    const from = glideRef.current?.target ?? track.scrollLeft;
    const target =
      direction === 1 ? offsets.find((o) => o > from + 2) : [...offsets].reverse().find((o) => o < from - 2);
    if (target !== undefined) glideTo(target);
  };

  // A wheel, a touch or a scroll we didn't make (scrollbar, scrollTo) hands control back to the user.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const glide = glideRef.current;
      if (glide && Math.abs(track.scrollLeft - glide.lastSet) > 2) stopGlide();
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('wheel', stopGlide, { passive: true });
    track.addEventListener('touchstart', stopGlide, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('wheel', stopGlide);
      track.removeEventListener('touchstart', stopGlide);
      stopGlide();
      bandRef.current?.stop();
    };
  }, []);

  // The rubber band moves the whole track, so the section clips sideways only while it's stretched.
  // (A permanent clip would stop the off-screen cards' lazy images from preloading.)
  const setBand = (px: number) => {
    const track = trackRef.current;
    if (track) track.style.translate = px ? `${px}px 0` : '';
    sectionRef.current?.toggleAttribute('data-banding', px !== 0);
  };

  // Desktop mouse only: touch and pen keep the native swipe.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    // Any new press (mouse, touch or pen) ends a click block left by a cancelled drag.
    suppressClickRef.current = false;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    stopGlide(); // grabbing a moving track stops it where it is
    // A press whose release we never saw can leave the drag styles behind: start clean.
    delete track.dataset.dragging;
    if (!glideRef.current) delete track.dataset.gliding;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: track.scrollLeft,
      dragging: false,
      position: track.scrollLeft,
      max: track.scrollWidth - track.clientWidth,
      width: track.clientWidth,
      history: [{ t: e.timeStamp, v: track.scrollLeft }],
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const drag = dragRef.current;
    if (!track || !drag || e.pointerId !== drag.pointerId) return;
    // The button came up somewhere we didn't hear about (released off the track before the drag
    // began, or capture lost): this is a hover, not a drag. End or forget the stale press.
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      if (drag.dragging) onPointerEnd(e);
      else dragRef.current = null;
      return;
    }
    const delta = e.clientX - drag.startX;
    if (!drag.dragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      drag.dragging = true;
      stopGlide();
      bandRef.current?.stop();
      setBand(0);
      track.setPointerCapture(e.pointerId);
      track.dataset.gliding = '';
      track.dataset.dragging = '';
    }
    // 1:1 with the pointer from where it grabbed; past either end the track rubber-bands.
    const { max, width } = drag;
    const position = drag.startScroll - delta;
    drag.position = position;
    track.scrollLeft = Math.min(Math.max(position, 0), max);
    setBand(position < 0 ? rubberBand(-position, width) : position > max ? -rubberBand(position - max, width) : 0);
    recordSample(drag.history, e.timeStamp, position);
  };

  // Also runs on pointercancel, lostpointercapture (capture taken away without a pointerup) and a
  // buttonless pointermove (the release happened where we couldn't see it): all end with no momentum.
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const drag = dragRef.current;
    if (!track) return;
    if (!drag || e.pointerId !== drag.pointerId) {
      // The mouseup after a drag that ended early: let its click be swallowed, then stand down.
      if (e.type === 'pointerup' && suppressClickRef.current)
        window.setTimeout(() => (suppressClickRef.current = false), 0);
      return;
    }
    dragRef.current = null;
    if (!drag.dragging) return; // a plain click: the card's own onClick handles it
    if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
    delete track.dataset.dragging;
    delete track.dataset.gliding;
    // The click that follows a real drag must not open a class. After a pointerup that click comes
    // straight away; after any other end the mouseup is still to come, so hold the flag until the
    // next pointerup (above) or pointerdown clears it.
    const released = e.type === 'pointerup';
    suppressClickRef.current = true;
    if (released) window.setTimeout(() => (suppressClickRef.current = false), 0);

    const velocity = released ? releaseVelocity(drag.history, e.timeStamp) : 0;
    const offsets = snapOffsets(track);
    const { max } = drag;
    const band = parseFloat(track.style.translate) || 0;
    if (band) {
      // Released past an end: the band springs home, no momentum through the wall.
      bandRef.current?.stop();
      if (prefersReducedMotion()) setBand(0);
      else {
        const controls = animateSingleValue(band, 0, { type: 'spring', bounce: 0, duration: 0.4, onUpdate: setBand });
        bandRef.current = controls;
      }
      glideTo(drag.position < 0 ? 0 : max);
      return;
    }
    glideTo(nearest(offsets, drag.position + project(velocity)), { velocity, bounce: 0.15 });
  };

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    // detail 0 is a keyboard (or programmatic) click: never one that ends a drag.
    if (!suppressClickRef.current || e.detail === 0) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // cards keep their own keys
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollByCard(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollByCard(-1);
    }
  };

  return (
    <section ref={sectionRef} id="classes" className="py-20 lg:py-32 data-[banding]:overflow-x-clip">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display font-normal text-h2 text-ink">
              Choose your practice
            </h2>
            <div className="flex gap-2">
              <AnimateIcon animateOnHover asChild>
                <button type="button" aria-label="Previous classes" onClick={() => scrollByCard(-1)} className={ICON_BUTTON}>
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
              </AnimateIcon>
              <AnimateIcon animateOnHover asChild>
                <button type="button" aria-label="Next classes" onClick={() => scrollByCard(1)} className={ICON_BUTTON}>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </AnimateIcon>
            </div>
          </div>
          {/* Its own row, so the arrow row keeps only the heading and the arrows. */}
          <FindClassLink onOpen={onOpenClassFinder} />
        </div>

        <div
          ref={trackRef}
          role="group"
          tabIndex={0}
          aria-label="Classes, swipe or use the arrow keys"
          onKeyDown={onTrackKey}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onClickCapture={onClickCapture}
          className="practice-track [@media(pointer:fine)]:cursor-grab data-[dragging]:cursor-grabbing grid grid-flow-col auto-cols-[min(78%,300px)] gap-4 overflow-x-auto snap-x snap-mandatory pt-2 pb-3 rounded-[18px]"
        >
          {PRACTICE_CLASSES.map((practice, i) => (
            // The wrapper snaps and stretches to the row's height; the card button inside is unchanged.
            // "Learn more" sits under it (a link can't live inside a button), and the track's
            // onClickCapture swallows its click after a drag, as it does for the card.
            <div key={practice.name} data-card-slug={practice.slug} className="snap-start flex flex-col gap-1 min-w-0">
            <button
              type="button"
              data-testid="practice-card"
              onClick={() => onSelectClass(practice)}
              className="card-lift [@media(pointer:fine)]:cursor-grab focus-visible:outline-offset-[-3px] snap-start flex-1 grid grid-rows-[auto_1fr] min-w-0 text-left bg-glass backdrop-blur-[8px] rounded-[18px] overflow-hidden transition-transform duration-500 ease-spring hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <img
                src={`/media/images/practice/${practice.image}-480.webp`}
                srcSet={
                  practice.smallImageOnly
                    ? undefined
                    : `/media/images/practice/${practice.image}-480.webp 480w, /media/images/practice/${practice.image}-800.webp 800w`
                }
                sizes={practice.smallImageOnly ? undefined : '300px'}
                width={480}
                height={596}
                loading={i < 2 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                alt=""
                data-pose={practice.alt}
                className="w-full aspect-[4/5] object-cover bg-surface-alt"
              />
              <div className="p-4 pb-5 flex flex-col gap-1">
                <h3 className="font-display font-normal text-h3 text-ink">{practice.name}</h3>
                <p className="text-sm leading-[1.5] text-ink-soft">{practice.line}</p>
              </div>
            </button>
            <a
              href={classPath(practice.slug)}
              draggable={false}
              aria-label={`Learn more about ${practice.name}`}
              onClick={(e) => {
                if (!isPlainClick(e)) return; // a new tab or window keeps the browser's own behaviour
                e.preventDefault();
                onLearnMore(practice);
              }}
              className="self-start inline-flex items-center min-h-11 px-4 text-sm font-semibold text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink transition-colors duration-200 focus-visible:outline-offset-[-3px] [@media(pointer:fine)]:cursor-pointer"
            >
              Learn more
            </a>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
