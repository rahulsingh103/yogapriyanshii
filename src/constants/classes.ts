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

// The photos are AI-generated placeholders (pose references for Priyanshi's own shoot), except Aerial,
// which is a real photo of her until its replacement arrives. Replace the files to swap them.
/** The 11 classes of the "Choose your practice" carousel, in DESIGN_SYSTEM §4 order. */
export const PRACTICE_CLASSES: PracticeClass[] = [
  { name: 'Hatha', slug: 'hatha', line: 'Alignment and breath · 60 min', style: 'hatha', image: 'hatha', alt: 'Yoga teacher in a low crescent lunge with arms raised' },
  { name: 'Barre', slug: 'barre', line: 'Strength and stretch · 60 min', style: 'barre', image: 'barre', alt: 'Yoga teacher at a ballet barre, rising onto her toes' },
  { name: 'Wheel', slug: 'wheel', line: 'Signature backbends · 75 min', style: 'wheel', image: 'wheel', alt: 'Yoga teacher arching back over a yoga wheel on a mat' },
  { name: 'Chakra Flow', slug: 'chakra-flow', line: 'Moving meditation · 60 min', style: 'chakra', image: 'chakra-flow', alt: 'Yoga teacher seated cross-legged in meditation' },
  // The classes below are front-end content only (not in the DB yet).
  // Their durations are placeholders until Priyanshi confirms them.
  { name: 'Vinyasa', slug: 'vinyasa', line: 'Breath-led flow · 60 min', contactInterest: 'Vinyasa Yoga', image: 'vinyasa', alt: 'Yoga teacher in a low lunge on a mat, one arm reaching up' },
  { name: 'Ashtanga', slug: 'ashtanga', line: 'A set sequence, steady breath · 60 min', contactInterest: 'Ashtanga Yoga', image: 'ashtanga', alt: 'Yoga teacher seated on a mat in a twist, one knee drawn up' },
  { name: 'Spine Healing', slug: 'spine-healing', line: 'Back care and release · 60 min', contactInterest: 'Spine Healing', image: 'spine-healing', alt: 'Yoga teacher on all fours in a gentle cat stretch' },
  { name: 'Mobility Yoga', slug: 'mobility-yoga', line: 'Joints and everyday ease · 60 min', contactInterest: 'Mobility Yoga', image: 'mobility', alt: 'Yoga teacher seated in a hip mobility stretch' },
  { name: 'Yin Yoga', slug: 'yin-yoga', line: 'Long, quiet holds · 75 min', contactInterest: 'Yin Yoga', image: 'yin', alt: 'Yoga teacher resting in a seated forward fold' },
  { name: 'Prenatal & Postnatal', slug: 'prenatal-postnatal', line: 'Before and after birth · 60 min', contactInterest: 'Prenatal & Postnatal', image: 'prenatal-postnatal', alt: 'Pregnant woman seated cross-legged beside a bolster, hand on her belly' },
  // Aerial is private sessions only, never a group class on the schedule.
  { name: 'Aerial Yoga', slug: 'aerial-yoga', line: 'Private sessions only · on request', contactInterest: 'Private Aerial Yoga', image: 'aerial', alt: 'Priyanshi seated in a blue aerial hammock by a window, arms raised' },
];
