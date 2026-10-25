/**
 * The monthly membership: the Pricing card, the contact pop-up's membership mode and the WhatsApp
 * hand-off after a request. Plain data and pure functions only, like faq.ts and class-finder.ts:
 * relative imports, no `@/` paths and no `import.meta.env`.
 *
 * The interest must match CONTACT_INTERESTS (backend/validate.ts) and MEMBERSHIP_INTEREST
 * (backend/membership.ts); the price must match MEMBERSHIP_PLAN there, which is what each request stores.
 * Owner decisions (Batch 3): no priority booking and no shareable packs.
 */

export const MEMBERSHIP = {
  interest: 'Monthly membership',
  name: 'Monthly membership',
  price: 'AED 2,999',
  period: 'a month',
  perks: [
    '12 classes a month',
    'Recordings included (details shared when you join)',
    'In person in Dubai or live online',
  ],
  cta: 'Join the membership',
} as const;

/** The contact pop-up in membership mode. */
export const MEMBERSHIP_FORM = {
  title: 'Join the membership',
  intro: '12 classes a month for AED 2,999. Send your details and Priyanshi will reply within a day.',
  formatLabel: 'In person or online (optional)',
  formats: [
    ['in_person', 'In person in Dubai'],
    ['online', 'Live online'],
  ] as const,
  timesLabel: 'Preferred days and times (optional)',
  timesPlaceholder: 'e.g. Weekday mornings, or Saturdays',
  submit: 'Send Request',
  sending: 'Sending Request...',
  sentTitle: 'Request Sent',
  sentBody: 'Thank you. Priyanshi will be in touch within 24 hours to set up your membership.',
} as const;

export type MembershipFormat = (typeof MEMBERSHIP_FORM.formats)[number][0];

/**
 * The WhatsApp message after a request. It carries the name the person typed (owner-approved) and the
 * plan, never their email or phone, and it's only sent if they tap "Continue on WhatsApp".
 */
export function membershipPrefill(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 100).trim();
  return `Hi Priyanshi, I'm ${clean} and I've just asked to join the 12-class monthly membership (AED 2,999).`;
}
