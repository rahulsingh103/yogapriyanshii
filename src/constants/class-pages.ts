/**
 * The copy for the 11 class pages (/classes/<slug>). Plain data and pure functions only, like faq.ts:
 * relative imports, no `@/` paths and no `import.meta.env`, because vite.config.ts (the prerender)
 * and src/lib/route-html.ts read it too. Only the lazy ClassPage chunk imports it on the client, so
 * none of this text is in the homepage bundle.
 *
 * Facts only (design/PRIYANSHI-FACTS.md). Never: cure, treat, heal (the class name "Spine Healing"
 * aside), guarantee, "safe for", prevent, the video tool's name or the former studio's name.
 * Origins are neutral and well known (no founder named where none is clear); focus lists say what a
 * class works on, never what it fixes. Contact-only pages never say "Book" or "free". Intensity labels
 * and the new classes' durations (classes.ts) are placeholders until Priyanshi checks them.
 */
import type { ClassName } from './class-finder';
import { FINDER_BACK_NOTICE, FINDER_PREGNANCY_NOTICE } from './class-finder';
import { PRACTICE_CLASSES, type PracticeClass } from './classes';
import { TESTIMONIALS, type Testimonial } from './testimonials';
import { CLASS_PAGE_ON_REQUEST_LINE } from './on-request';

export interface ClassPhoto {
  src: string;
  /** Only when an 800w version exists. */
  srcSet?: string;
  width: number;
  height: number;
  alt: string;
  /** CSS object-position, so the pose stays in the 4:5 frame. */
  position: string;
  /** Rendered width cap in px: a 480w source is never shown much past 1.5x its size. */
  maxWidth: number;
}

export interface ClassPageContent {
  whoFor: string;
  about: string;
  /** "Where it comes from": one neutral, well-known sentence (25 words at most); hedged, never a health claim. */
  origin: string;
  /** "What it focuses on": 2 to 4 short body areas or qualities, shown as one line ("Hips · Spine"). */
  focus: ReadonlyArray<string>;
  /** The Format row of the details list. */
  format: string;
  /** PRD §5 level, for the 4 timetabled classes only. */
  level: string | null;
  intensity: string;
  notices: ReadonlyArray<string>;
  metaTitle: string;
  metaDescription: string;
  photo: ClassPhoto;
  testimonial: Testimonial | null;
}

/** The owner's line for the classes that aren't on the timetable (on-request.ts, shared with on-request articles). */
export { CLASS_PAGE_ON_REQUEST_LINE };
export const CLASS_PAGE_BOOKABLE_LINE = 'In person in Dubai or live online. Your first class is free.';
export const CLASS_PAGE_PRIVATE_LINE = 'Private, one-to-one sessions, arranged with Priyanshi.';

/** "What to bring" (facts, owner answers 6 and 7). Online students get the link; the tool is never named. */
export const BEFORE_CLASS: ReadonlyArray<string> = [
  'Comfortable clothes you can move in.',
  'Water.',
  'Your own mat, for in-person classes.',
  'No heavy meal for 2 hours before.',
  'Tell Priyanshi about any injuries, health conditions or pregnancy beforehand.',
  'Arrive or log in 5–10 minutes early. Online, Priyanshi sends you the class link.',
];

/** "What to bring" for a page: private Aerial uses the hammock, so it drops the own-mat line. */
export function classBeforeList(kind: ClassPageKind): ReadonlyArray<string> {
  return kind === 'private' ? BEFORE_CLASS.filter((item) => !item.startsWith('Your own mat')) : BEFORE_CLASS;
}

/** The WhatsApp first message from a class page: the class name only, never personal data. */
export function classPagePrefill(name: string) {
  return `Hi Priyanshi, I found you on yogapriyanshi.com and I'd like to know more about your ${name} class.`;
}

/** The photo's width cap as a literal Tailwind class (so Tailwind sees it); React and the static HTML share it. */
export function classPhotoMaxClass(photo: ClassPhoto) {
  return photo.maxWidth === 400 ? 'max-w-[400px]' : 'max-w-[320px]';
}

/** `sizes` for photos with a srcset: the column width from lg, else the phone width (minus the 20px gutters). */
export function classPhotoSizes(photo: ClassPhoto) {
  return `(min-width: 1024px) ${photo.maxWidth}px, min(calc(100vw - 40px), ${photo.maxWidth}px)`;
}

const REAL = '/media/images/real';

