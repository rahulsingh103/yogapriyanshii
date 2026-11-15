/**
 * The privacy policy (owner-approved contact details 2026-11-14). Written from what the site really does:
 * backend/ (bookings, contact, accounts, offers), the class finder (answers stay in the browser) and the
 * providers in docs/ARCHITECTURE.md. Change the facts here and the page and its static HTML both follow.
 */
export const PRIVACY_EMAIL = 'nbsingh2050@gmail.com';
export const PRIVACY_UPDATED = '14 November 2026';

export interface PrivacySection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export const PRIVACY_INTRO =
  "This page explains what YogaPriyanshi collects when you use this website, why, and what you can ask us to do with it. We keep it short because we collect very little.";

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      'YogaPriyanshi is the yoga teaching of Priyanshi, in person in Dubai, UAE, and live online. There is no studio address yet.',
      `For anything about your data, email ${PRIVACY_EMAIL}.`,
    ],
  },
  {
    heading: 'What we collect and why',
    items: [
      'Booking a class: your name, email, the class and time, and whether you join in person or online. We use these to confirm and manage your booking, send booking emails, and check whether you have already had your trial class.',
      'Messages and membership requests: your name, email, what you are interested in and your message (and, for membership, the plan and start date you choose). We use these to reply to you.',
      'An account, if you make one: your email, and whether you want offers by email, with the date and the wording you agreed to. Login codes are kept for 10 minutes and work once.',
      'Offers by email: only if you tick the box. We send monthly and holiday offers, and every offer email has a link to stop them at once.',
      'Security: like every website, our servers see technical details such as your IP address. To stop abuse we keep short-lived counters made from one-way codes, never the address itself, and they expire on their own.',
    ],
  },
  {
    heading: 'The class finder and your health answers',
    paragraphs: [
      "The class finder's questions, including the optional ones about age, height, medical conditions, medication and injuries, stay in your browser. We don't receive or store them.",
      'If you choose to send your answers to Priyanshi on WhatsApp, they go in the message you send. WhatsApp handles that message under its own privacy policy.',
    ],
  },
  {
    heading: 'Cookies and browser storage',
    items: [
      'If you log in, one cookie keeps you logged in for up to 30 days. It is needed for your account to work and is removed when you log out.',
      'A small note in your browser remembers that you have an account, so the page knows whether to check your login. It holds no personal details.',
      'We use no advertising, tracking or analytics cookies.',
    ],
  },
  {
    heading: 'Who we share it with',
    paragraphs: [
      'We never sell your data. We only use the services that run the website: Vercel (hosting), Turso (our database) and Resend (sending emails). They handle your data for us and may store it on servers outside the UAE.',
      'Payment happens in person, so we never collect card details online.',
    ],
  },
  {
    heading: 'How long we keep it',
    items: [
      'Bookings and messages: as long as we need them to run classes and keep our records.',
      'Accounts: until you ask us to delete yours.',
      'Offers: until you unsubscribe or ask us to stop.',
      'Login codes: 10 minutes. Login sessions: up to 30 days.',
    ],
  },
  {
    heading: 'Your choices',
    paragraphs: [
      `You can ask to see, correct or delete the details we hold about you, or stop offers, at any time. Email ${PRIVACY_EMAIL} and we will reply within 30 days. Every offer email also has its own unsubscribe link.`,
    ],
  },
  {
    heading: 'Changes',
    paragraphs: ['If we change how we use your data, we will update this page and the date below.'],
  },
];
