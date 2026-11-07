import fs from 'fs';
import path from 'path';
import { test as plainTest, type APIRequestContext, type CDPSession, type Locator, type Page } from '@playwright/test';
import { test, expect, stepShooter, openHome, bookingModal, classFinder, uniqueEmail } from './helpers';
import {
  EMPTY_HEALTH,
  WHATSAPP_URL_CAP,
  classFinderMessage,
  cleanFreeText,
  finderHasHealth,
  finderHasHealthNotes,
  normaliseDigits,
  validAge,
  validHeight,
} from '../src/constants/class-finder-health';

const FEATURE = 'class-finder';
const WA_LINK = /^https:\/\/wa\.me\/\d{8,15}\?text=/;
const SHOTS = path.join('.data', 'shots', 'batch2');

const GOAL = {
  relax: 'Calm and less stress',
  flexibility: 'Flexibility',
  strength: 'Strength',
  back: 'Back care',
  pregnancy: 'Pregnancy or after birth',
  unsure: 'Not sure yet',
} as const;
const EXPERIENCE = { new: "I'm new to yoga", some: "I've done a few classes", regular: 'I practise regularly' } as const;
const FORMAT = { in_person: 'In person in Dubai', online: 'Live online', private: 'Private, one to one' } as const;
type Goal = keyof typeof GOAL;
type Experience = keyof typeof EXPERIENCE;
type Format = keyof typeof FORMAT;

// The spec's own copy of the mapping (src/constants/class-finder.ts), so a change there must be deliberate.
const GROUP: Record<Goal, Record<Experience, [string, string | null]>> = {
  relax: { new: ['Chakra Flow', 'Yin Yoga'], some: ['Yin Yoga', 'Chakra Flow'], regular: ['Yin Yoga', 'Chakra Flow'] },
  flexibility: { new: ['Hatha', 'Mobility Yoga'], some: ['Barre', 'Yin Yoga'], regular: ['Barre', 'Yin Yoga'] },
  strength: { new: ['Barre', 'Hatha'], some: ['Vinyasa', 'Barre'], regular: ['Ashtanga', 'Vinyasa'] },
  back: { new: ['Spine Healing', 'Mobility Yoga'], some: ['Spine Healing', 'Hatha'], regular: ['Spine Healing', 'Mobility Yoga'] },
  pregnancy: { new: ['Prenatal & Postnatal', null], some: ['Prenatal & Postnatal', null], regular: ['Prenatal & Postnatal', null] },
  unsure: { new: ['Hatha', 'Chakra Flow'], some: ['Hatha', 'Vinyasa'], regular: ['Vinyasa', 'Barre'] },
};
const PRIVATE: Partial<Record<Goal, Partial<Record<Experience, [string, string]>>>> = {
  strength: { some: ['Aerial Yoga', 'Vinyasa'], regular: ['Aerial Yoga', 'Ashtanga'] },
  flexibility: { some: ['Aerial Yoga', 'Barre'], regular: ['Aerial Yoga', 'Yin Yoga'] },
};
const BOOKABLE = ['Hatha', 'Barre', 'Chakra Flow', 'Vinyasa', 'Yin Yoga'];

function expected(goal: Goal, exp: Experience, format: Format) {
  const [main, alt] = (format === 'private' && PRIVATE[goal]?.[exp]) || GROUP[goal][exp];
  const primary =
    main === 'Aerial Yoga'
      ? 'Ask about private Aerial'
      : format === 'private'
        ? main === 'Prenatal & Postnatal'
          ? 'Ask about this class'
          : 'Ask about a private session'
        : BOOKABLE.includes(main)
          ? 'Book this class'
          : 'Ask about this class';
  return { main, alt, primary };
}

const heroLink = (page: Page) => page.locator('#home').getByRole('button', { name: 'Find your class' });
const carouselLink = (page: Page) => page.locator('#classes').getByTestId('quiz-card');
const quizBand = (page: Page) => page.getByRole('region', { name: 'Not sure which class suits you?' });
const chat = (page: Page) => page.getByTestId('whatsapp-chat');
const resultName = (finder: Locator) => finder.getByTestId('class-finder-result').getByRole('heading', { level: 3 });

async function openFinder(page: Page) {
  await openHome(page);
  await heroLink(page).click();
  const finder = classFinder(page);
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  return finder;
}

/** Answers the three questions with taps and waits for the result. */
async function answerAll(finder: Locator, goal: Goal, exp: Experience, format: Format) {
  await finder.getByRole('button', { name: GOAL[goal], exact: true }).click();
  await expect(finder.getByText('Question 2 of 3')).toBeVisible();
  await finder.getByRole('button', { name: EXPERIENCE[exp], exact: true }).click();
  await expect(finder.getByText('Question 3 of 3')).toBeVisible();
  await finder.getByRole('button', { name: FORMAT[format], exact: true }).click();
  await expect(finder.getByText('Optional', { exact: true })).toBeVisible();
  await finder.getByRole('button', { name: 'Skip to my suggestion' }).click();
  await expect(finder.getByText('Your suggestion')).toBeVisible();
}

async function startAgain(finder: Locator) {
  await finder.getByRole('button', { name: 'Start again' }).click();
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
}

const alsoLine = (finder: Locator) => finder.getByText('Also a good fit:');

async function expectResult(finder: Locator, goal: Goal, exp: Experience, format: Format) {
  const want = expected(goal, exp, format);
  const label = `${goal}/${exp}/${format}`;
  await expect(resultName(finder), label).toHaveText(want.main);
  if (want.alt) {
    await expect(finder.getByRole('button', { name: `Show ${want.alt} instead` }), label).toBeVisible();
  } else {
    await expect(alsoLine(finder), label).toHaveCount(0);
  }
  await expect(finder.getByRole('button', { name: want.primary, exact: true }), label).toBeVisible();
  if (want.primary !== 'Book this class') await expect(finder.getByRole('button', { name: 'Book this class' })).toHaveCount(0);
}

const prefillOf = async (link: Locator) => {
  const href = (await link.getAttribute('href'))!;
  expect(href, 'wa.me link').toMatch(WA_LINK);
  return { href, text: new URL(href).searchParams.get('text') };
};

async function soonest(request: APIRequestContext, style: string) {
  const { sessions } = await (await request.get('/api/schedule')).json();
  const s = sessions
    .filter((x: any) => !x.isRestDay && x.status === 'available' && x.style === style)
    .sort((a: any, b: any) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc))[0];
  expect(s, `an available ${style} session exists`).toBeTruthy();
  return s;
}

test('hero: "Find your class" is the secondary pill after the one primary, opens the finder, and Escape returns focus', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const hero = page.locator('#home');
  const cta = hero.getByRole('button', { name: 'Book a trial class' });
  const link = heroLink(page);
  await expect(link).toBeVisible();
  // "Book a trial class" is still the first (and only primary) button after the h1.
  await expect(hero.getByRole('button').first()).toHaveText(/Book a trial class/);
  await expect(hero.getByRole('button')).toHaveCount(2);

  const c = (await cta.boundingBox())!;
  const l = (await link.boundingBox())!;
  expect(l.x, 'beside the button').toBeGreaterThanOrEqual(c.x + c.width);
  expect(Math.abs(l.y - c.y)).toBeLessThanOrEqual(1);
  expect(l.height).toBeGreaterThanOrEqual(44);
  // A pill with a border in the page's own colour, so only Book is dark and the mandala's lines stay out. No underline.
  const style = await link.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, radius: parseFloat(s.borderRadius), border: parseFloat(s.borderTopWidth), decoration: s.textDecorationLine };
  });
  expect(style.bg).toBe(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  expect(style.radius).toBeGreaterThan(20);
  expect(style.border).toBe(1);
  expect(style.decoration).toBe('none');
  expect(await cta.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await link.click();
  await shot('hero-link');

  const finder = classFinder(page);
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  await expect(finder.getByRole('heading', { level: 2 })).toHaveText('Find your class');
  // Q1 is read out with the dialog's name: it is described by the progress line and the first question.
  await expect(finder).toHaveAttribute('aria-describedby', 'class-finder-progress class-finder-q-goal');
  await expect(finder.getByRole('heading', { level: 3 })).toHaveText('What would you like yoga to give you?');
  await expect(finder.getByRole('group', { name: 'What would you like yoga to give you?' }).getByRole('button')).toHaveCount(6);
  await shot('finder-q1');
  await page.keyboard.press('Escape');
  await expect(finder).toHaveCount(0);
  await expect(link).toBeFocused();
});

