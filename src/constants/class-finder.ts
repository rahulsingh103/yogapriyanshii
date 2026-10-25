/**
 * The "Find your class" quiz (ClassFinderModal): three questions, a mapping table and the copy for
 * each result. Plain data and pure functions only, like faq.ts: relative imports, no `@/` paths and
 * no `import.meta.env`. WhatsApp gating and the wa.me link stay in the component (contact.ts).
 *
 * Copy rules (Batch 2 plan, amendment A1): facts only, no medical, clearance or "safe" wording, and
 * "free" only on a bookable class in a group format.
 */
import type { ClassStyle } from '../types';
import { PRACTICE_CLASSES, type PracticeClass } from './classes';

export type Goal = 'relax' | 'flexibility' | 'strength' | 'back' | 'pregnancy' | 'unsure';
export type Experience = 'new' | 'some' | 'regular';
export type Format = 'in_person' | 'online' | 'private';

export interface FinderAnswers {
  goal: Goal;
  experience: Experience;
  format: Format;
}

/** The carousel's class names (classes.ts), so a typo in the table is a compile error. */
export type ClassName =
  | 'Hatha'
  | 'Barre'
  | 'Wheel'
  | 'Chakra Flow'
  | 'Vinyasa'
  | 'Ashtanga'
  | 'Spine Healing'
  | 'Mobility Yoga'
  | 'Yin Yoga'
  | 'Prenatal & Postnatal'
  | 'Aerial Yoga';

