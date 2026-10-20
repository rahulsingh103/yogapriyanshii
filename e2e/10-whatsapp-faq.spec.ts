import type { Locator, Page } from '@playwright/test';
import { test, expect, stepShooter, openHome, bookingModal, uniqueEmail } from './helpers';

const FEATURE = 'whatsapp-faq';
// Any number (the dev placeholder or the real one) as long as it's a well-formed wa.me chat link.
// Production builds hide every WhatsApp link until the real number is set (src/constants/contact.ts).
const WA_LINK = /^https:\/\/wa\.me\/\d{8,15}\?text=/;
const PREFILL = "Hi Priyanshi, I found you on yogapriyanshi.com and I'd like to know more about your classes.";

const chat = (page: Page) => page.getByTestId('whatsapp-chat');
const chatButton = (page: Page) => page.getByRole('link', { name: 'Chat with Priyanshi on WhatsApp' });
// FAQ answers aren't region landmarks; each is found by its id, which the question's aria-controls names.
const answers = (faq: Locator) => faq.locator('[id^="faq-a-"]');
const answer = (faq: Locator, id: string) => faq.locator(`#faq-a-${id}`);
const prefillOf = async (link: Locator) => {
  const href = (await link.getAttribute('href'))!;
  expect(href, 'wa.me link').toMatch(WA_LINK);
  return new URL(href).searchParams.get('text');
};

test('FAQ: answers open and close, several at once, none open at first', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const faq = page.locator('#faq');
  await faq.scrollIntoViewIfNeeded();
  await expect(faq.getByRole('heading', { level: 2 })).toHaveText('Questions, answered');
  const questions = faq.getByRole('heading', { level: 3 }).getByRole('button');
  await expect(questions).toHaveCount(9);
  for (const q of await questions.all()) await expect(q).toHaveAttribute('aria-expanded', 'false');
  await expect(answers(faq)).toHaveCount(0);
  await expect(faq.getByRole('region')).toHaveCount(0);
  await shot('faq-closed');

  const free = faq.getByRole('button', { name: 'Is the first class really free?' });
  const price = faq.getByRole('button', { name: 'How much do classes cost?' });
  await free.click();
  await expect(free).toHaveAttribute('aria-expanded', 'true');
  const freeAnswer = answer(faq, 'free-class');
  await expect(freeAnswer).toContainText('one free class per person');
  await expect(free).toHaveAttribute('aria-controls', (await freeAnswer.getAttribute('id'))!);

  // A second one opens alongside the first.
  await price.click();
  await expect(answers(faq)).toHaveCount(2);
  await expect(answer(faq, 'pricing')).toContainText('A 20-class pack is AED 5,600');
  // Open answers don't add landmarks.
  await expect(faq.getByRole('region')).toHaveCount(0);
  await shot('faq-two-open');

  // Keyboard: Enter toggles.
  await free.focus();
  await page.keyboard.press('Enter');
  await expect(free).toHaveAttribute('aria-expanded', 'false');
  await expect(freeAnswer).toHaveCount(0);
  await expect(answers(faq)).toHaveCount(1);

  // Wide rows give the soft press (0.99).
  await price.hover();
  await page.mouse.down();
  await expect.poll(() => price.evaluate((el) => getComputedStyle(el).scale)).toBe('0.99');
  await page.mouse.up();
});

test('FAQ JSON-LD is in the first HTML response and matches the visible questions', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  const match = html.match(/<script type="application\/ld\+json" id="faq-jsonld">([\s\S]*?)<\/script>/);
  expect(match, 'FAQPage JSON-LD in the served HTML').toBeTruthy();
  const raw = match![1];
  expect(raw).not.toContain('<');
  const data = JSON.parse(raw);
  expect(data['@type']).toBe('FAQPage');
  expect(data.mainEntity).toHaveLength(9);

  await openHome(page);
  const visible = await page.locator('#faq h3 button').allInnerTexts();
  expect(data.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible.map((t) => t.trim()));
  // The FAQ never promises things that aren't built or confirmed.
  expect(raw).not.toMatch(/whatsapp|zoom|\bmats?\b|props|priority|recording|share/i);
});

test('the floating WhatsApp button opens a chat with Priyanshi in one tap', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const button = chatButton(page);
  await expect(button).toBeVisible();
  // A direct link: no pop-up in between.
  expect(await prefillOf(button)).toBe(PREFILL);
  await expect(button).toHaveAttribute('target', '_blank');
  await expect(button).toHaveAttribute('rel', /noopener/);
  await expect(button).toHaveAttribute('rel', /noreferrer/);
  // WhatsApp green with a white glyph, 56px.
  const look = await button.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color, w: (el as HTMLElement).offsetWidth };
  });
  expect(look.bg).toBe('rgb(37, 211, 102)');
  expect(look.color).toBe('rgb(255, 255, 255)');
  expect(look.w).toBe(56);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await shot('button-on-hero');
});