// Real photos of Priyanshi on every page until the shoot (owner decision 2026-10-26, plan P16).
const PHOTOS = {
  seatedBackbend: { src: `${REAL}/seated-backbend-480.webp`, width: 443, height: 529, position: '50% 50%', maxWidth: 320, alt: 'Priyanshi in a seated backbend holding her raised foot, the Burj Khalifa behind her' },
  flyingSplit: { src: `${REAL}/flying-split-480.webp`, width: 449, height: 525, position: '50% 50%', maxWidth: 320, alt: 'Priyanshi in a flying split arm balance on the lawn below the Burj Khalifa' },
  kingPigeon: { src: `${REAL}/king-pigeon-480.webp`, width: 443, height: 530, position: '50% 50%', maxWidth: 320, alt: 'Priyanshi in a king pigeon backbend on a mat in a Dubai park' },
  forearmSplit: { src: `${REAL}/forearm-split-480.webp`, width: 443, height: 525, position: '50% 50%', maxWidth: 320, alt: 'Priyanshi in a forearm stand with her legs split, the Burj Khalifa behind her' },
  crow: { src: `${REAL}/crow-480.webp`, width: 449, height: 530, position: '50% 50%', maxWidth: 320, alt: 'Priyanshi balancing in crow pose on a mat on a lawn' },
  plow: { src: `${REAL}/plow-variation-480.webp`, width: 449, height: 529, position: '50% 50%', maxWidth: 320, alt: 'Priyanshi in a shoulder stand variation with one leg raised, in a Dubai park' },
  burj1: {
    src: `${REAL}/burj-forearm-stand-1-800.webp`,
    srcSet: `${REAL}/burj-forearm-stand-1-480.webp 480w, ${REAL}/burj-forearm-stand-1-800.webp 800w, ${REAL}/burj-forearm-stand-1-1200.webp 1200w`,
    width: 800, height: 1067, position: '50% 70%', maxWidth: 400,
    alt: 'Priyanshi in a forearm stand on a mat on the lawn below the Burj Khalifa, Dubai',
  },
  burj2: {
    src: `${REAL}/burj-forearm-stand-2-800.webp`,
    srcSet: `${REAL}/burj-forearm-stand-2-480.webp 480w, ${REAL}/burj-forearm-stand-2-800.webp 800w`,
    width: 800, height: 1422, position: '50% 72%', maxWidth: 400,
    alt: 'Priyanshi in a forearm stand with one knee bent, the Burj Khalifa and the UAE flag behind her',
  },
  aerial: {
    src: '/media/images/practice/aerial-800.webp',
    srcSet: '/media/images/practice/aerial-480.webp 480w, /media/images/practice/aerial-800.webp 800w',
    width: 800, height: 993, position: '50% 50%', maxWidth: 400,
    alt: 'Priyanshi seated in a blue aerial hammock by a window, arms raised',
  },
} satisfies Record<string, ClassPhoto>;

const review = (className: string): Testimonial => {
  const found = TESTIMONIALS.find((t) => t.className === className);
  if (!found) throw new Error(`Unknown testimonial: ${className}`);
  return found;
};

const meta = (name: string, metaDescription: string) => ({ metaTitle: `${name} in Dubai · YogaPriyanshi`, metaDescription });