export interface FinderQuestion {
  key: keyof FinderAnswers;
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

export const FINDER_QUESTIONS: ReadonlyArray<FinderQuestion> = [
  {
    key: 'goal',
    title: 'What would you like yoga to give you?',
    options: [
      { value: 'relax', label: 'Calm and less stress' },
      { value: 'flexibility', label: 'Flexibility' },
      { value: 'strength', label: 'Strength' },
      { value: 'back', label: 'Back care' },
      { value: 'pregnancy', label: 'Pregnancy or after birth' },
      { value: 'unsure', label: 'Not sure yet' },
    ],
  },
  {
    key: 'experience',
    title: 'How much yoga have you done?',
    options: [
      { value: 'new', label: "I'm new to yoga" },
      { value: 'some', label: "I've done a few classes" },
      { value: 'regular', label: 'I practise regularly' },
    ],
  },
  {
    key: 'format',
    title: 'How would you like to practise?',
    options: [
      { value: 'in_person', label: 'In person in Dubai' },
      { value: 'online', label: 'Live online' },
      { value: 'private', label: 'Private, one to one' },
    ],
  },
];

/** Why this class suits the answers. The class's own `line` from classes.ts shows underneath. */
export const FINDER_REASONS: Record<ClassName, string> = {
  Hatha: 'Clear, steady postures and the link between breath and movement. No experience needed.',
  Barre: 'Strength work and deep stretching in one class, with small, controlled movements.',
  Wheel: "Priyanshi's signature class. The yoga wheel supports your spine through backbends and chest openers.",
  'Chakra Flow': 'A moving meditation that pairs breath and sequence. Beginner friendly and deeply restful.',
  Vinyasa: 'A breath-led flow from pose to pose that builds strength and focus.',
  Ashtanga: 'A set sequence with a steady breath, so you can feel your practice grow.',
  'Spine Healing': 'Gentle work for back care and release, at a pace that suits you.',
  'Mobility Yoga': 'Gentle movement for your joints and everyday ease.',
  'Yin Yoga': 'Long, quiet holds that give your body time to slow down and let go.',
  'Prenatal & Postnatal': 'Classes for before and after birth, with a teacher trained in prenatal yoga.',
  'Aerial Yoga': 'One-to-one sessions in the aerial hammock, arranged with Priyanshi on request.',
};

export const FINDER_FORMAT_NOTES: Record<Format, string> = {
  in_person: 'In person in Dubai.',
  online: 'Live online. Priyanshi sends you the class link.',
  private: 'Just you and Priyanshi. She arranges the details with you.',
};

export const FINDER_FREE_LINE = 'Your first class is free.';
export const FINDER_NOT_SCHEDULED_LINE =
  'Not on the timetable. Send a message and Priyanshi will find a time with you.';
export const FINDER_PREGNANCY_NOTICE =
  "Let Priyanshi know you're pregnant, or when you gave birth, before your first class.";
export const FINDER_BACK_NOTICE = 'Tell Priyanshi about any back injury or pain before class.';

type Pick = readonly [ClassName, ClassName | null];

/** [main, alternative] for in person and online. The Record types make the compiler check every combination. */
const GROUP_TABLE: Record<Goal, Record<Experience, Pick>> = {
  relax: { new: ['Chakra Flow', 'Yin Yoga'], some: ['Yin Yoga', 'Chakra Flow'], regular: ['Yin Yoga', 'Chakra Flow'] },
  flexibility: { new: ['Hatha', 'Mobility Yoga'], some: ['Barre', 'Yin Yoga'], regular: ['Wheel', 'Yin Yoga'] },
  strength: { new: ['Barre', 'Hatha'], some: ['Vinyasa', 'Barre'], regular: ['Ashtanga', 'Vinyasa'] },
  back: { new: ['Spine Healing', 'Mobility Yoga'], some: ['Spine Healing', 'Hatha'], regular: ['Spine Healing', 'Mobility Yoga'] },
  pregnancy: { new: ['Prenatal & Postnatal', null], some: ['Prenatal & Postnatal', null], regular: ['Prenatal & Postnatal', null] },
  unsure: { new: ['Hatha', 'Chakra Flow'], some: ['Hatha', 'Vinyasa'], regular: ['Vinyasa', 'Wheel'] },
};

/** Private answers use the group table except here. Aerial is private sessions only, so it appears nowhere else. */
const PRIVATE_OVERRIDES: Partial<Record<Goal, Partial<Record<Experience, Pick>>>> = {
  strength: { some: ['Aerial Yoga', 'Vinyasa'], regular: ['Aerial Yoga', 'Ashtanga'] },
  flexibility: { some: ['Aerial Yoga', 'Barre'], regular: ['Aerial Yoga', 'Wheel'] },
};

export function recommend({ goal, experience, format }: FinderAnswers): { main: ClassName; alt: ClassName | null } {
  const [main, alt] = (format === 'private' && PRIVATE_OVERRIDES[goal]?.[experience]) || GROUP_TABLE[goal][experience];
  return { main, alt };
}

export function finderClass(name: ClassName): PracticeClass {
  const found = PRACTICE_CLASSES.find((c) => c.name === name);
  if (!found) throw new Error(`Unknown class: ${name}`);
  return found;
}

export type FinderChoice =
  | { kind: 'booking'; style: ClassStyle; mode: 'in_person' | 'online' }
  | { kind: 'contact'; interest: string };

/** The primary button: never "Book this class" unless it really opens booking for that class. */
export function resultAction(name: ClassName, format: Format): { label: string; choice: FinderChoice } {
  const cls = finderClass(name);
  if (name === 'Aerial Yoga') {
    return { label: 'Ask about private Aerial', choice: { kind: 'contact', interest: cls.contactInterest ?? 'Private Aerial Yoga' } };
  }
  if (format === 'private') {
    if (name === 'Prenatal & Postnatal') {
      return { label: 'Ask about this class', choice: { kind: 'contact', interest: 'Prenatal & Postnatal' } };
    }
    return { label: 'Ask about a private session', choice: { kind: 'contact', interest: 'Private session' } };
  }
  if (cls.style) return { label: 'Book this class', choice: { kind: 'booking', style: cls.style, mode: format } };
  return { label: 'Ask about this class', choice: { kind: 'contact', interest: cls.contactInterest ?? 'General enquiry' } };
}

/** The quiet lines under the class: the format note, then the free or not-on-the-timetable line. */
export function resultLines(name: ClassName, { goal, format }: FinderAnswers) {
  const bookable = !!finderClass(name).style;
  const extra = format === 'private' ? null : bookable ? FINDER_FREE_LINE : FINDER_NOT_SCHEDULED_LINE;
  const notices = [
    ...(goal === 'pregnancy' ? [FINDER_PREGNANCY_NOTICE] : []),
    ...(goal === 'back' ? [FINDER_BACK_NOTICE] : []),
  ];
  return { formatNote: FINDER_FORMAT_NOTES[format], extra, notices };
}

const PREFILL_GOAL: Record<Goal, string> = {
  relax: 'calm and less stress',
  flexibility: 'more flexibility',
  strength: 'more strength',
  back: 'back care',
  pregnancy: 'yoga in pregnancy or after birth',
  unsure: 'a bit of everything',
};

const PREFILL_EXPERIENCE: Record<Experience, string> = {
  new: 'new to yoga',
  some: 'fairly new, with a few classes behind me',
  regular: 'practising regularly',
};

const PREFILL_FORMAT: Record<Format, string> = {
  in_person: 'in person in Dubai',
  online: 'live online',
  private: 'one to one',
};

/** The WhatsApp first message: fixed labels only, never anything the person typed. */
export function classFinderPrefill({ goal, experience, format }: FinderAnswers, name: ClassName) {
  return (
    `Hi Priyanshi, I found you on yogapriyanshi.com and used the class finder. ` +
    `I'm looking for ${PREFILL_GOAL[goal]}, I'm ${PREFILL_EXPERIENCE[experience]}, ` +
    `and I'd like to practise ${PREFILL_FORMAT[format]}. It suggested ${name}. Is that a good fit for me?`
  );
}