test('WhatsApp button hides while any modal is open', async ({ page }) => {
  await openHome(page);
  await expect(chat(page)).toBeVisible();

  // Booking
  await page.locator('header').getByRole('button', { name: 'Book Free Class' }).click();
  await expect(bookingModal(page)).toBeVisible();
  await expect(chat(page)).toHaveCount(0);
  await bookingModal(page).getByLabel('Close modal').click();
  await expect(bookingModal(page)).toHaveCount(0);
  await expect(chat(page)).toBeVisible();

  // Cancel (Manage booking), Admin, and Contact
  const modals: Array<[() => Promise<void>, string]> = [
    [() => page.locator('footer').getByRole('button', { name: 'Manage booking' }).click(), 'Manage Reservation'],
    [() => page.locator('footer').getByRole('button', { name: 'Studio admin' }).click(), 'Instructor Portal'],
    [() => page.locator('#contact').getByRole('button', { name: 'Contact Priyanshi' }).click(), 'Send a message'],
  ];
  for (const [open, text] of modals) {
    await open();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: text });
    await expect(modal).toBeVisible();
    await expect(chat(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    // Back at the top, away from Contact (which hides the button on its own), it returns.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(chat(page)).toBeVisible();
  }
});

test('WhatsApp button hides offline, leaving the offline pill on its own', async ({ page, context }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await expect(chat(page)).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByTestId('offline-notice')).toContainText("You're offline");
  await expect(chat(page)).toHaveCount(0);
  await shot('offline');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(chat(page)).toBeVisible();
});

test('Contact has a secondary WhatsApp link next to the contact button', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const contact = page.locator('#contact');
  await contact.scrollIntoViewIfNeeded();
  await expect(contact.getByRole('button', { name: 'Contact Priyanshi' })).toBeVisible();
  const link = contact.getByRole('link', { name: 'Chat on WhatsApp' });
  await expect(link).toBeVisible();
  expect(await prefillOf(link)).toBe(PREFILL);
  await expect(link).toHaveAttribute('target', '_blank');
  await shot('contact');
});

test('booking confirmation offers WhatsApp with the class and time, never the token or email', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('wa');
  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Book Free Class' }).click();
  const modal = bookingModal(page);
  await expect(modal.locator('select option').first()).toBeAttached();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('WhatsApp Student');
  await modal.getByPlaceholder('layla@example.com').fill(email);
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  const token = await modal.getByTestId('booking-token').innerText();

  const link = modal.getByRole('link', { name: 'Questions? Chat on WhatsApp' });
  await expect(link).toBeVisible();
  const text = (await prefillOf(link))!;
  const title = await modal.locator('dt', { hasText: /^Class$/ }).locator('xpath=following-sibling::dd').innerText();
  const when = await modal.locator('dt', { hasText: /^Date & Time$/ }).locator('xpath=following-sibling::dd').innerText();
  expect(text).toContain(title);
  expect(text).toContain(when);
  const href = (await link.getAttribute('href'))!;
  for (const secret of [token, email, encodeURIComponent(email)]) expect(href).not.toContain(secret);
  await shot('confirmation');
});

test('reduced motion: answers appear without movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  await expect(chatButton(page)).toBeVisible();

  const faq = page.locator('#faq');
  await faq.scrollIntoViewIfNeeded();
  await faq.getByRole('button', { name: 'When are classes?' }).click();
  const when = answer(faq, 'when');
  await expect(when).toContainText('Friday, which is a rest day');
  // duration 0: already at full height, no spring in progress.
  const { height, full } = await when.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    full: el.firstElementChild!.getBoundingClientRect().height,
  }));
  expect(Math.abs(height - full)).toBeLessThan(1);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('the button sits above the sticky bar and hides behind the menu', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    const button = chatButton(page);
    await expect(button).toBeVisible();
    await shot('hero');

    await page.mouse.wheel(0, 1200);
    const bar = page.getByLabel('Quick booking bar');
    await expect(bar).toBeVisible();
    await expect.poll(async () => {
      const b = (await button.boundingBox())!;
      const s = (await bar.boundingBox())!;
      return s.y - (b.y + b.height);
    }).toBeGreaterThanOrEqual(8);
    const box = (await button.boundingBox())!;
    expect(box.width).toBe(56);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await shot('sticky-bar');

    // The bar's button still takes a tap.
    await bar.getByRole('button', { name: 'Book a free class' }).click();
    await expect(bookingModal(page)).toBeVisible();
    await expect(chat(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(bookingModal(page)).toHaveCount(0);
    await expect(chat(page)).toBeVisible();

    await page.getByLabel('Toggle Navigation Menu').click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await expect(chat(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
    await expect(chat(page)).toBeVisible();

    // Contact has its own WhatsApp pill, so the floating button steps aside while it's on screen.
    const contact = page.locator('#contact');
    await contact.scrollIntoViewIfNeeded();
    await expect(contact.getByRole('link', { name: 'Chat on WhatsApp' })).toBeVisible();
    await expect(chat(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Chat on WhatsApp' })).toHaveCount(1);
    await shot('contact-no-button');
  });
});
