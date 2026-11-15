/**
 * The legal pages (owner-approved 2026-11-14, design/concepts/footer-legal): one layout, a menu of four
 * pages. Privacy keeps its text in privacy.ts. Terms and Refund are written from the owner's own rules;
 * the cancellation numbers come from cancel-policy.ts. Pure: relative imports only (route.ts, the build).
 */
import { FREE_CANCEL_HOURS, PACK_VALID_DAYS } from './cancel-policy';
import { PRIVACY_EMAIL, PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED, type PrivacySection } from './privacy';

import { legalLink, type LegalSlug } from './legal-links';

export type { LegalSlug };

export interface LegalPage {
  slug: LegalSlug;
  path: string;
  /** The menu label and the page's h1. */
  title: string;
  metaDescription: string;
  intro: string;
  sections: PrivacySection[];
  updated: string;
}

const UPDATED = '14 November 2026';

export const LEGAL_PAGES: ReadonlyArray<LegalPage> = [
  {
    ...legalLink('privacy'),
    metaDescription: 'What YogaPriyanshi collects when you use the website, why, and how to ask us to see, correct or delete it.',
    intro: PRIVACY_INTRO,
    sections: PRIVACY_SECTIONS,
    updated: PRIVACY_UPDATED,
  },
  {
    ...legalLink('terms'),
    metaDescription: 'The terms for using the YogaPriyanshi website and booking classes with Priyanshi in Dubai and online.',
    intro: 'These terms apply when you use this website or book a class with Priyanshi, in person in Dubai or live online. By booking, you agree to them.',
    sections: [
      { heading: 'Who can join', paragraphs: ["Classes are open to everyone. Anyone under 18 needs a parent or guardian's permission to book and join."] },
      {
        heading: 'Your health',
        items: [
          'Please tell Priyanshi about any injury, pregnancy or medical condition before class. If you are unsure whether yoga is right for you, check with your doctor first.',
          'Listen to your body. Rest or skip a pose whenever you need to, and you take part at your own risk.',
          'Yoga supports your wellbeing. It is not medical advice or treatment.',
        ],
      },
      {
        heading: 'Booking and paying',
        items: [
          'Your first class is a trial at AED 90, one per person, linked to your email address.',
          'You pay in person, or online with the details Priyanshi sends you. We never take card details on this website.',
          'Cancelling and moving classes, packs and the membership follow the Refund and cancellation page.',
        ],
      },
      {
        heading: 'Online classes',
        paragraphs: ["Find a quiet, safe space with room to move, and join a few minutes early to check your sound and video. Please don't record or share a class."],
      },
      { heading: 'This website', paragraphs: ["The words and photos on this site belong to YogaPriyanshi. Please don't copy them without asking."] },
      { heading: 'Questions', paragraphs: [`Email ${PRIVACY_EMAIL}.`] },
    ],
    updated: UPDATED,
  },
  {
    ...legalLink('refund'),
    metaDescription: 'How cancelling and moving a class works at YogaPriyanshi, and the rules for the trial, class packs and the membership.',
    intro: 'Life happens, so here is exactly how cancelling and moving a class works. These rules apply to every class, including the trial.',
    sections: [
      {
        heading: 'Cancelling or moving a class',
        items: [
          `More than ${FREE_CANCEL_HOURS} hours before: cancel or move it for free.`,
          `Less than ${FREE_CANCEL_HOURS} hours before, but not on the day: you can move it to another day once, if a slot is free.`,
          "On the day of the class, or if you don't come: the class is charged in full. For the trial, that is AED 90.",
        ],
        paragraphs: ['To cancel or move, use Manage booking at the bottom of the page with the booking reference from your confirmation email.'],
      },
      {
        heading: 'Class packs',
        items: [
          `The 10-class pack is valid for ${PACK_VALID_DAYS.pack10} days. The 20-class pack is valid for ${PACK_VALID_DAYS.pack20} days.`,
          'Packs are non-refundable, and classes not used in time expire.',
          'If illness or travel gets in the way, ask Priyanshi. She may extend your dates.',
        ],
      },
      {
        heading: 'Monthly membership',
        items: [
          '12 classes a month for AED 2,999, with a minimum of 3 months. After that you can stop at the end of any month.',
          'The membership is non-refundable, and classes not used in a month expire.',
          'If illness or travel gets in the way, ask Priyanshi. She may extend your dates.',
        ],
      },
      {
        heading: 'If Priyanshi cancels',
        paragraphs: ['If Priyanshi has to cancel a class, she will tell you as early as she can and you can move to another time. You never lose a class she cancels.'],
      },
    ],
    updated: UPDATED,
  },
  {
    ...legalLink('health'),
    metaDescription: "How the YogaPriyanshi class finder handles your optional health answers: they stay in your browser and are never sent to us.",
    intro: 'The class finder can ask about your age, height, medical conditions, medication and injuries. Every one of these questions is optional.',
    sections: [
      {
        heading: 'Your answers stay on your phone or computer',
        items: [
          'Your answers are used only in your browser to suggest a class. They are never sent to this website or saved by us.',
          'If you choose to send them to Priyanshi on WhatsApp, you see the message first. Nothing goes until you press send, and WhatsApp handles that message under its own privacy policy.',
          'Booking a class and the contact form never include your answers.',
        ],
      },
      {
        heading: 'Before class',
        paragraphs: ['Please tell Priyanshi about any injury, pregnancy or medical condition before you practise, and check with your doctor if you are unsure. Yoga is not a substitute for medical care.'],
      },
    ],
    updated: UPDATED,
  },
];

export const legalPage = (slug: LegalSlug): LegalPage => LEGAL_PAGES.find((p) => p.slug === slug)!;
