/**
 * The FAQ (FaqSection) and its FAQPage JSON-LD (lib/faq-schema.ts, injected into index.html at build
 * time by vite.config.ts). Plain strings and facts only: everything here matches the PRD, the pricing
 * list and the booking rules. Keep this file pure (no `@/` imports, no `import.meta.env`), because
 * vite.config.ts imports it. Don't mention WhatsApp here: it's hidden until the number is confirmed.
 */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    id: 'free-class',
    question: 'Is the first class really free?',
    answer:
      'Yes. Your first class is free, in any style, with no card needed. It is one free class per person, linked to your email address.',
  },
  {
    id: 'beginners',
    question: 'I have never done yoga. Can I join?',
    answer:
      'Yes. Hatha, Barre and Wheel are open to all levels, and Chakra Yoga Flow is beginner friendly. No experience is needed.',
  },
  {
    id: 'classes',
    question: 'Which classes do you teach?',
    answer:
      'Hatha, Barre, Wheel and Chakra Flow are on the weekly schedule. Spine Healing, Mobility Yoga, Yin Yoga and Prenatal & Postnatal are new and not on the timetable yet; send Priyanshi a message to ask about them.',
  },
  {
    id: 'where',
    question: 'Where do classes happen?',
    answer:
      'In person across Dubai, or live online. You choose when you book. Afterwards, Priyanshi messages you to confirm where and how.',
  },
  {
    id: 'when',
    question: 'When are classes?',
    answer:
      'Every day except Friday, which is a rest day. All times are Dubai time (GMT+4), and the schedule shows live spots for the next three weeks.',
  },
  {
    id: 'pricing',
    question: 'How much do classes cost?',
    answer:
      'A single class is AED 350 with no expiry. A 10-class pack is AED 3,000 (AED 300 a class), valid for 3 months. A 20-class pack is AED 5,600, valid for 6 months, and includes one private session. You reserve online and pay in person; Priyanshi confirms the details with you.',
  },
  {
    id: 'private',
    question: 'Do you offer private sessions?',
    answer: 'Yes. A private 1-to-1 session is AED 500 for 60 minutes. Send Priyanshi a message to arrange one.',
  },
  {
    id: 'payment',
    question: 'How do I pay?',
    answer:
      'There is no online payment yet. You reserve your place online and pay in person at your session. Your first class is free.',
  },
  {
    id: 'cancel',
    question: 'Can I cancel a booking?',
    answer:
      'Yes. Cancellation is free up to 6 hours before class: use Manage booking with the booking reference from your confirmation. A free first class cancelled in time is given back, so you can book a different session.',
  },
];
