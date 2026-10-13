import type { ClassStyle } from '../types';

export interface PracticeClass {
  name: string;
  /** "<benefit> · <duration>", shown under the name on the carousel card. */
  line: string;
  /** Bookable classes: the timetable style whose soonest session the card preselects. */
  style?: ClassStyle;
  /** Not-yet-scheduled classes: the contact interest the card presets instead. */
  contactInterest?: string;
  /** Card photo slug in /media/images/practice (<slug>-480.webp, <slug>-800.webp). */
  image: string;
  /** Pose description (the card photo itself is decorative, so the card is announced by its class name). */
  alt: string;
}

// Photos are AI-generated placeholders (pose references for Priyanshi's own shoot); replace the files to swap them.
/** The 8 classes of the "Choose your practice" carousel, in DESIGN_SYSTEM §4 order. */
export const PRACTICE_CLASSES: PracticeClass[] = [
  { name: 'Hatha', line: 'Alignment and breath · 60 min', style: 'hatha', image: 'hatha', alt: 'Yoga teacher in a low crescent lunge with arms raised' },
  { name: 'Barre', line: 'Strength and stretch · 60 min', style: 'barre', image: 'barre', alt: 'Yoga teacher at a ballet barre, rising onto her toes' },
  { name: 'Wheel', line: 'Signature backbends · 75 min', style: 'wheel', image: 'wheel', alt: 'Yoga teacher in a full wheel backbend' },
  { name: 'Chakra Flow', line: 'Moving meditation · 60 min', style: 'chakra', image: 'chakra-flow', alt: 'Yoga teacher seated cross-legged in meditation' },
  // The 4 classes below are front-end content only (not in the DB yet).
  // Their durations are placeholders until Priyanshi confirms them.
  { name: 'Spine Healing', line: 'Back care and release · 60 min', contactInterest: 'Spine Healing', image: 'spine-healing', alt: 'Yoga teacher on all fours in a gentle cat stretch' },
  { name: 'Mobility Yoga', line: 'Joints and everyday ease · 60 min', contactInterest: 'Mobility Yoga', image: 'mobility', alt: 'Yoga teacher seated in a hip mobility stretch' },
  { name: 'Yin Yoga', line: 'Long, quiet holds · 75 min', contactInterest: 'Yin Yoga', image: 'yin', alt: 'Yoga teacher resting in a seated forward fold' },
  { name: 'Prenatal & Postnatal', line: 'Before and after birth · 60 min', contactInterest: 'Prenatal & Postnatal', image: 'prenatal-postnatal', alt: 'Pregnant woman seated cross-legged beside a bolster, hand on her belly' },
];
