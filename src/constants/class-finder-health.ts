/**
 * The quiz's optional details (age, height, health notes): the copy, the input rules and the WhatsApp
 * message. Plain data and pure functions only: relative imports, no `@/` paths, no `import.meta.env`,
 * so the wa.me builder is passed in. Only the lazy ClassFinderModal chunk imports this file.
 *
 * What is typed here lives in the sheet's memory and in the wa.me link the student opens, and nowhere
 * else: no request to our server, no storage, no logs, no URL on our domain. It never feeds recommend()
 * or any other result logic, the text is never parsed for meaning, and the copy stays free of medical
 * advice, clearance and "safe" wording.
 */

export interface FinderHealth {
  age: string;
  height: string;
  conditions: string;
  medication: string;
  injury: string;
}

export type HealthTextKey = 'conditions' | 'medication' | 'injury';

export const EMPTY_HEALTH: FinderHealth = { age: '', height: '', conditions: '', medication: '', injury: '' };

export const HEALTH_MAX_CHARS = 120;
/** A conservative wa.me length: WhatsApp documents no limit, so check it on real phones. */
export const WHATSAPP_URL_CAP = 2000;

export const HEALTH_INTRO = {
  title: 'A few details for Priyanshi',
  paragraphs: [
    "You can share your age, height and any health details with Priyanshi. It's optional, and your suggested class stays the same.",
    "This website doesn't save them. They go into a WhatsApp message you check first. Opening it shares the text with WhatsApp, and your browser may remember the link. Priyanshi only sees it if you press send.",
  ],
  add: 'Add details',
  skip: 'Skip to my suggestion',
} as const;

export const HEALTH_MEASURES = {
  title: 'Your age and height',
  ageLabel: 'Age',
  heightLabel: 'Height (cm)',
  ageError: 'Please enter your age in years, or leave it blank.',
  heightError: 'Please enter your height in cm, or leave it blank.',
} as const;

/** The three free-text steps, in order. */
export const HEALTH_TEXT_STEPS: ReadonlyArray<{ key: HealthTextKey; title: string; hint: string }> = [
  {
    key: 'conditions',
    title: 'Any health conditions?',
    hint: "Anything you'd like Priyanshi to know. Up to 120 characters.",
  },
  {
    key: 'medication',
    title: 'Any medication, now or in the past?',
    hint: 'The name is enough. Up to 120 characters.',
  },
  {
    key: 'injury',
    title: 'Any injury, surgery or pain?',
    hint: 'Where and roughly when is enough. Up to 120 characters.',
  },
];

export const HEALTH_RESULT = {
  panelTitle: 'Your message to Priyanshi',
  privacy:
    "These details don't change your suggestion. Nothing is sent yet: the WhatsApp button below opens this message for you to check. WhatsApp gets the text when it opens, and your browser may remember the link. Priyanshi only sees it if you press send.",
  send: 'Send this on WhatsApp',
  trimmed: 'Your message was shortened to fit. You can add more in WhatsApp.',
  remove: 'Remove my answers',
  notice: "Please tell Priyanshi about anything you've noted here before your first class.",
  bookingNote: "Booking doesn't include your answers. To share them, use the WhatsApp button below first.",
  contactNote: "The contact form doesn't include your answers. To share them, use the WhatsApp button below first.",
} as const;

const TEXT_LABELS: Record<HealthTextKey, string> = {
  conditions: 'Health conditions',
  medication: 'Medication, now or in the past',
  injury: 'Injury, surgery or pain',
};
const TEXT_KEYS = HEALTH_TEXT_STEPS.map((s) => s.key);

// \u escapes only, so no invisible character sits in this file.
const CONTROL = /[\p{Cc}\u2028\u2029]/gu;
const BIDI = /[\u202a-\u202e\u2066-\u2069]/g;
// With the u flag, \p{Cs} matches only a lone surrogate: emoji are safe. Never widen this to \p{Cf},
// because ZWJ and ZWNJ are needed for emoji and some scripts.
const LONE_SURROGATE = /\p{Cs}/gu;