/** Keyed by ClassName, so a missing or misspelt class is a compile error. */
export const CLASS_PAGES: Record<ClassName, ClassPageContent> = {
  Hatha: {
    whoFor: 'Anyone starting out, and anyone who wants to come back to the basics. No experience needed.',
    about:
      'Foundational postures, precise alignment and the link between breath and movement. The pace is steady, so there is time to settle into each posture before the next.',
    origin: 'Traditional physical yoga from India, described in texts such as the 15th-century Hatha Yoga Pradipika.',
    focus: ['Whole body', 'Alignment', 'Breath'],
    format: 'In person or live online',
    level: 'All levels',
    intensity: 'Gentle–Moderate',
    notices: [],
    ...meta('Hatha', 'Hatha yoga with Priyanshi in Dubai: foundational postures, precise alignment and breath. In person or live online. Your first class is free.'),
    photo: PHOTOS.seatedBackbend,
    testimonial: null,
  },
  Barre: {
    whoFor: 'Anyone who wants strength and flexibility in one class. All levels are welcome.',
    about:
      'Strength work woven with deep, intentional stretching. Small, controlled movements build heat and tone, then long holds open everything back up.',
    origin: 'A modern blend of ballet-barre exercises with yoga and Pilates.',
    focus: ['Legs', 'Glutes', 'Core', 'Flexibility'],
    format: 'In person or live online',
    level: 'All levels',
    intensity: 'Moderate',
    notices: [],
    ...meta('Barre', 'Barre yoga with Priyanshi in Dubai: small, controlled strength work and deep stretching. In person or live online. Your first class is free.'),
    photo: PHOTOS.flyingSplit,
    testimonial: review('Barre Yoga'),
  },
  Wheel: {
    whoFor: 'Anyone curious about backbends and chest openers, with the yoga wheel there for support. All levels are welcome.',
    about:
      "Priyanshi's signature class. The yoga wheel supports your spine through backbends and chest openers that feel impossible without it, then suddenly don't.",
    origin: 'A modern practice built around the yoga wheel, a round prop that became popular in the 2010s.',
    focus: ['Chest', 'Shoulders', 'Backbends'],
    format: 'In person or live online',
    level: 'All levels',
    intensity: 'Moderate–Strong',
    notices: [FINDER_BACK_NOTICE],
    ...meta('Wheel', "Wheel yoga, Priyanshi's signature class in Dubai: backbends and chest openers with the yoga wheel. In person or live online. Your first class is free."),
    photo: PHOTOS.kingPigeon,
    testimonial: null,
  },
  'Chakra Flow': {
    whoFor: 'Anyone who would like a calmer, slower practice. Beginner friendly.',
    about:
      "A moving meditation through the body's energy centres, pairing breath, sound and sequence. Grounding, clearing and deeply restful.",
    origin: 'A modern flow organised around the chakras, the energy centres described in Indian tantric traditions.',
    focus: ['Breath', 'Sound', 'Gentle flow'],
    format: 'In person or live online',
    level: 'Beginner friendly',
    intensity: 'Gentle',
    notices: [],
    ...meta('Chakra Flow', 'Chakra Flow with Priyanshi in Dubai: a moving meditation pairing breath, sound and sequence. In person or live online. Your first class is free.'),
    photo: PHOTOS.forearmSplit,
    testimonial: null,
  },
  Vinyasa: {
    whoFor: 'Anyone with a few classes behind them who enjoys moving and would like a stronger, flowing practice.',
    about:
      'A breath-led flow from pose to pose. Each movement follows the breath, so the class builds strength and focus as it moves along.',
    origin: "A modern flowing style that grew out of Ashtanga's way of linking each movement to the breath.",
    focus: ['Strength', 'Breath', 'Focus'],
    format: 'In person or live online',
    level: null,
    intensity: 'Moderate–Strong',
    notices: [],
    ...meta('Vinyasa', 'Vinyasa yoga with Priyanshi in Dubai: a breath-led flow from pose to pose that builds strength and focus. In person or live online, on request.'),
    photo: PHOTOS.crow,
    testimonial: null,
  },
  Ashtanga: {
    whoFor: 'People who practise regularly and like structure: a strong, steady practice that follows the same order each time.',
    about:
      'Ashtanga follows a set sequence of postures with a steady breath. Because the sequence stays the same, you can feel your practice grow from one class to the next.',
    origin: 'The set sequence taught by K. Pattabhi Jois in Mysore, India, in the 20th century.',
    focus: ['Strength', 'Stamina', 'Steady breath'],
    format: 'In person or live online',
    level: null,
    intensity: 'Strong',
    notices: [],
    ...meta('Ashtanga', 'Ashtanga yoga with Priyanshi in Dubai: a set sequence with a steady breath, so you can feel your practice grow. In person or online, on request.'),
    photo: PHOTOS.burj2,
    testimonial: null,
  },
  'Spine Healing': {
    whoFor: 'Anyone looking for gentle back care and release, at a pace that suits them.',
    about:
      'Slow, gentle work for back care and release. You move at your own pace through calm, unhurried sequences, with time to breathe and let tension go.',
    origin: 'A modern, gentle style that centres the practice on the back and posture.',
    focus: ['Back', 'Posture', 'Gentle mobility'],
    format: 'In person or live online',
    level: null,
    intensity: 'Gentle',
    notices: [FINDER_BACK_NOTICE],
    ...meta('Spine Healing', 'Spine Healing with Priyanshi in Dubai: slow, gentle yoga for back care and release, at your own pace. In person or live online, on request.'),
    photo: PHOTOS.plow,
    testimonial: review('Spine Healing'),
  },
  'Mobility Yoga': {
    whoFor: 'Anyone who would like to move more easily day to day, whatever their experience.',
    about:
      'Gentle movement for your joints and everyday ease. Slow, mindful movements take each joint through its natural range, with the breath leading the way.',
    origin: 'A modern, gentle style that brings mobility work for the joints into a yoga practice.',
    focus: ['Joints', 'Hips', 'Shoulders'],
    format: 'In person or live online',
    level: null,
    intensity: 'Gentle',
    notices: [],
    ...meta('Mobility Yoga', 'Mobility yoga with Priyanshi in Dubai: gentle, mindful movement for your joints and everyday ease. In person or live online, on request.'),
    photo: PHOTOS.forearmSplit,
    testimonial: null,
  },
  'Yin Yoga': {
    whoFor: 'Anyone who would like to slow down and unwind, including people who already practise a stronger style.',
    about:
      'Long, quiet holds, mostly seated or lying down, that give your body time to slow down and let go. A calm, still practice.',
    origin: 'A slow style shaped in the West from the late 1970s by Paulie Zink, Paul Grilley and Sarah Powers, drawing on Taoist ideas.',
    focus: ['Hips', 'Spine', 'Stillness'],
    format: 'In person or live online',
    level: null,
    intensity: 'Gentle',
    notices: [],
    ...meta('Yin Yoga', 'Yin yoga with Priyanshi in Dubai: long, quiet holds that give your body time to slow down and let go. In person or live online, on request.'),
    photo: PHOTOS.seatedBackbend,
    testimonial: null,
  },
  'Prenatal & Postnatal': {
    whoFor: 'Mums-to-be, and mums after birth, who would like gentle yoga at their own pace.',
    about:
      'Gentle classes for before and after birth, with a teacher trained in prenatal yoga. Breath, gentle movement and rest, at a pace that suits you on the day.',
    origin: 'Yoga adapted for pregnancy and for the months after birth.',
    focus: ['Breath', 'Gentle movement', 'Rest'],
    format: 'In person or live online',
    level: null,
    intensity: 'Gentle',
    notices: [FINDER_PREGNANCY_NOTICE],
    ...meta('Prenatal & Postnatal', 'Prenatal and postnatal yoga in Dubai with Priyanshi, a teacher trained in prenatal yoga. Gentle classes, in person or live online, on request.'),
    photo: PHOTOS.burj1,
    testimonial: null,
  },
  'Aerial Yoga': {
    whoFor: 'Anyone who would like to try yoga in the aerial hammock, one to one with Priyanshi.',
    about:
      'Aerial yoga uses a soft hammock hung from the ceiling, so you can explore postures in a new way. With Priyanshi it is private sessions only, arranged with you on request.',
    origin: 'A modern practice in a soft fabric hammock, developed in the 1990s and 2000s.',
    focus: ['Core strength', 'Flexibility', 'Balance'],
    format: 'One-to-one',
    level: null,
    intensity: 'Moderate',
    notices: [],
    ...meta('Aerial Yoga', 'Private aerial yoga with Priyanshi in Dubai: one-to-one sessions in the aerial hammock, arranged with you on request.'),
    photo: PHOTOS.aerial,
    testimonial: null,
  },
};

