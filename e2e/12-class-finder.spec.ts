import path from 'path';
import type { APIRequestContext, CDPSession, Locator, Page } from '@playwright/test';
import { test, expect, stepShooter, openHome, bookingModal, classFinder } from './helpers';

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
  flexibility: { new: ['Hatha', 'Mobility Yoga'], some: ['Barre', 'Yin Yoga'], regular: ['Wheel', 'Yin Yoga'] },
  strength: { new: ['Barre', 'Hatha'], some: ['Vinyasa', 'Barre'], regular: ['Ashtanga', 'Vinyasa'] },
  back: { new: ['Spine Healing', 'Mobility Yoga'], some: ['Spine Healing', 'Hatha'], regular: ['Spine Healing', 'Mobility Yoga'] },
  pregnancy: { new: ['Prenatal & Postnatal', null], some: ['Prenatal & Postnatal', null], regular: ['Prenatal & Postnatal', null] },
  unsure: { new: ['Hatha', 'Chakra Flow'], some: ['Hatha', 'Vinyasa'], regular: ['Vinyasa', 'Wheel'] },
};
const PRIVATE: Partial<Record<Goal, Partial<Record<Experience, [string, string]>>>> = {
  strength: { some: ['Aerial Yoga', 'Vinyasa'], regular: ['Aerial Yoga', 'Ashtanga'] },
  flexibility: { some: ['Aerial Yoga', 'Barre'], regular: ['Aerial Yoga', 'Wheel'] },
};
const BOOKABLE = ['Hatha', 'Barre', 'Wheel', 'Chakra Flow'];

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

const heroLink = (page: Page) => page.locator('#home').getByRole('button', { name: 'Take the 30-second quiz' });
const carouselLink = (page: Page) => page.locator('#classes').getByRole('button', { name: 'Take the 30-second quiz' });
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

test('hero: an underlined quiz link under "Book a free class" opens the finder, and Escape returns focus', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const hero = page.locator('#home');
  const cta = hero.getByRole('button', { name: 'Book a free class' });
  const link = heroLink(page);
  await expect(link).toBeVisible();
  // "Book a free class" is still the first (and only primary) button after the h1.
  await expect(hero.getByRole('button').first()).toHaveText(/Book a free class/);
  await expect(hero.getByRole('button')).toHaveCount(2);

  const c = (await cta.boundingBox())!;
  const l = (await link.boundingBox())!;
  expect(l.y, 'the link sits below the button').toBeGreaterThanOrEqual(c.y + c.height);
  expect(l.height).toBeLessThanOrEqual(c.height);
  expect(l.height).toBeGreaterThanOrEqual(44);
  // A text link, not a second button: no fill, no pill, underlined, no press scale.
  await expect(hero.getByText('Not sure?')).toBeVisible();
  const style = await link.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, radius: s.borderRadius, decoration: s.textDecorationLine, size: parseFloat(s.fontSize) };
  });
  expect(style.bg).toBe('rgba(0, 0, 0, 0)');
  expect(style.radius).toBe('0px');
  expect(style.decoration).toBe('underline');
  expect(style.size).toBeLessThanOrEqual(16);
  await link.hover();
  await page.mouse.down();
  expect(await link.evaluate((el) => getComputedStyle(el).scale)).toBe('none');
  await page.mouse.up();
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

test('carousel: the link sits above the track, opens the finder, and the X returns focus', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  const link = carouselLink(page);
  await expect(link).toBeVisible();
  await expect(classes.getByText('Not sure?')).toBeVisible();
  const track = classes.getByRole('group', { name: /Classes/ });
  const l = (await link.boundingBox())!;
  const t = (await track.boundingBox())!;
  expect(l.y + l.height).toBeLessThanOrEqual(t.y);
  // Not in the arrow row: the heading's row holds only the heading and the two arrows.
  const heading = classes.getByRole('heading', { level: 2 });
  const h = (await heading.boundingBox())!;
  expect(l.y).toBeGreaterThanOrEqual(h.y + h.height - 1);
  await shot('carousel-link');

  await link.click();
  const finder = classFinder(page);
  await expect(finder.getByText('Question 1 of 3')).toBeVisible();
  await finder.getByRole('button', { name: 'Close class finder' }).click();
  await expect(finder).toHaveCount(0);
  await expect(link).toBeFocused();
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
        if (goal === 'back') await expect(finder.getByText(/Wheel/)).toHaveCount(0);
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
      expect(text).not.toMatch(/free/i);
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
  // The duration only, then the contact-only line.
  await expect(finder.getByText('75 min', { exact: true })).toBeVisible();
  await expect(finder.getByText('Long, quiet holds · 75 min')).toHaveCount(0);
  await expect(
    finder.getByText('Not on the timetable. Send a message and Priyanshi will find a time with you.')
  ).toBeVisible();
  await finder.getByRole('button', { name: 'Show Chakra Flow instead' }).click();
  await expect(resultName(finder)).toHaveText('Chakra Flow');
  await expect(resultName(finder)).toBeFocused();
  ({ text } = await prefillOf(link));
  expect(text).toContain('It suggested Chakra Flow.');
  // Swapped: the main class is now the alternative, and the primary follows (Chakra Flow is bookable).
  await expect(finder.getByRole('button', { name: 'Show Yin Yoga instead' })).toBeVisible();
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

  const contact = page.getByRole('dialog', { name: 'Send a message' });
  const routes: Array<[Goal, Experience, Format, string, string]> = [
    ['relax', 'some', 'in_person', 'Ask about this class', 'Yin Yoga'],
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

test('facts guard: no Zoom, no former studio, and "free" only on a bookable group class', async ({ page }) => {
  const finder = await openFinder(page);
  for (const goal of Object.keys(GOAL) as Goal[]) {
    for (const format of Object.keys(FORMAT) as Format[]) {
      await answerAll(finder, goal, 'some', format);
      const { main } = expected(goal, 'some', format);
      const text = await finder.innerText();
      const label = `${goal}/some/${format}`;
      expect(text, label).not.toMatch(/Zoom|Lifestyle Yoga|Lifestyle|doctor|clearance|\bsafe\b|\bcure\b/i);
      if (format !== 'private' && BOOKABLE.includes(main)) expect(text, label).toContain('Your first class is free.');
      else expect(text, label).not.toMatch(/free/i);
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
    await expect.poll(() => heroLink(page).evaluate((el) => getComputedStyle(el.parentElement!).opacity)).toBe('1');
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