/**
 * Makes typed text safe for a one-line field and for encodeURIComponent, which throws on a lone
 * surrogate. In this order: controls and newlines become a space, bidi overrides and lone surrogates
 * go, whitespace collapses, then it is cut by code point.
 */
export function cleanFreeText(raw: string, max: number = HEALTH_MAX_CHARS) {
  const text = raw
    .replace(CONTROL, ' ')
    .replace(BIDI, '')
    .replace(LONE_SURROGATE, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(text).slice(0, max).join('').trimEnd();
}

/** Digits only, in ASCII: Arabic-Indic, Persian and Devanagari digits count too. At most 3. */
export function normaliseDigits(raw: string) {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0966-\u096f]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/\D/g, '')
    .slice(0, 3);
}

const inRange = (value: string, low: number, high: number) => {
  const digits = normaliseDigits(value);
  const n = Number(digits);
  return digits.length > 0 && n >= low && n <= high;
};

// Typo guards only: these never affect eligibility or the suggestion.
export const validAge = (value: string) => inRange(value, 5, 110);
export const validHeight = (value: string) => inRange(value, 100, 250);
/** Blank is always fine: every field is optional. */
export const ageOk = (value: string) => value === '' || validAge(value);
export const heightOk = (value: string) => value === '' || validHeight(value);

/** True when a health note (not just age or height) was entered. Never looks at what it says. */
export const finderHasHealthNotes = (health: FinderHealth) =>
  TEXT_KEYS.some((key) => cleanFreeText(health[key]).length > 0);

/** True when the message carries anything typed. An age or height that fails its guard doesn't count. */
export const finderHasHealth = (health: FinderHealth) =>
  validAge(health.age) || validHeight(health.height) || finderHasHealthNotes(health);

function healthBlock(health: FinderHealth, text: Record<HealthTextKey, string>) {
  const lines = [
    ...(validAge(health.age) ? [`Age: ${Number(normaliseDigits(health.age))}`] : []),
    ...(validHeight(health.height) ? [`Height: ${Number(normaliseDigits(health.height))} cm`] : []),
    ...TEXT_KEYS.filter((key) => text[key]).map((key) => `${TEXT_LABELS[key]}: ${text[key]}`),
  ];
  return lines.length ? `\n\nA few things about me:\n${lines.join('\n')}` : '';
}

/**
 * The exact WhatsApp message: the base message, then only the lines that were filled in. If its link
 * would pass the cap, the field that costs most once encoded loses one code point at a time, marked
 * with "…", so a cut line can't be mistaken for a complete one. The preview and the link both use this
 * string, so they can't differ.
 */
export function classFinderMessage(base: string, health: FinderHealth, urlFor: (text: string) => string) {
  const points = Object.fromEntries(TEXT_KEYS.map((key) => [key, Array.from(cleanFreeText(health[key]))])) as Record<
    HealthTextKey,
    string[]
  >;
  const cut = new Set<HealthTextKey>();
  const textOf = (key: HealthTextKey) => {
    const text = points[key].join('');
    if (!cut.has(key)) return text;
    // A dangling joiner or space must not sit before the mark.
    const kept = text.replace(/[\s\u200c\u200d]+$/u, '');
    return kept ? `${kept}…` : '';
  };
  const build = () => {
    const text = { conditions: textOf('conditions'), medication: textOf('medication'), injury: textOf('injury') };
    return `${base}${healthBlock(health, text)}`;
  };

  let message = build();
  while (urlFor(message).length > WHATSAPP_URL_CAP) {
    const longest = TEXT_KEYS.filter((key) => points[key].length > 0).sort(
      (a, b) => encodeURIComponent(textOf(b)).length - encodeURIComponent(textOf(a)).length
    )[0];
    if (!longest) break;
    points[longest].pop();
    cut.add(longest);
    message = build();
  }
  return { message, trimmed: cut.size > 0 };
}