test('band: its own section before the classes, one line, one quieter button, opens the finder', async ({ page }) => {
  await openHome(page);
  const band = quizBand(page);
  await band.scrollIntoViewIfNeeded();
  await expect(band.getByRole('heading', { level: 2 })).toHaveText('Not sure which class suits you?');
  await expect(band.getByText("Answer a few quick questions and get a suggestion from Priyanshi's classes.")).toBeVisible();
  await expect(band.getByRole('button')).toHaveCount(1);
  const button = band.getByRole('button', { name: 'Take the quiz' });
  expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  // Outside #classes, with no id: the nav and the card restore still land on the carousel heading.
  expect(await band.getAttribute('id')).toBeNull();
  const b = (await band.boundingBox())!;
  const c = (await page.locator('#classes').boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(c.y);
  await button.click();
  const finder = classFinder(page);
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(finder).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('carousel: the quiz card comes first, opens the finder, and the X returns focus', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  const card = carouselLink(page);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Not sure where to start?');
  await expect(card).toContainText('A few quick questions.');
  await expect(card).toContainText('Take the quiz');
  const track = classes.getByRole('group', { name: /Classes/ });
  // Title, line and label sit together at the bottom, so the title is near the class names' row.
  const title = (await card.getByText('Not sure where to start?').boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  expect(title.y).toBeGreaterThan(cardBox.y + cardBox.height / 2);
  await expect(track.getByTestId('practice-card')).toHaveCount(10);
  await expect(track.locator('[data-snap-item]')).toHaveCount(11);
  await expect(track.locator('[data-snap-item]').first().getByTestId('quiz-card')).toHaveCount(1);
  // The bottoms line up with the class cards.
  const c = (await card.boundingBox())!;
  const first = (await track.getByTestId('practice-card').first().boundingBox())!;
  expect(Math.abs(c.y + c.height - (first.y + first.height))).toBeLessThanOrEqual(1);
  await shot('carousel-card');

  await card.click();
  const finder = classFinder(page);
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  await finder.getByRole('button', { name: 'Close class finder' }).click();
  await expect(finder).toHaveCount(0);
  await expect(card).toBeFocused();

  // Enter and Space both open it.
  for (const key of ['Enter', 'Space']) {
    await card.focus();
    await page.keyboard.press(key);
    await expect(finder.getByText('Question 1 of 3'), key).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(finder).toHaveCount(0);
    await expect(card).toBeFocused();
  }
});

test('carousel: the arrows reach the quiz card and the last card, and a drag on the card opens nothing', async ({ page }) => {
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  const track = classes.getByRole('group', { name: /Classes/ });
  const card = carouselLink(page);
  const position = () => track.evaluate((el) => ({ left: Math.round(el.scrollLeft), max: el.scrollWidth - el.clientWidth }));
  const press = async (name: string) => {
    let before = (await position()).left;
    for (let i = 0; i < 14; i++) {
      await classes.getByRole('button', { name }).click();
      await expect.poll(async () => {
        const now = (await position()).left;
        const still = now === before;
        before = now;
        return still;
      }, { intervals: [120] }).toBe(true);
    }
  };
  await press('Next classes');
  const end = await position();
  expect(Math.abs(end.left - end.max)).toBeLessThanOrEqual(1);
  await press('Previous classes');
  expect((await position()).left).toBe(0);

  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(classFinder(page)).toHaveCount(0);
  await expect.poll(async () => (await position()).left).toBeGreaterThan(0);
});

// A6: one test per goal, nine paths each, "Start again" between them.
for (const goal of Object.keys(GOAL) as Goal[]) {
  test(`mapping: ${goal}, all nine paths`, async ({ page }) => {
    const finder = await openFinder(page);
    for (const exp of Object.keys(EXPERIENCE) as Experience[]) {
      for (const format of Object.keys(FORMAT) as Format[]) {
        await answerAll(finder, goal, exp, format);
        await expectResult(finder, goal, exp, format);
        // Aerial appears only for private.
        if (format !== 'private') await expect(finder.getByText(/Aerial/)).toHaveCount(0);
        await expect(finder.getByText(/\bWheel\b/)).toHaveCount(0);
        await startAgain(finder);
      }
    }
  });
}

test('pregnancy: always Prenatal & Postnatal, no alternative, the notice, and no medical wording', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const finder = await openFinder(page);
  for (const exp of Object.keys(EXPERIENCE) as Experience[]) {
    for (const format of Object.keys(FORMAT) as Format[]) {
      await answerAll(finder, 'pregnancy', exp, format);
      await expect(resultName(finder)).toHaveText('Prenatal & Postnatal');
      await expect(alsoLine(finder)).toHaveCount(0);
      await expect(finder.getByTestId('class-finder-notice')).toHaveText(
        "Let Priyanshi know you're pregnant, or when you gave birth, before your first class."
      );
      const text = await finder.innerText();
      expect(text, `pregnancy/${exp}/${format}`).not.toMatch(/Aerial|Wheel|doctor|medical|clearance|cleared|safe for|cure|heal/i);
      expect(text).not.toMatch(/free|trial/i);
      if (exp === 'new' && format === 'in_person') await shot('pregnancy-result');
      await startAgain(finder);
    }
  }
});

test('WhatsApp: the prefill names the answers and the class, and the floating button steps aside', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await expect(chat(page)).toBeVisible();
  await heroLink(page).click();
  const finder = classFinder(page);
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  await expect(chat(page)).toHaveCount(0);

  // Private Aerial.
  await answerAll(finder, 'strength', 'regular', 'private');
  const link = finder.getByRole('link', { name: 'Ask Priyanshi on WhatsApp' });
  await expect(link).toHaveAttribute('target', '_blank');
  let { href, text } = await prefillOf(link);
  expect(text).toBe(
    "Hi Priyanshi, I found you on yogapriyanshi.com and used the class finder. I'm looking for more strength, I'm practising regularly, and I'd like to practise one to one. It suggested Aerial Yoga. Is that a good fit for me?"
  );
  expect(href).not.toMatch(/@|YP-/);
  await expect(finder.getByText('Just you and Priyanshi. She arranges the details with you.')).toBeVisible();
  // Aerial's card line has no duration, so no meta line shows.
  await expect(finder.getByTestId('class-finder-result').getByText(/\bmin\b|Private sessions only/)).toHaveCount(0);
  // The title is visually hidden on the result, so the eyebrow leads into the class name.
  await expect(finder.getByRole('heading', { level: 2 })).toHaveClass(/\bsr-only\b/);
  await shot('private-aerial');
  await startAgain(finder);

  // Online Yin, then the alternative.
  await answerAll(finder, 'relax', 'some', 'online');
  await expect(resultName(finder)).toHaveText('Yin Yoga');
  ({ href, text } = await prefillOf(link));
  expect(text).toBe(
    "Hi Priyanshi, I found you on yogapriyanshi.com and used the class finder. I'm looking for calm and less stress, I'm fairly new, with a few classes behind me, and I'd like to practise live online. It suggested Yin Yoga. Is that a good fit for me?"
  );
  expect(href).not.toMatch(/@|YP-/);
  // The duration only, then the trial line: Yin is on the timetable.
  await expect(finder.getByText('75 min', { exact: true })).toBeVisible();
  await expect(finder.getByText('Long, quiet holds \u00b7 75 min')).toHaveCount(0);
  await expect(finder.getByText('Your first class is a trial at AED 90.')).toBeVisible();
  await expect(finder.getByRole('button', { name: 'Book this class' })).toBeVisible();
  await expect(finder.getByText('Not on the timetable. Send a message and Priyanshi will find a time with you.')).toHaveCount(0);
  await startAgain(finder);

  // Online Spine Healing is contact-only, then the alternative.
  await answerAll(finder, 'back', 'some', 'online');
  await expect(resultName(finder)).toHaveText('Spine Healing');
  await expect(
    finder.getByText('Not on the timetable. Send a message and Priyanshi will find a time with you.')
  ).toBeVisible();
  await expect(finder.getByRole('button', { name: 'Ask about this class' })).toBeVisible();
  await finder.getByRole('button', { name: 'Show Hatha instead' }).click();
  await expect(resultName(finder)).toHaveText('Hatha');
  await expect(resultName(finder)).toBeFocused();
  ({ text } = await prefillOf(link));
  expect(text).toContain('It suggested Hatha.');
  // Swapped: the main class is now the alternative, and the primary follows (Hatha is bookable).
  await expect(finder.getByRole('button', { name: 'Show Spine Healing instead' })).toBeVisible();
  await expect(finder.getByRole('button', { name: 'Book this class' })).toBeVisible();

  // Its name never matches the floating button's.
  await expect(finder.getByRole('link', { name: 'Chat with Priyanshi on WhatsApp' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(finder).toHaveCount(0);
  await expect(chat(page)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chat with Priyanshi on WhatsApp' })).toHaveCount(1);

  // State resets on close: reopening starts at Q1, and the last result never shows, not even for a frame.
  await heroLink(page).click();
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  expect(await finder.getByTestId('class-finder-result').count()).toBe(0);
  await expect(finder.getByRole('heading', { level: 2 })).not.toHaveClass(/\bsr-only\b/);
});

test('book and contact routes open the right sheet with the right class', async ({ page, request }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const hatha = await soonest(request, 'hatha');
  const chakra = await soonest(request, 'chakra');
  const finder = await openFinder(page);
  const booking = bookingModal(page);

  await answerAll(finder, 'unsure', 'new', 'in_person');
  await finder.getByRole('button', { name: 'Book this class' }).click();
  await expect(booking.locator('select')).toHaveValue(hatha.id);
  await expect(finder).toHaveCount(0);
  await expect(booking.getByRole('button', { name: 'In person' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(booking).toHaveCount(0);

  await heroLink(page).click();
  await answerAll(finder, 'relax', 'new', 'online');
  await finder.getByRole('button', { name: 'Book this class' }).click();
  await expect(booking.locator('select')).toHaveValue(chakra.id);
  await expect(booking.getByRole('button', { name: 'Online Live Stream' })).toHaveAttribute('aria-pressed', 'true');
  await shot('booking-online');
  await page.keyboard.press('Escape');
  await expect(booking).toHaveCount(0);

  // The two classes that took over Thursday and Friday.
  const fromFinder: Array<[Goal, Experience, string, string]> = [
    ['unsure', 'regular', 'Vinyasa', (await soonest(request, 'vinyasa')).id],
    ['relax', 'some', 'Yin Yoga', (await soonest(request, 'yin')).id],
  ];
  for (const [goal, exp, name, sessionId] of fromFinder) {
    await heroLink(page).click();
    await answerAll(finder, goal, exp, 'in_person');
    await expect(resultName(finder)).toHaveText(name);
    await finder.getByRole('button', { name: 'Book this class' }).click();
    await expect(booking.locator('select')).toHaveValue(sessionId);
    await page.keyboard.press('Escape');
    await expect(booking).toHaveCount(0);
  }

  const contact = page.getByRole('dialog', { name: 'Send a message' });
  const routes: Array<[Goal, Experience, Format, string, string]> = [
    ['back', 'new', 'in_person', 'Ask about this class', 'Spine Healing'],
    ['relax', 'new', 'private', 'Ask about a private session', 'Private session'],
    ['strength', 'regular', 'private', 'Ask about private Aerial', 'Private Aerial Yoga'],
    ['pregnancy', 'new', 'private', 'Ask about this class', 'Prenatal & Postnatal'],
  ];
  for (const [goal, exp, format, label, interest] of routes) {
    await heroLink(page).click();
    await answerAll(finder, goal, exp, format);
    await finder.getByRole('button', { name: label, exact: true }).click();
    await expect(contact.getByLabel('Area of Interest'), `${goal}/${exp}/${format}`).toHaveValue(interest);
    await expect(finder).toHaveCount(0);
    await expect(booking).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(contact).toHaveCount(0);
  }
});

test('keyboard: Tab and Enter work through it, focus follows each heading and stays inside', async ({ page }) => {
  await openHome(page);
  const link = heroLink(page);
  await link.focus();
  await page.keyboard.press('Enter');
  const finder = classFinder(page);
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();

  // The close button comes first, then the answers.
  await page.keyboard.press('Tab');
  await expect(finder.getByRole('button', { name: 'Close class finder' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(finder.getByRole('button', { name: GOAL.relax })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(finder.getByRole('button', { name: GOAL.flexibility })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(finder.getByRole('heading', { name: 'How much yoga have you done?' })).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(finder.getByRole('button', { name: EXPERIENCE.new })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(finder.getByRole('heading', { name: 'How would you like to practise?' })).toBeFocused();

  // Back keeps the earlier answer pressed.
  await finder.getByRole('button', { name: 'Back' }).focus();
  await page.keyboard.press('Enter');
  await expect(finder.getByRole('heading', { name: 'How much yoga have you done?' })).toBeFocused();
  await expect(finder.getByRole('button', { name: EXPERIENCE.new })).toHaveAttribute('aria-pressed', 'true');
  await expect(finder.getByRole('button', { name: EXPERIENCE.some })).toHaveAttribute('aria-pressed', 'false');
  await finder.getByRole('button', { name: 'Back' }).focus();
  await page.keyboard.press('Enter');
  await expect(finder.getByRole('button', { name: GOAL.flexibility })).toHaveAttribute('aria-pressed', 'true');
  await finder.getByRole('button', { name: GOAL.flexibility }).focus();
  await page.keyboard.press('Enter');
  await finder.getByRole('button', { name: EXPERIENCE.new }).focus();
  await page.keyboard.press('Enter');
  await finder.getByRole('button', { name: FORMAT.in_person }).focus();
  await page.keyboard.press('Enter');
  await expect(finder.getByRole('heading', { name: 'A few details for Priyanshi' })).toBeFocused();
  await finder.getByRole('button', { name: 'Skip to my suggestion' }).focus();
  await page.keyboard.press('Enter');
  await expect(resultName(finder)).toHaveText('Hatha');
  await expect(resultName(finder)).toBeFocused();

  // Focus is trapped: many Tabs never leave the sheet.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await finder.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }

  // Start again sends focus to the first question.
  await finder.getByRole('button', { name: 'Start again' }).focus();
  await page.keyboard.press('Enter');
  await expect(finder.getByRole('heading', { name: 'What would you like yoga to give you?' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(finder).toHaveCount(0);
  await expect(link).toBeFocused();
});

test('hand-off: one sheet at a time, the page stays inert, and closing booking returns to the link', async ({ page }) => {
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  const link = carouselLink(page);
  await link.click();
  const finder = classFinder(page);
  await answerAll(finder, 'flexibility', 'some', 'online');
  await expect(resultName(finder)).toHaveText('Barre');
  await finder.getByRole('button', { name: 'Book this class' }).click();
  const booking = bookingModal(page);
  await expect(booking.locator('select option:checked')).toContainText('Barre');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('header')).toHaveAttribute('inert', '');
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(booking).toHaveCount(0);
  await expect(page.locator('header')).not.toHaveAttribute('inert');
  await expect(link).toBeFocused();
});

/** A real touch stream through CDP (as in 09-apple-design). */
function finger(cdp: CDPSession, page: Page) {
  let at = { x: 0, y: 0 };
  return {
    down: async (x: number, y: number) => {
      at = { x, y };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    },
    move: async (dx: number, dy: number, steps = 6) => {
      const from = at;
      for (let i = 1; i <= steps; i++) {
        at = { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
        await page.waitForTimeout(16);
      }
    },
    up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  };
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('a bottom sheet with a grabber, no overflow, 44px answers, and a flick dismisses it', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    const link = heroLink(page);
    // The sticky bar is hidden over the hero, so it never covers the link.
    await expect(page.getByLabel('Quick booking bar')).toHaveCount(0);
    const l = (await link.boundingBox())!;
    expect(l.y + l.height).toBeLessThanOrEqual(812);
    await link.tap();
    const finder = classFinder(page);
    await expect(finder.getByText('Question 1 of 3')).toBeVisible();
    await expect.poll(async () => {
      const b = (await finder.boundingBox())!;
      return Math.round(b.y + b.height);
    }).toBe(812);
    await expect(finder.getByTestId('sheet-grabber')).toBeVisible();

    const noOverflow = async (label: string) => {
      const { doc, sheet } = await finder.evaluate((el) => ({
        doc: document.documentElement.scrollWidth,
        sheet: el.scrollWidth - el.clientWidth,
      }));
      expect(doc, `${label}: page width`).toBeLessThanOrEqual(375);
      expect(sheet, `${label}: sheet width`).toBeLessThanOrEqual(0);
    };
    const tallEnough = async () => {
      for (const b of await finder.getByRole('group').getByRole('button').all())
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    };
    await noOverflow('q1');
    await tallEnough();
    await finder.getByRole('button', { name: GOAL.back }).tap();
    await expect(finder.getByText('Question 2 of 3')).toBeVisible();
    await noOverflow('q2');
    await tallEnough();
    await finder.getByRole('button', { name: EXPERIENCE.new }).tap();
    await expect(finder.getByText('Question 3 of 3')).toBeVisible();
    await noOverflow('q3');
    await tallEnough();
    await finder.getByRole('button', { name: FORMAT.in_person }).tap();
    await expect(finder.getByText('Optional', { exact: true })).toBeVisible();
    await noOverflow('intro');
    await finder.getByRole('button', { name: 'Skip to my suggestion' }).tap();
    await expect(resultName(finder)).toHaveText('Spine Healing');
    await expect(finder.getByTestId('class-finder-notice')).toHaveText('Tell Priyanshi about any back injury or pain before class.');
    await noOverflow('result');
    await shot('phone-result');

    // A downward flick on the grabber dismisses it.
    const grabber = finder.getByTestId('sheet-grabber');
    await grabber.scrollIntoViewIfNeeded();
    const box = (await grabber.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const f = finger(cdp, page);
    await f.down(box.x + box.width / 2, box.y + 20);
    await f.move(0, 120);
    await f.move(0, 300, 4);
    await f.up();
    await expect(finder).toHaveCount(0);
  });

  test('dragging the sheet closed clears the answers too', async ({ page }) => {
    await openHome(page);
    await heroLink(page).tap();
    const finder = classFinder(page);
    await toIntro(finder, 'relax', 'new', 'online');
    await addDetails(finder, { age: '34', conditions: 'CANARYDRAG7Q' });
    await expect(previewOf(finder)).toContainText('CANARYDRAG7Q');
    const grabber = finder.getByTestId('sheet-grabber');
    await grabber.scrollIntoViewIfNeeded();
    const box = (await grabber.boundingBox())!;
    const f = finger(await page.context().newCDPSession(page), page);
    await f.down(box.x + box.width / 2, box.y + 20);
    await f.move(0, 120);
    await f.move(0, 300, 4);
    await f.up();
    await expect(finder).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.outerHTML.includes('CANARYDRAG7Q'))).toBe(false);
    await heroLink(page).tap();
    await toIntro(finder, 'relax', 'new', 'online');
    await finder.getByRole('button', { name: 'Add details' }).click();
    await expect(finder.getByLabel('Age')).toHaveValue('');
  });

  test('reduced motion: the phone sheet cross-fades and steps change at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    // Record the sheet's bottom edge every frame while it opens: a cross-fade never moves it.
    await page.evaluate(() => {
      const w = window as any;
      w.__bottoms = [];
      const t0 = performance.now();
      const tick = () => {
        const d = document.querySelector('[role="dialog"]');
        if (d) w.__bottoms.push(Math.round(d.getBoundingClientRect().bottom));
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await heroLink(page).tap();
    const finder = classFinder(page);
    await expect(finder.getByText('Question 1 of 3')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__bottoms.length)).toBeGreaterThan(5);
    const bottoms: number[] = await page.evaluate(() => (window as any).__bottoms);
    expect(new Set(bottoms), 'the sheet never slides').toEqual(new Set([812]));

    await finder.getByRole('button', { name: GOAL.relax }).tap();
    await expect(finder.getByRole('heading', { name: 'How much yoga have you done?' })).toBeVisible();
    expect(await finder.getByTestId('class-finder-step').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });
});

test('facts guard: no Zoom, no former studio, and the trial only on a bookable group class', async ({ page }) => {
  const finder = await openFinder(page);
  for (const goal of Object.keys(GOAL) as Goal[]) {
    for (const format of Object.keys(FORMAT) as Format[]) {
      await answerAll(finder, goal, 'some', format);
      const { main } = expected(goal, 'some', format);
      const text = await finder.innerText();
      const label = `${goal}/some/${format}`;
      expect(text, label).not.toMatch(/Zoom|Lifestyle Yoga|Lifestyle|doctor|clearance|\bsafe\b|\bcure\b/i);
      if (format !== 'private' && BOOKABLE.includes(main)) expect(text, label).toContain('Your first class is a trial at AED 90.');
      else expect(text, label).not.toMatch(/free|trial/i);
      await startAgain(finder);
    }
  }
});

/** The element's opacity times every ancestor's: 1 once all fades (sheet, step, reveal) are done. */
const shownOpacity = (target: Locator) =>
  target.evaluate((el) => {
    let o = 1;
    for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  });

/** Waits until the sheet has finished arriving: fully opaque and at rest (no slide or scale left). */
async function settled(finder: Locator) {
  const step = finder.getByTestId('class-finder-step');
  await expect.poll(() => shownOpacity(step)).toBe(1);
  await expect
    .poll(() =>
      finder.evaluate((el) => {
        const t = new DOMMatrix(getComputedStyle(el.parentElement!).transform);
        return t.m42 === 0 && t.a === 1;
      })
    )
    .toBe(true);
}

test('screenshots: Q1, a result, the pregnancy result and the hero link at 1280 and 375', async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await openHome(page);
    // The hero word fade ends in about 2s; wait for the link to be fully shown before the picture.
    await expect.poll(() => heroLink(page).evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    await page.screenshot({ path: path.join(SHOTS, `${width}-hero-link.png`) });
    await heroLink(page).click();
    const finder = classFinder(page);
    await expect(finder.getByText('Question 1 of 3')).toBeVisible();
    await settled(finder);
    await page.screenshot({ path: path.join(SHOTS, `${width}-q1.png`) });
    await answerAll(finder, 'relax', 'some', 'online');
    await settled(finder);
    await page.screenshot({ path: path.join(SHOTS, `${width}-result-yin.png`) });
    await startAgain(finder);
    await answerAll(finder, 'pregnancy', 'new', 'in_person');
    await settled(finder);
    await page.screenshot({ path: path.join(SHOTS, `${width}-result-pregnancy.png`) });
    await startAgain(finder);
    await answerAll(finder, 'strength', 'regular', 'private');
    await settled(finder);
    await page.screenshot({ path: path.join(SHOTS, `${width}-result-aerial.png`) });
    if (width === 1280) {
      await page.keyboard.press('Escape');
      const classes = page.locator('#classes');
      await expect(finder).toHaveCount(0);
      await classes.scrollIntoViewIfNeeded();
      await expect.poll(() => shownOpacity(carouselLink(page))).toBe(1);
      await page.screenshot({ path: path.join(SHOTS, `${width}-carousel-link.png`) });
    }
  }
});

// --- The optional details: age, height and health notes ---

const NOTICE = "Please tell Priyanshi about anything you've noted here before your first class.";
const waLink = (finder: Locator) => finder.getByRole('link', { name: /^(Ask Priyanshi|Send this) on WhatsApp$/ });
const previewOf = (finder: Locator) => finder.getByTestId('class-finder-preview');
const panelOf = (finder: Locator) => finder.getByTestId('class-finder-details');
const heading = (finder: Locator, name: string) => finder.getByRole('heading', { level: 3, name, exact: true });

/** Answers the three questions and stops on the optional intro. */
async function toIntro(finder: Locator, goal: Goal, exp: Experience, format: Format) {
  await finder.getByRole('button', { name: GOAL[goal], exact: true }).click();
  await finder.getByRole('button', { name: EXPERIENCE[exp], exact: true }).click();
  await finder.getByRole('button', { name: FORMAT[format], exact: true }).click();
  await expect(heading(finder, 'A few details for Priyanshi')).toBeVisible();
}

interface Details {
  age?: string;
  height?: string;
  conditions?: string;
  medication?: string;
  injury?: string;
}

/** From the intro, through the four optional steps to the result. */
async function addDetails(finder: Locator, d: Details) {
  await finder.getByRole('button', { name: 'Add details' }).click();
  await expect(heading(finder, 'Your age and height')).toBeVisible();
  await finder.getByLabel('Age').fill(d.age ?? '');
  await finder.getByLabel('Height (cm)').fill(d.height ?? '');
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await heading(finder, 'Any health conditions?').waitFor();
  await finder.getByRole('textbox').fill(d.conditions ?? '');
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await heading(finder, 'Any medication, now or in the past?').waitFor();
  await finder.getByRole('textbox').fill(d.medication ?? '');
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await heading(finder, 'Any injury, surgery or pain?').waitFor();
  await finder.getByRole('textbox').fill(d.injury ?? '');
  await finder.getByRole('button', { name: 'See my suggestion' }).click();
  await expect(finder.getByText('Your suggestion', { exact: true })).toBeVisible();
}

/** The preview is the message in the link, exactly, and the link is within the cap. */
async function expectPreviewIsLink(finder: Locator) {
  const { href, text } = await prefillOf(waLink(finder));
  expect(await previewOf(finder).textContent()).toBe(text);
  expect(href.length).toBeLessThanOrEqual(WHATSAPP_URL_CAP);
  return text!;
}

test('details module: cleaning, digits, guards and the URL cap', () => {
  const url = (text: string) => `https://wa.me/971508955421?text=${encodeURIComponent(text)}`;
  const base = 'Hi Priyanshi. '.repeat(30);
  // Control characters and newlines become a space, bidi overrides and lone surrogates go.
  expect(cleanFreeText('a\nb\r\n\tc\u0007d')).toBe('a b c d');
  expect(cleanFreeText('x\u202ey\u2066z\u2069')).toBe('xyz');
  expect(cleanFreeText('ok\ud83d')).toBe('ok');
  expect(cleanFreeText('\udc00ok')).toBe('ok');
  expect(() => encodeURIComponent(cleanFreeText('a\ud83d b\udc00'))).not.toThrow();
  // Joiners stay: emoji and some scripts need them.
  const family = '\u{1F468}\u200d\u{1F469}\u200d\u{1F467}';
  expect(cleanFreeText(family)).toBe(family);
  // Cut by code point, so an emoji is never split.
  const cut = cleanFreeText('\u{1F600}'.repeat(130));
  expect(Array.from(cut)).toHaveLength(120);
  expect(() => encodeURIComponent(cut)).not.toThrow();

  expect(normaliseDigits('\u0663\u0664')).toBe('34');
  expect(normaliseDigits('\u06f3\u06f4')).toBe('34');
  expect(normaliseDigits('\u0969\u096a')).toBe('34');
  expect(normaliseDigits('1a6-5x9')).toBe('165');
  for (const [age, ok] of [['4', false], ['5', true], ['110', true], ['111', false], ['', false]] as const) expect(validAge(age), age).toBe(ok);
  for (const [h, ok] of [['99', false], ['100', true], ['250', true], ['251', false]] as const) expect(validHeight(h), h).toBe(ok);

  // Empty details: the base message, untouched.
  expect(classFinderMessage(base, EMPTY_HEALTH, url)).toEqual({ message: base, trimmed: false });
  expect(finderHasHealth(EMPTY_HEALTH)).toBe(false);
  expect(finderHasHealth({ ...EMPTY_HEALTH, conditions: '  \n ' })).toBe(false);
  // A value that fails its guard never reaches the message, even if Back got it past Next.
  const bad = { ...EMPTY_HEALTH, age: '999', height: '12' };
  expect(finderHasHealth(bad)).toBe(false);
  expect(classFinderMessage(base, bad, url).message).toBe(base);
  expect(finderHasHealth({ ...EMPTY_HEALTH, age: '34' })).toBe(true);
  expect(finderHasHealthNotes({ ...EMPTY_HEALTH, age: '34' })).toBe(false);

  // Only the filled lines, in order.
  expect(classFinderMessage('Base', { age: '034', height: '', conditions: 'c', medication: '', injury: 'i' }, url).message).toBe(
    'Base\n\nA few things about me:\nAge: 34\nHealth conditions: c\nInjury, surgery or pain: i'
  );

  // Over the cap: the field that costs most once encoded is cut, and marked. ASCII stays whole.
  const hindi = '\u0939'.repeat(120);
  const ascii = 'a'.repeat(120);
  const { message, trimmed } = classFinderMessage(base, { ...EMPTY_HEALTH, conditions: hindi, medication: ascii, injury: hindi }, url);
  expect(trimmed).toBe(true);
  expect(url(message).length).toBeLessThanOrEqual(WHATSAPP_URL_CAP);
  expect(message).toContain(`Medication, now or in the past: ${ascii}\n`);
  expect(message).toMatch(/Health conditions: \u0939+…\n/);
  expect(message).toMatch(/Injury, surgery or pain: \u0939+…$/);

  // Emoji at the cap never split into something encodeURIComponent throws on.
  const emoji = '\u{1F600}'.repeat(120);
  const big = classFinderMessage(base, { ...EMPTY_HEALTH, conditions: emoji, medication: emoji, injury: emoji }, url);
  expect(url(big.message).length).toBeLessThanOrEqual(WHATSAPP_URL_CAP);
  expect(big.message.includes('…')).toBe(true);
  // A base message alone over the cap can't loop for ever.
  expect(classFinderMessage('x'.repeat(3000), { ...EMPTY_HEALTH, conditions: 'abc' }, url).trimmed).toBe(true);

  // No medical advice in the copy, and never a parse of what was typed.
  const source = fs.readFileSync(path.join('src', 'constants', 'class-finder-health.ts'), 'utf-8');
  expect(source).not.toMatch(/doctor|cleared|\bcure|safe to/i);
  expect(fs.readFileSync(path.join('src', 'components', 'ClassFinderModal.tsx'), 'utf-8')).not.toMatch(/doctor/i);
});

test('details: labels, intro, Next, Skip and Back, with focus on each heading', async ({ page }) => {
  const finder = await openFinder(page);
  await toIntro(finder, 'relax', 'new', 'online');
  await expect(finder.getByText('Optional', { exact: true })).toBeVisible();
  await expect(heading(finder, 'A few details for Priyanshi')).toBeFocused();
  for (const line of [
    "You can share your age, height and any health details with Priyanshi. It's optional, and your suggested class stays the same.",
    "This website doesn't save them. They go into a WhatsApp message you check first. Opening it shares the text with WhatsApp, and your browser may remember the link. Priyanshi only sees it if you press send.",
  ]) {
    await expect(finder.getByText(line)).toBeVisible();
  }

  await finder.getByRole('button', { name: 'Add details' }).click();
  await expect(finder.getByText('Optional question 1 of 4')).toBeVisible();
  await expect(heading(finder, 'Your age and height')).toBeFocused();
  const age = finder.getByLabel('Age');
  const height = finder.getByLabel('Height (cm)');
  // Nothing that could be submitted or autofilled.
  await expect(finder.locator('form')).toHaveCount(0);
  for (const f of [age, height]) {
    await expect(f).toHaveAttribute('inputmode', 'numeric');
    await expect(f).toHaveAttribute('maxlength', '3');
    await expect(f).toHaveAttribute('autocomplete', 'off');
    await expect(f).toHaveAttribute('spellcheck', 'false');
    expect(await f.getAttribute('name')).toBeNull();
    await expect(f).toHaveAttribute('enterkeyhint', 'next');
  }
  // Enter on Age with Height empty goes to Height, without leaving the step or flagging anything.
  await age.fill('34');
  await age.press('Enter');
  await expect(height).toBeFocused();
  await expect(heading(finder, 'Your age and height')).toBeVisible();
  await expect(age).not.toHaveAttribute('aria-invalid');
  await age.fill('');

  // The moment a field gets focus for its error, the error is already in the DOM and linked to it.
  await age.evaluate((el) => {
    el.addEventListener('focus', () => {
      const id = el.getAttribute('aria-describedby');
      (window as any).__atFocus = {
        invalid: el.getAttribute('aria-invalid'),
        error: id ? document.getElementById(id)?.textContent ?? null : null,
      };
    });
  });

  // Typo guards, inline. Letters never appear; other scripts' digits become ASCII.
  await age.pressSequentially('2x');
  await expect(age).toHaveValue('2');
  await height.fill('99');
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(age).toHaveAttribute('aria-invalid', 'true');
  await expect(age).toHaveAccessibleDescription('Please enter your age in years, or leave it blank.');
  await expect(age).toBeFocused();
  expect(await page.evaluate(() => (window as any).__atFocus)).toEqual({
    invalid: 'true',
    error: 'Please enter your age in years, or leave it blank.',
  });
  await expect(height).toHaveAttribute('aria-invalid', 'true');
  await expect(height).toHaveAccessibleDescription('Please enter your height in cm, or leave it blank.');
  await age.fill('\u0663\u0664');
  await expect(age).toHaveValue('34');
  await expect(age).not.toHaveAttribute('aria-invalid');
  await height.fill('\u0967\u096c\u096b');
  await expect(height).toHaveValue('165');
  // Enter on a number moves on.
  await height.press('Enter');
  await expect(finder.getByText('Optional question 2 of 4')).toBeVisible();
  await expect(heading(finder, 'Any health conditions?')).toBeFocused();
  await expect(finder.getByText("Anything you'd like Priyanshi to know. Up to 120 characters.")).toBeVisible();
  const conditions = finder.getByRole('textbox', { name: 'Any health conditions?' });
  await expect(conditions).toHaveAttribute('maxlength', '120');
  await expect(conditions).toHaveAttribute('spellcheck', 'false');
  await conditions.fill('First note');

  // Back keeps the values.
  await finder.getByRole('button', { name: 'Back' }).click();
  await expect(heading(finder, 'Your age and height')).toBeFocused();
  await expect(age).toHaveValue('34');
  await expect(height).toHaveValue('165');
  await height.press('Enter');
  await expect(conditions).toHaveValue('First note');

  // Skip clears that step alone, and moves on.
  await finder.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(finder.getByText('Optional question 3 of 4')).toBeVisible();
  await expect(heading(finder, 'Any medication, now or in the past?')).toBeFocused();
  await expect(finder.getByText('The name is enough. Up to 120 characters.')).toBeVisible();
  await finder.getByRole('button', { name: 'Back' }).click();
  await expect(conditions).toHaveValue('');
  // Next with nothing typed does the same as Skip.
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(finder.getByText('Optional question 4 of 4')).toBeVisible();
  await expect(heading(finder, 'Any injury, surgery or pain?')).toBeFocused();
  await expect(finder.getByText('Where and roughly when is enough. Up to 120 characters.')).toBeVisible();
  await expect(finder.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await finder.getByRole('button', { name: 'See my suggestion' }).click();
  await expect(resultName(finder)).toBeFocused();

  // Age and height only: the panel, but no notice about health notes.
  const text = await expectPreviewIsLink(finder);
  expect(text).toContain('\n\nA few things about me:\nAge: 34\nHeight: 165 cm');
  expect(text).not.toMatch(/Health conditions|Medication|Injury/);
  await expect(finder.getByTestId('class-finder-health-notice')).toHaveCount(0);

  // Back from the result goes to the step it came from.
  await finder.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(heading(finder, 'Any injury, surgery or pain?')).toBeFocused();
});

test('details: "Skip to my suggestion" clears them, and Back returns to the intro', async ({ page }) => {
  const finder = await openFinder(page);
  await toIntro(finder, 'relax', 'new', 'online');
  await addDetails(finder, { age: '34' });
  await expect(panelOf(finder)).toBeVisible();
  // Back through every step to the intro.
  for (let i = 0; i < 5; i++) await finder.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(heading(finder, 'A few details for Priyanshi')).toBeVisible();
  await finder.getByRole('button', { name: 'Skip to my suggestion' }).click();
  await expect(resultName(finder)).toBeFocused();
  // Exactly today's result, plus a quiet Back.
  await expect(panelOf(finder)).toHaveCount(0);
  await expect(finder.getByTestId('class-finder-action-note')).toHaveCount(0);
  const { text } = await prefillOf(waLink(finder));
  expect(text).not.toContain('A few things about me');
  await finder.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(heading(finder, 'A few details for Priyanshi')).toBeFocused();
  await finder.getByRole('button', { name: 'Add details' }).click();
  await expect(finder.getByLabel('Age')).toHaveValue('');
});

test('result panel: the exact message, the notes and notice, swap, Remove, Back and Start again', async ({ page }) => {
  const finder = await openFinder(page);
  await toIntro(finder, 'back', 'some', 'online');
  await addDetails(finder, { age: '34', height: '165', conditions: 'Asthma\nmild', medication: 'None now', injury: 'Knee, 2020' });

  const base =
    "Hi Priyanshi, I found you on yogapriyanshi.com and used the class finder. I'm looking for back care, I'm fairly new, with a few classes behind me, and I'd like to practise live online. It suggested Spine Healing. Is that a good fit for me?";
  const details =
    '\n\nA few things about me:\nAge: 34\nHeight: 165 cm\nHealth conditions: Asthma mild\nMedication, now or in the past: None now\nInjury, surgery or pain: Knee, 2020';
  expect(await expectPreviewIsLink(finder)).toBe(base + details);

  const preview = previewOf(finder);
  await expect(preview).toHaveAttribute('translate', 'no');
  await expect(preview).toHaveAttribute('dir', 'auto');
  expect(await preview.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
  const panel = panelOf(finder);
  await expect(panel.getByText('Your message to Priyanshi')).toBeVisible();
  await expect(
    panel.getByText(
      "These details don't change your suggestion. Nothing is sent yet: the WhatsApp button below opens this message for you to check. WhatsApp gets the text when it opens, and your browser may remember the link. Priyanshi only sees it if you press send.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Send this on WhatsApp' })).toBeVisible();
  await expect(panel.getByText('Your message was shortened to fit.')).toHaveCount(0);

  // One notice at a time: the goal's, unchanged, so the details' stays away.
  await expect(finder.getByTestId('class-finder-notice')).toHaveText('Tell Priyanshi about any back injury or pain before class.');
  await expect(finder.getByTestId('class-finder-health-notice')).toHaveCount(0);
  // Spine Healing online opens Contact.
  await expect(finder.getByTestId('class-finder-action-note')).toHaveText(
    "The contact form doesn't include your answers. To share them, use the WhatsApp button below first."
  );
  const wording = await finder.innerText();
  expect(wording).not.toMatch(/doctor|cleared|clearance|\bsafe\b|\bcure/i);

  // The swap rebuilds both from the same string, and the booking note follows the action.
  await finder.getByRole('button', { name: 'Show Hatha instead' }).click();
  await expect(resultName(finder)).toBeFocused();
  let text = await expectPreviewIsLink(finder);
  expect(text).toContain('It suggested Hatha.');
  expect(text.endsWith(details)).toBe(true);
  await expect(finder.getByTestId('class-finder-action-note')).toHaveText(
    "Booking doesn't include your answers. To share them, use the WhatsApp button below first."
  );

  // Back and forward keep the two in step.
  await finder.getByRole('button', { name: 'Back', exact: true }).click();
  await heading(finder, 'Any injury, surgery or pain?').waitFor();
  await finder.getByRole('button', { name: 'See my suggestion' }).click();
  await expect(resultName(finder)).toHaveText('Hatha');
  text = await expectPreviewIsLink(finder);
  expect(text.endsWith(details)).toBe(true);

  // Remove: the panel, the notes and the details go; focus lands on the class; the base message stays.
  await panel.getByRole('button', { name: 'Remove my answers' }).click();
  await expect(panel).toHaveCount(0);
  await expect(resultName(finder)).toBeFocused();
  await expect(finder.getByTestId('class-finder-health-notice')).toHaveCount(0);
  await expect(finder.getByTestId('class-finder-action-note')).toHaveCount(0);
  await expect(finder.getByTestId('class-finder-notice')).toHaveCount(1);
  expect((await prefillOf(waLink(finder))).text).not.toContain('A few things about me');
  await expect(finder.getByRole('link', { name: 'Ask Priyanshi on WhatsApp' })).toBeVisible();
  await expect(finder.getByRole('link', { name: 'Send this on WhatsApp' })).toHaveCount(0);
  // And they are really gone from the steps.
  await finder.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(finder.getByRole('textbox', { name: 'Any injury, surgery or pain?' })).toHaveValue('');
  await finder.getByRole('button', { name: 'See my suggestion' }).click();
  await expect(panel).toHaveCount(0);

  // Start again clears everything too.
  await startAgain(finder);
  await toIntro(finder, 'relax', 'new', 'online');
  await addDetails(finder, { injury: 'Wrist' });
  expect(await expectPreviewIsLink(finder)).toContain('Injury, surgery or pain: Wrist');
  // No goal notice on this path, so the details' own notice shows.
  await expect(finder.getByTestId('class-finder-notice')).toHaveCount(0);
  await expect(finder.getByTestId('class-finder-health-notice')).toHaveText(NOTICE);
  await startAgain(finder);
  await expect(heading(finder, 'What would you like yoga to give you?')).toBeFocused();
  await toIntro(finder, 'relax', 'new', 'online');
  await finder.getByRole('button', { name: 'Add details' }).click();
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(finder.getByRole('textbox', { name: 'Any injury, surgery or pain?' })).toHaveValue('');
});

test('result order: the main action comes before the panel, and the WhatsApp button sits right under the message', async ({ page }) => {
  const finder = await openFinder(page);
  const primary = finder.getByRole('button', { name: 'Book this class' });
  const startAgainButton = finder.getByRole('button', { name: 'Start again' });
  const top = async (l: Locator) => (await l.boundingBox())!.y;

  // No details: as it was. Primary, WhatsApp, then Start again and Back.
  await answerAll(finder, 'unsure', 'new', 'in_person');
  await expect(resultName(finder)).toHaveText('Hatha');
  const plainLink = finder.getByRole('link', { name: 'Ask Priyanshi on WhatsApp' });
  expect(await top(plainLink)).toBeGreaterThan(await top(primary));
  expect(await top(startAgainButton)).toBeGreaterThan(await top(plainLink));
  await startAgain(finder);

  // With details, on a bookable class.
  await toIntro(finder, 'unsure', 'new', 'in_person');
  await addDetails(finder, { age: '34', conditions: 'A note for the order test' });
  await expect(resultName(finder)).toHaveText('Hatha');
  const swap = finder.getByRole('button', { name: 'Show Chakra Flow instead' });
  const note = finder.getByTestId('class-finder-action-note');
  const panel = panelOf(finder);
  const order = [resultName(finder), swap, note, primary, panel, startAgainButton];
  for (let i = 1; i < order.length; i++) expect(await top(order[i]), `step ${i}`).toBeGreaterThan(await top(order[i - 1]));
  await expect(finder.getByRole('link', { name: 'Ask Priyanshi on WhatsApp' })).toHaveCount(0);
  // The next thing after the message is its button, inside the panel.
  const sibling = await previewOf(finder).evaluate((el) => el.nextElementSibling?.textContent);
  expect(sibling).toBe('Send this on WhatsApp');
  await expect(panel.getByRole('link', { name: 'Send this on WhatsApp' })).toHaveCount(1);
  expect(await top(panel.getByRole('button', { name: 'Remove my answers' }))).toBeGreaterThan(await top(previewOf(finder)));
});

test('the cap: long Hindi and emoji are shortened with a note, never crash, and the preview stays the link', async ({ page }) => {
  const finder = await openFinder(page);
  await toIntro(finder, 'relax', 'new', 'online');
  const hindi = '\u0939'.repeat(120);
  await addDetails(finder, { conditions: hindi, medication: hindi, injury: hindi });
  await expect(panelOf(finder).getByText('Your message was shortened to fit. You can add more in WhatsApp.')).toBeVisible();
  let text = await expectPreviewIsLink(finder);
  expect(text).toContain('…');
  // Also after a swap, which changes the base message.
  await finder.getByRole('button', { name: 'Show Yin Yoga instead' }).click();
  await expect(resultName(finder)).toHaveText('Yin Yoga');
  text = await expectPreviewIsLink(finder);
  expect(text).toContain('It suggested Yin Yoga.');
  await startAgain(finder);

  await toIntro(finder, 'relax', 'new', 'online');
  const emoji = '\u{1F600}'.repeat(60);
  await addDetails(finder, { conditions: emoji, medication: emoji, injury: emoji });
  text = await expectPreviewIsLink(finder);
  expect(text).toContain('\u{1F600}');
  expect(text).not.toMatch(/\p{Cs}/u);
});

test('all 54 results are identical with and without details', async ({ page }) => {
  test.setTimeout(420_000);
  const finder = await openFinder(page);
  const details: Details = { age: '80', height: '150', conditions: 'Pregnant, back pain', medication: 'Aerial', injury: 'Knee surgery' };
  for (const goal of Object.keys(GOAL) as Goal[]) {
    for (const exp of Object.keys(EXPERIENCE) as Experience[]) {
      for (const format of Object.keys(FORMAT) as Format[]) {
        await answerAll(finder, goal, exp, format);
        await expectResult(finder, goal, exp, format);
        const plain = (await prefillOf(waLink(finder))).text!;
        const notices = await finder.getByTestId('class-finder-notice').allTextContents();
        await finder.getByRole('button', { name: 'Back', exact: true }).click();
        await heading(finder, 'A few details for Priyanshi').waitFor();
        await addDetails(finder, details);
        await expectResult(finder, goal, exp, format);
        const withDetails = await expectPreviewIsLink(finder);
        expect(withDetails.startsWith(`${plain}\n\nA few things about me:`), `${goal}/${exp}/${format}`).toBe(true);
        expect(await finder.getByTestId('class-finder-notice').allTextContents()).toEqual(notices);
        await startAgain(finder);
      }
    }
  }
});

test('canary: typed text reaches no request, header, console, storage, cookie, URL or history state', async ({ page, context }) => {
  test.setTimeout(120_000);
  const CANARIES = ['CANARYCONDITION7Q', 'CANARYMEDICINE7Q', 'CANARYINJURY7Q'];
  const NUMBERS = ['107', '243'];
  const seen: string[] = [];
  const pageUrls: string[] = [];
  const posts: string[] = [];
  const pending: Promise<void>[] = [];
  const stubbed: Array<Promise<Record<string, string>>> = [];
  context.on('request', (req) => {
    if (new URL(req.url()).hostname === 'wa.me') {
      stubbed.push(req.allHeaders());
      return;
    }
    if (req.method() === 'POST') posts.push(`${req.url()} ${req.postData() ?? ''}`);
    // Files can have digits in their cache keys; everything else must never carry the numbers.
    if (!['script', 'stylesheet', 'image', 'font', 'media'].includes(req.resourceType())) pageUrls.push(req.url());
    pending.push(
      req.allHeaders().then(
        (headers) => {
          seen.push(`${req.method()} ${req.url()} ${JSON.stringify(headers)} ${req.postData() ?? ''}`);
        },
        () => {}
      )
    );
  });
  const consoleLines: string[] = [];
  page.on('console', (msg) => consoleLines.push(msg.text()));
  await context.route('https://wa.me/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' })
  );

  const storedEverywhere = () =>
    page.evaluate(async () => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
      cookie: document.cookie,
      url: location.href,
      history: JSON.stringify(history.state),
      caches: 'caches' in window ? (await caches.keys()).join() : '',
    }));
  const expectNoCanary = async (where: string) => {
    await Promise.all(pending);
    const stored = JSON.stringify(await storedEverywhere());
    for (const c of [...CANARIES, ...NUMBERS]) expect(stored.includes(c), `${where}: ${c} in storage or the URL`).toBe(false);
    for (const c of CANARIES) {
      expect(seen.some((s) => s.includes(c)), `${where}: ${c} in a request`).toBe(false);
      expect(consoleLines.some((s) => s.includes(c)), `${where}: ${c} on the console`).toBe(false);
    }
    for (const n of NUMBERS) {
      const number = new RegExp(`\\b${n}\\b`);
      expect(pageUrls.filter((u) => number.test(u)), `${where}: ${n} in a request URL`).toEqual([]);
      expect(consoleLines.filter((l) => number.test(l)), `${where}: ${n} on the console`).toEqual([]);
    }
    // The form posts carry neither the fields nor the numbers.
    for (const body of posts) expect(body, where).not.toMatch(/"(age|height|conditions|medication|injury)"|\b107\b|\b243\b/);
  };

  const details: Details = { age: '107', height: '243', conditions: CANARIES[0], medication: CANARIES[1], injury: CANARIES[2] };
  const finder = await openFinder(page);
  await toIntro(finder, 'unsure', 'new', 'in_person');
  await addDetails(finder, details);
  const text = await expectPreviewIsLink(finder);
  for (const c of CANARIES) expect(text).toContain(c);
  await expectNoCanary('typed');

  // The link: no Referer and no opener, and only wa.me sees the text.
  await expect(waLink(finder)).toHaveAttribute('rel', 'noopener noreferrer');
  const [popup] = await Promise.all([context.waitForEvent('page'), waLink(finder).click()]);
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  expect(await popup.evaluate(() => document.referrer)).toBe('');
  expect(stubbed.length).toBe(1);
  expect(Object.keys(await stubbed[0]).map((k) => k.toLowerCase())).not.toContain('referer');
  await popup.close();
  // The finder stays open, so "send, then book" works.
  await expect(panelOf(finder)).toBeVisible();

  // A real booking from the result: no answers in the POST.
  await finder.getByRole('button', { name: 'Book this class' }).click();
  await expect(finder).toHaveCount(0);
  const booking = bookingModal(page);
  await booking.getByRole('button', { name: /Continue to Checkout/ }).click();
  await booking.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Canary Student');
  await booking.getByPlaceholder('layla@example.com').fill(uniqueEmail('canary-book'));
  await booking.getByRole('button', { name: /Reserve Seat/ }).click();
  await expect(booking.getByText("You're on the mat.")).toBeVisible();
  expect(posts.some((p) => p.includes('/api/bookings'))).toBe(true);
  await expectNoCanary('booked');
  await booking.getByRole('button', { name: 'Return to Studio' }).click();
  await expect(booking).toHaveCount(0);

  // Reopening: empty steps and nothing left in the DOM.
  await heroLink(page).click();
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  const dom = () => page.evaluate(() => document.documentElement.outerHTML);
  for (const c of CANARIES) expect((await dom()).includes(c), `${c} in the DOM`).toBe(false);
  await toIntro(finder, 'relax', 'new', 'private');
  await finder.getByRole('button', { name: 'Add details' }).click();
  await expect(finder.getByLabel('Age')).toHaveValue('');
  await expect(finder.getByLabel('Height (cm)')).toHaveValue('');
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(finder.getByRole('textbox')).toHaveValue('');
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(finder.getByRole('textbox')).toHaveValue('');
  await finder.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(finder.getByRole('textbox')).toHaveValue('');
  await finder.getByRole('button', { name: 'Back' }).click();
  await finder.getByRole('button', { name: 'Back' }).click();
  await finder.getByRole('button', { name: 'Back' }).click();
  await finder.getByRole('button', { name: 'Back' }).click();
  await heading(finder, 'A few details for Priyanshi').waitFor();
  await addDetails(finder, details);

  // A real contact message from the result: no answers in the POST.
  await finder.getByRole('button', { name: 'Ask about a private session' }).click();
  await expect(finder).toHaveCount(0);
  const contact = page.getByRole('dialog', { name: 'Send a message' });
  await contact.getByPlaceholder('e.g. Sarah Jenkins').fill('Canary Student');
  await contact.getByPlaceholder('sarah@example.com').fill(uniqueEmail('canary-contact'));
  await contact.getByPlaceholder(/Tell Priyanshi/).fill('A question about private classes.');
  await contact.getByRole('button', { name: 'Send Message' }).click();
  // The dialog is renamed by its success heading, so look for that on the page.
  await expect(page.getByRole('heading', { name: 'Message Sent' })).toBeVisible();
  expect(posts.some((p) => p.includes('/api/contact'))).toBe(true);
  await expectNoCanary('contacted');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const c of CANARIES) expect((await dom()).includes(c), `${c} in the DOM after the hand-off`).toBe(false);
});

// Every way out clears the answers: the sheet's exit frame is gone, then the steps are empty.
// Dragging it closed is the same test on a phone, in the phone block above.
test('closing with the X, Escape or the scrim clears the answers', async ({ page }) => {
  await openHome(page);
  const finder = classFinder(page);
  const closers: Array<() => Promise<unknown>> = [
    () => finder.getByRole('button', { name: 'Close class finder' }).click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(10, 10),
  ];
  for (const close of closers) {
    await heroLink(page).click();
    await toIntro(finder, 'relax', 'new', 'online');
    await addDetails(finder, { age: '34', conditions: 'CANARYCLOSE7Q' });
    await close();
    await expect(finder).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.outerHTML.includes('CANARYCLOSE7Q'))).toBe(false);
    await heroLink(page).click();
    await toIntro(finder, 'relax', 'new', 'online');
    await finder.getByRole('button', { name: 'Add details' }).click();
    await expect(finder.getByLabel('Age')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(finder).toHaveCount(0);
  }
});

test('WhatsApp off: no optional steps, no panel, no WhatsApp button, and booking still works', async ({ page }) => {
  await page.route('**/src/constants/contact.ts*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace(/export const WHATSAPP_ENABLED = [^;\n]+/, 'export const WHATSAPP_ENABLED = false');
    expect(body, 'the switch was rewritten').not.toBe(source);
    await route.fulfill({ response, body });
  });
  const finder = await openFinder(page);
  await expect(chat(page)).toHaveCount(0);
  await finder.getByRole('button', { name: GOAL.relax, exact: true }).click();
  await finder.getByRole('button', { name: EXPERIENCE.new, exact: true }).click();
  await finder.getByRole('button', { name: FORMAT.in_person, exact: true }).click();
  // Question 3 goes straight to the result.
  await expect(finder.getByText('Your suggestion')).toBeVisible();
  await expect(finder.getByText('Optional', { exact: true })).toHaveCount(0);
  await expect(finder.getByRole('textbox')).toHaveCount(0);
  await expect(waLink(finder)).toHaveCount(0);
  await expect(panelOf(finder)).toHaveCount(0);
  await expect(finder.getByTestId('class-finder-action-note')).toHaveCount(0);
  await finder.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(heading(finder, 'How would you like to practise?')).toBeFocused();
  await finder.getByRole('button', { name: FORMAT.in_person, exact: true }).click();
  await finder.getByRole('button', { name: 'Book this class' }).click();
  await expect(bookingModal(page).locator('select option:checked')).toContainText('Chakra');
  await expect(finder).toHaveCount(0);
});

const FINDER_CHUNK = '**/src/components/ClassFinderModal.tsx*';

/** Holds the finder's chunk until release() is called. */
async function holdChunk(page: Page) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(FINDER_CHUNK, async (route) => {
    await gate;
    await route.continue();
  });
  return () => release();
}

test('slow chunk: the sheet opens once it arrives, and focus returns to the opener', async ({ page }) => {
  const release = await holdChunk(page);
  await openHome(page);
  const finder = classFinder(page);
  const button = quizBand(page).getByRole('button', { name: 'Take the quiz' });
  await button.click();
  // While it loads the page stays live: no half-open state, the WhatsApp button stays.
  await expect(finder).toHaveCount(0);
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await expect(chat(page)).toBeVisible();
  release();
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  await expect(chat(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(finder).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(chat(page)).toBeVisible();
});

test('slow chunk: tapping Book meanwhile leaves no stray finder behind booking', async ({ page }) => {
  const release = await holdChunk(page);
  await openHome(page);
  const finder = classFinder(page);
  await heroLink(page).click();
  await page.locator('#home').getByRole('button', { name: 'Book a trial class' }).click();
  const booking = bookingModal(page);
  await expect(booking.getByText('Step 1 of 2')).toBeVisible();
  const arrived = page.waitForResponse((r) => r.url().includes('/src/components/ClassFinderModal.tsx'));
  release();
  await arrived;
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(finder).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(booking).toHaveCount(0);
  // Closing booking doesn't bring it back; a fresh tap still works.
  await page.waitForTimeout(200);
  await expect(finder).toHaveCount(0);
  await heroLink(page).click();
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
});

// The plain test: the aborted chunk logs "Failed to load resource: net::ERR_FAILED", which is the point here.
plainTest('failed chunk: one guarded reload on a tap, never on the preload, one main, and WhatsApp comes back', async ({ page }) => {
  let hits = 0;
  await page.route(FINDER_CHUNK, (route) => {
    hits += 1;
    return route.abort();
  });
  const uncaught: string[] = [];
  page.on('pageerror', (e) => { if (!/WebSocket/.test(e.message)) uncaught.push(e.message); });
  let loads = 0;
  page.on('load', () => (loads += 1));

  await openHome(page);
  await expect.poll(() => hits, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(loads, 'a failed idle preload never reloads').toBe(1);

  const finder = classFinder(page);
  await quizBand(page).getByRole('button', { name: 'Take the quiz' }).click();
  await expect.poll(() => loads).toBe(2);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.evaluate(() => sessionStorage.getItem('yp-chunk-reload'))).resolves.toBe('1');

  // The second failure does nothing beyond leaving the page as it was.
  await quizBand(page).getByRole('button', { name: 'Take the quiz' }).click();
  await page.waitForTimeout(800);
  expect(loads, 'no reload loop').toBe(2);
  await expect(finder).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await expect(page.getByTestId('whatsapp-chat')).toBeVisible();
  expect(uncaught).toEqual([]);

  // Once the chunk loads again the flag clears, so a later failure may use its one reload.
  await page.unroute(FINDER_CHUNK);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('yp-chunk-reload')), { timeout: 15_000 }).toBeNull();
  await heroLink(page).click();
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
});

// The plain test: the aborted chunk logs a load failure, which is the point here.
plainTest('reload loop: a lazy page chunk that fails slowly reloads once, even though the finder chunk loads meanwhile', async ({ page }) => {
  const FINDER_LOADED = page.waitForResponse((r) => r.url().includes('/src/components/ClassFinderModal.tsx'));
  let aborted = 0;
  await page.route('**/src/components/DraftPreview.tsx*', async (route) => {
    // Slow on purpose: the idle preload of the finder finishes first, on every load.
    await page.waitForResponse((r) => r.url().includes('/src/components/ClassFinderModal.tsx'), { timeout: 8000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 800));
    aborted += 1;
    await route.abort().catch(() => {});
  });
  let loads = 0;
  page.on('load', () => (loads += 1));
  await page.goto('/__test/article', { waitUntil: 'commit' });
  await FINDER_LOADED;
  await expect(page.getByRole('heading', { name: "This page didn't load" })).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(4000);
  expect(loads, 'at most one reload').toBeLessThanOrEqual(2);
  expect(aborted).toBeLessThanOrEqual(2);
  await expect(page.getByRole('heading', { name: "This page didn't load" })).toBeVisible();
});

for (const [label, connection] of [
  ['data saver', { saveData: true }],
  ['2G', { effectiveType: '2g' }],
] as const) {
  test(`idle preload: skipped on ${label}, and a tap still opens the quiz`, async ({ page }) => {
    await page.addInitScript((value) => {
      Object.defineProperty(window.navigator, 'connection', { configurable: true, value });
    }, connection);
    let hits = 0;
    page.on('request', (r) => {
      if (r.url().includes('/src/components/ClassFinderModal.tsx')) hits += 1;
    });
    await openHome(page);
    // Past the idle callback's 4s timeout.
    await page.waitForTimeout(4500);
    expect(hits).toBe(0);
    await heroLink(page).click();
    await expect(classFinder(page).getByText('Question 1 of 3')).toBeVisible();
    expect(hits).toBeGreaterThan(0);
  });
}

test.describe('768px wide', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('no sideways overflow on the page or in the sheet', async ({ page }) => {
    await openHome(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
    // Hero pills side by side.
    const book = (await page.locator('#home').getByRole('button', { name: 'Book a trial class' }).boundingBox())!;
    const link = (await heroLink(page).boundingBox())!;
    expect(Math.abs(book.y - link.y)).toBeLessThanOrEqual(1);

    await heroLink(page).click();
    const finder = classFinder(page);
    const noOverflow = async (label: string) => {
      const { doc, sheet } = await finder.evaluate((el) => ({
        doc: document.documentElement.scrollWidth,
        sheet: el.scrollWidth - el.clientWidth,
      }));
      expect(doc, `${label}: page`).toBeLessThanOrEqual(768);
      expect(sheet, `${label}: sheet`).toBeLessThanOrEqual(0);
    };
    await expect(finder.getByText('Question 1 of 3')).toBeVisible();
    await noOverflow('q1');
    await toIntro(finder, 'unsure', 'new', 'in_person');
    await noOverflow('intro');
    await addDetails(finder, { age: '34', medication: 'W'.repeat(120) });
    await noOverflow('result with details');
  });
});

/** Replaces window.visualViewport: Playwright has no on-screen keyboard, so the test plays its part. */
const fakeViewport = () => {
  const fake = new EventTarget();
  let height: number | null = null;
  let offsetTop = 0;
  let scale = 1;
  Object.defineProperties(fake, {
    height: { get: () => height ?? window.innerHeight },
    offsetTop: { get: () => offsetTop },
    scale: { get: () => scale },
  });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
  (window as any).__keyboard = (h: number | null, top = 0, zoom = 1) => {
    height = h;
    offsetTop = top;
    scale = zoom;
    fake.dispatchEvent(new Event('resize'));
  };
};
const setKeyboard = (page: Page, height: number | null, top = 0, zoom = 1) =>
  page.evaluate(([h, t, z]) => (window as any).__keyboard(h, t, z), [height, top, zoom] as const);
const overlayBottom = (sheet: Locator) =>
  sheet.evaluate((el) => Math.round(el.closest('.fixed')!.getBoundingClientRect().bottom));
const sheetBox = (sheet: Locator) =>
  sheet.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });

test.describe('on-screen keyboard, 375x812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('the finder stays above it, scrolls inside it, and keeps the field and its error in view', async ({ page }) => {
    await page.addInitScript(fakeViewport);
    await openHome(page);
    await heroLink(page).tap();
    const finder = classFinder(page);
    await toIntro(finder, 'relax', 'new', 'online');
    await finder.getByRole('button', { name: 'Add details' }).click();
    await heading(finder, 'Your age and height').waitFor();
    await settled(finder);
    await expect.poll(() => overlayBottom(finder)).toBe(812);

    // Keyboard up: the overlay's bottom is the keyboard's top, and the sheet fits above it.
    await setKeyboard(page, 476);
    await expect.poll(() => overlayBottom(finder)).toBe(476);
    let box = await sheetBox(finder);
    expect(box.bottom).toBeLessThanOrEqual(477);
    expect(box.height).toBeLessThanOrEqual(Math.round(476 * 0.92) + 1);
    for (const name of ['Next', 'Skip', 'Back']) {
      const control = finder.getByRole('button', { name, exact: true });
      await control.scrollIntoViewIfNeeded();
      const b = (await control.boundingBox())!;
      expect(b.y + b.height, `${name} above the keyboard`).toBeLessThanOrEqual(477);
      expect(b.y, `${name} inside the sheet`).toBeGreaterThanOrEqual(box.top - 1);
    }

    // The browser pans the page as well: the lift takes that off.
    await setKeyboard(page, 476, 100);
    await expect.poll(() => overlayBottom(finder)).toBe(576);
    await setKeyboard(page, 476);

    // A small space: on focus the field and its error are scrolled into the sheet's view.
    await setKeyboard(page, 300);
    await expect.poll(async () => (await sheetBox(finder)).height).toBeLessThanOrEqual(Math.round(300 * 0.92) + 1);
    await finder.getByLabel('Height (cm)').fill('1');
    await finder.getByRole('button', { name: 'Next', exact: true }).click();
    const height = finder.getByLabel('Height (cm)');
    const error = finder.getByText('Please enter your height in cm, or leave it blank.');
    await expect(height).toBeFocused();
    await height.blur();
    await finder.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await height.focus();
    box = await sheetBox(finder);
    for (const [name, target] of [['field', height], ['error', error]] as const) {
      await expect
        .poll(async () => {
          const b = (await target.boundingBox())!;
          return b.y >= box.top - 1 && b.y + b.height <= box.bottom + 1;
        }, { message: `${name} in view` })
        .toBe(true);
    }

    // A pinch zoom also shrinks the viewport, but isn't a keyboard.
    await setKeyboard(page, 300, 0, 2);
    await expect.poll(() => overlayBottom(finder)).toBe(812);

    // Keyboard down, and everything is back.
    await setKeyboard(page, null);
    await expect.poll(() => overlayBottom(finder)).toBe(812);
    await page.keyboard.press('Escape');
    await expect(finder).toHaveCount(0);
  });

  test('Booking and Contact ignore it: no lift and no inline cap', async ({ page }) => {
    await page.addInitScript(fakeViewport);
    await openHome(page);
    await setKeyboard(page, 476);
    await page.locator('#home').getByRole('button', { name: 'Book a trial class' }).tap();
    const booking = bookingModal(page);
    await expect(booking.getByText('Step 1 of 2')).toBeVisible();
    await setKeyboard(page, 300);
    await page.waitForTimeout(100);
    expect(await overlayBottom(booking)).toBe(812);
    expect(await booking.evaluate((el) => (el as HTMLElement).style.maxHeight)).toBe('');
    await page.keyboard.press('Escape');
    await expect(booking).toHaveCount(0);

    await page.locator('#contact').getByRole('button', { name: 'Contact Priyanshi' }).click();
    const contact = page.getByRole('dialog', { name: 'Send a message' });
    await expect(contact).toBeVisible();
    await setKeyboard(page, 476);
    await page.waitForTimeout(100);
    expect(await overlayBottom(contact)).toBe(812);
    expect(await contact.evaluate((el) => (el as HTMLElement).style.maxHeight)).toBe('');
  });

  test('without visualViewport nothing changes and nothing breaks', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined }));
    await openHome(page);
    await heroLink(page).tap();
    const finder = classFinder(page);
    await toIntro(finder, 'relax', 'new', 'online');
    await finder.getByRole('button', { name: 'Add details' }).click();
    await finder.getByLabel('Age').focus();
    await settled(finder);
    expect(await overlayBottom(finder)).toBe(812);
    expect(await finder.evaluate((el) => (el as HTMLElement).style.maxHeight)).toBe('');
  });
});

test('on-screen keyboard: no effect on a wide screen', async ({ page }) => {
  await page.addInitScript(fakeViewport);
  await openFinder(page);
  const finder = classFinder(page);
  await setKeyboard(page, 300);
  await page.waitForTimeout(100);
  expect(await overlayBottom(finder)).toBe(page.viewportSize()!.height);
  expect(await finder.evaluate((el) => (el as HTMLElement).style.maxHeight)).toBe('');
});

for (const height of [812, 400]) {
  test.describe(`details on a phone at 375x${height}`, () => {
    test.use({ viewport: { width: 375, height }, isMobile: true, hasTouch: true });

    test('16px fields, 44px controls, every control reachable, no sideways overflow', async ({ page }) => {
      await openHome(page);
      if (height === 812) {
        // The hero's two buttons stack and stay on screen, Book first.
        const book = (await page.locator('#home').getByRole('button', { name: 'Book a trial class' }).boundingBox())!;
        const link = (await heroLink(page).boundingBox())!;
        expect(link.y).toBeGreaterThanOrEqual(book.y + book.height);
        expect(link.y + link.height).toBeLessThanOrEqual(812);
        // One shared, capped width.
        expect(link.width).toBe(book.width);
        expect(link.width).toBeLessThanOrEqual(280);
      }
      await heroLink(page).tap();
      const finder = classFinder(page);
      await expect(finder.getByText('Question 1 of 3')).toBeVisible();

      const check = async (label: string) => {
        const { doc, sheet } = await finder.evaluate((el) => ({
          doc: document.documentElement.scrollWidth,
          sheet: el.scrollWidth - el.clientWidth,
        }));
        expect(doc, `${label}: page width`).toBeLessThanOrEqual(375);
        expect(sheet, `${label}: sheet width`).toBeLessThanOrEqual(0);
        for (const c of await finder.locator('button, a, input, textarea').all()) {
          await c.scrollIntoViewIfNeeded();
          const b = (await c.boundingBox())!;
          const name = `${label}: ${(await c.textContent()) || (await c.getAttribute('aria-label')) || 'field'}`;
          expect(b.height, name).toBeGreaterThanOrEqual(44);
          expect(b.width, `${name} width`).toBeGreaterThanOrEqual(44);
          expect(b.y, `${name} top on screen`).toBeGreaterThanOrEqual(0);
          expect(b.y + b.height, `${name} bottom on screen`).toBeLessThanOrEqual(height + 1);
        }
        for (const f of await finder.locator('input, textarea').all()) {
          expect(await f.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), `${label}: 16px`).toBe(16);
        }
      };

      await finder.getByRole('button', { name: GOAL.back, exact: true }).tap();
      await finder.getByRole('button', { name: EXPERIENCE.new, exact: true }).tap();
      await finder.getByRole('button', { name: FORMAT.in_person, exact: true }).tap();
      await heading(finder, 'A few details for Priyanshi').waitFor();
      await check('intro');
      await finder.getByRole('button', { name: 'Add details' }).tap();
      await heading(finder, 'Your age and height').waitFor();
      await check('age');
      await finder.getByLabel('Age').fill('34');
      await finder.getByLabel('Height (cm)').fill('1');
      await finder.getByRole('button', { name: 'Next', exact: true }).tap();
      await expect(finder.getByText('Please enter your height in cm, or leave it blank.')).toBeVisible();
      await check('age with an error');
      await finder.getByLabel('Height (cm)').fill('165');
      await finder.getByRole('button', { name: 'Next', exact: true }).tap();
      await heading(finder, 'Any health conditions?').waitFor();
      await check('conditions');
      await finder.getByRole('textbox').fill('A long unbroken note '.repeat(5));
      await finder.getByRole('button', { name: 'Next', exact: true }).tap();
      await heading(finder, 'Any medication, now or in the past?').waitFor();
      await finder.getByRole('textbox').fill('W'.repeat(120));
      await finder.getByRole('button', { name: 'Next', exact: true }).tap();
      await heading(finder, 'Any injury, surgery or pain?').waitFor();
      await check('injury');
      await finder.getByRole('button', { name: 'See my suggestion' }).tap();
      await expect(panelOf(finder)).toBeVisible();
      await check('result');
    });
  });
}
