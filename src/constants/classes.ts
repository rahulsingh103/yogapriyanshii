import type { ClassStyle } from '../types';

export interface PracticeClass {
  name: string;
  /** The class page path segment: /classes/<slug> (lowercase, matched exactly by src/lib/route.ts). */
  slug: string;
  /** "<benefit> · <duration>", shown under the name on the carousel card. */
  line: string;
  /** Bookable classes: the timetable style whose soonest session the card preselects. */
  style?: ClassStyle;
  /** Not-yet-scheduled classes: the contact interest the card presets instead. */
  contactInterest?: string;
  /** Card photo slug in /media/images/practice (<slug>-480.webp, <slug>-800.webp). */
  image: string;
  /** True when only <slug>-480.webp exists (a small source photo, until the photo shoot). */
  smallImageOnly?: boolean;
  /** Pose description (the card photo itself is decorative, so the card is announced by its class name). */
  alt: string;
}

// The photos are AI-generated placeholders (pose references for Priyanshi's own shoot). Replace the files to swap them.
/** The 9 classes of the "Choose your practice" carousel, in DESIGN_SYSTEM §4 order. */
export const PRACTICE_CLASSES: PracticeClass[] = [
  { name: 'Hatha', slug: 'hatha', line: 'Alignment and breath · 60 min', style: 'hatha', image: 'hatha', alt: 'Priyanshi in a deep squat on a mat, hands together at her chest' },
  { name: 'Barre', slug: 'barre', line: 'Strength and stretch · 60 min', style: 'barre', image: 'barre', alt: 'Priyanshi balancing on one leg, the other leg extended in front, arms reaching out to the sides' },
  { name: 'Chakra Flow', slug: 'chakra-flow', line: 'Moving meditation · 60 min', style: 'chakra', image: 'chakra-flow', alt: 'Priyanshi with eyes closed, hands together above her head' },
  // The durations of the classes below are placeholders until Priyanshi confirms them.
  { name: 'Vinyasa', slug: 'vinyasa', line: 'Breath-led flow · 60 min', style: 'vinyasa', image: 'vinyasa', alt: 'Priyanshi in a low lunge with one arm reaching up, the Dubai skyline behind her' },
  // From here on, front-end content only (not in the DB), except Yin Yoga, which is on the timetable.
  { name: 'Ashtanga', slug: 'ashtanga', line: 'A set sequence, steady breath · 60 min', contactInterest: 'Ashtanga Yoga', image: 'ashtanga', alt: 'Priyanshi balancing in boat pose at sunrise, the Dubai skyline behind her' },
  { name: 'Spine Healing', slug: 'spine-healing', line: 'Back care and release · 60 min', contactInterest: 'Spine Healing', image: 'spine-healing', alt: 'Priyanshi seated on a mat beside a yoga wheel, one hand resting on it' },
  { name: 'Mobility Yoga', slug: 'mobility-yoga', line: 'Joints and everyday ease · 60 min', contactInterest: 'Mobility Yoga', image: 'mobility', alt: 'Priyanshi seated with legs wide, reaching one arm over in a side stretch' },
  { name: 'Yin Yoga', slug: 'yin-yoga', line: 'Long, quiet holds · 75 min', style: 'yin', image: 'yin', alt: 'Priyanshi seated cross-legged on a mat, eyes closed, hands resting on her knees' },
  { name: 'Prenatal & Postnatal', slug: 'prenatal-postnatal', line: 'Before and after birth · 60 min', contactInterest: 'Prenatal & Postnatal', image: 'prenatal-postnatal', alt: 'Pregnant woman seated cross-legged beside a bolster, hand on her belly' },
];
