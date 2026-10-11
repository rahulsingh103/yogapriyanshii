import type { ClassStyle } from '../types';

export interface PracticeClass {
  name: string;
  /** "<benefit> · <duration>", shown under the name on the carousel card. */
  line: string;
  /** Bookable classes: the timetable style whose soonest session the card preselects. */
  style?: ClassStyle;
  /** Not-yet-scheduled classes: the contact interest the card presets instead. */
  contactInterest?: string;
}

/** The 8 classes of the "Choose your practice" carousel, in DESIGN_SYSTEM §4 order. */
export const PRACTICE_CLASSES: PracticeClass[] = [
  { name: 'Hatha', line: 'Alignment and breath · 60 min', style: 'hatha' },
  { name: 'Barre', line: 'Strength and stretch · 60 min', style: 'barre' },
  { name: 'Wheel', line: 'Signature backbends · 75 min', style: 'wheel' },
  { name: 'Chakra Flow', line: 'Moving meditation · 60 min', style: 'chakra' },
  // The 4 classes below are front-end content only (not in the DB yet).
  // Their durations are placeholders until Priyanshi confirms them.
  { name: 'Spine Healing', line: 'Back care and release · 60 min', contactInterest: 'Spine Healing' },
  { name: 'Mobility Yoga', line: 'Joints and everyday ease · 60 min', contactInterest: 'Mobility Yoga' },
  { name: 'Yin Yoga', line: 'Long, quiet holds · 75 min', contactInterest: 'Yin Yoga' },
  { name: 'Prenatal & Postnatal', line: 'Before and after birth · 60 min', contactInterest: 'Prenatal & Postnatal' },
];