export interface ClassDetailRow {
  /** data-testid suffix: class-<key>. */
  key: 'duration' | 'intensity' | 'level' | 'format' | 'focus' | 'origin';
  label: string;
  value: string;
  /** Spans both columns (the focus line and the origin sentence). */
  wide: boolean;
}

/** The details list, shared by ClassPage and the static HTML so the two always match. */
export function classDetailRows(cls: PracticeClass, content: ClassPageContent): ClassDetailRow[] {
  const duration = classDuration(cls);
  const row = (key: ClassDetailRow['key'], label: string, value: string, wide = false): ClassDetailRow => ({ key, label, value, wide });
  return [
    ...(duration ? [row('duration', 'Duration', duration)] : []),
    row('intensity', 'Intensity', content.intensity),
    ...(content.level ? [row('level', 'Level', content.level)] : []),
    row('format', 'Format', content.format),
    row('focus', 'What it focuses on', content.focus.join(' · '), true),
    row('origin', 'Where it comes from', content.origin, true),
  ];
}

/** "60 min" from the card line ("Alignment and breath · 60 min"); null for Aerial, which has no length. */
export function classDuration(cls: PracticeClass): string | null {
  return cls.line.match(/· (\d+ min)$/)?.[1] ?? null;
}

export type ClassPageKind = 'bookable' | 'onRequest' | 'private';

export function classPageKind(cls: PracticeClass): ClassPageKind {
  if (cls.style) return 'bookable';
  return cls.name === 'Aerial Yoga' ? 'private' : 'onRequest';
}

/** The line above the actions. */
export function classPageLine(kind: ClassPageKind) {
  return kind === 'bookable' ? CLASS_PAGE_BOOKABLE_LINE : kind === 'private' ? CLASS_PAGE_PRIVATE_LINE : CLASS_PAGE_ON_REQUEST_LINE;
}

/** The primary button's label: "Book" only when it really opens booking. */
export function classPagePrimaryLabel(kind: ClassPageKind) {
  return kind === 'bookable' ? 'Book a free class' : kind === 'private' ? 'Ask about private Aerial' : 'Ask about this class';
}

export interface ClassPageEntry {
  cls: PracticeClass;
  content: ClassPageContent;
}

/** The class and its page copy for a slug, or null. */
export function classPage(slug: string): ClassPageEntry | null {
  const cls = PRACTICE_CLASSES.find((c) => c.slug === slug);
  if (!cls) return null;
  return { cls, content: CLASS_PAGES[cls.name as ClassName] };
}
