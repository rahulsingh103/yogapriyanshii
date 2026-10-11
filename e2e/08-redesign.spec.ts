import { test, expect, stepShooter, openHome, bookingModal } from './helpers';

const FEATURE = 'redesign';

const CLASS_ORDER = [
  'Hatha',
  'Barre',
  'Wheel',
  'Chakra Flow',
  'Spine Healing',
  'Mobility Yoga',
  'Yin Yoga',
  'Prenatal & Postnatal',
];

test('the carousel has the 8 classes in order, labelled arrows and a keyboard-scrollable track', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  await expect(classes.getByRole('heading', { level: 2 })).toHaveText('Choose your practice');

  const cards = classes.getByTestId('practice-card');
  await expect(cards).toHaveCount(8);
  await expect(cards.locator('h3')).toHaveText(CLASS_ORDER);
  await shot('carousel');

  const prev = classes.getByRole('button', { name: 'Previous classes' });
  const next = classes.getByRole('button', { name: 'Next classes' });
  await expect(prev).toBeVisible();
  await expect(next).toBeVisible();

  const track = classes.getByRole('group', { name: /Classes/ });
  const scrollLeft = () => track.evaluate((el) => el.scrollLeft);
  await next.click();
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  await shot('after-next');

  await track.evaluate((el) => el.scrollTo({ left: 0 }));
  await expect.poll(scrollLeft).toBe(0);
  await track.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(scrollLeft).toBeGreaterThan(0);
});

test('the Hatha card opens booking with the soonest Hatha session preselected', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const { sessions } = await (await page.request.get('/api/schedule')).json();
  const soonestHatha = sessions
    .filter((s: any) => !s.isRestDay && s.status === 'available' && s.style === 'hatha')
    .sort((a: any, b: any) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc))[0];
  expect(soonestHatha, 'an available Hatha session exists').toBeTruthy();

  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  await classes.getByRole('button', { name: /^Hatha/ }).click();
  const modal = bookingModal(page);
  await expect(modal.locator('select')).toHaveValue(soonestHatha.id);
  await expect(modal.locator('select option:checked')).toContainText('Hatha');
  await shot('hatha-preselected');
});

test('the Yin Yoga card brings Contact into view', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  await classes.getByRole('button', { name: /^Yin Yoga/ }).click();
  await expect(page.locator('#contact')).toBeInViewport();
  await expect(bookingModal(page)).toHaveCount(0);
  await shot('contact-in-view');
});

test('a header nav link lands the section just below the header', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  // The web fonts swap in shortly after load and shift the layout; wait so the click's target is final.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.locator('header nav[aria-label="Main"]').getByRole('link', { name: 'Contact', exact: true }).click();
  const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));
  expect(padding).toBeGreaterThan(0);
  const contactTop = () => page.locator('#contact').evaluate((el) => el.getBoundingClientRect().top);
  // Wait for the smooth scroll to finish, then check the landing position.
  await expect.poll(async () => Math.abs((await contactTop()) - padding), { timeout: 10_000 }).toBeLessThanOrEqual(6);
  await shot('contact-landing');
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the page renders with the mandala canvas and no console errors', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Connect with your body');
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas.locator('xpath=ancestor::*[@aria-hidden="true"][1]')).toHaveCount(1);
    // the static mandala is actually drawn (some non-transparent pixels)
    const drawn = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d');
      if (!ctx || !el.width) return false;
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    });
    expect(drawn, 'mandala drawn').toBe(true);
    await shot('reduced-motion');
  });
});

test.describe('mobile menu', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('opens, closes on Escape, a link closes it and scrolls, Manage booking opens the cancel modal', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    const toggle = page.getByLabel('Toggle Navigation Menu');
    const menu = page.getByRole('dialog', { name: 'Menu' });

    await toggle.click();
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await shot('menu-open');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(toggle).toBeFocused();

    await toggle.click();
    await menu.getByRole('link', { name: 'Schedule', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('#schedule')).toBeInViewport();
    await shot('schedule-after-link');

    await toggle.click();
    await menu.getByRole('button', { name: 'Manage booking', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('div.fixed.inset-0').filter({ hasText: 'Manage Reservation' })).toBeVisible();
    await shot('cancel-modal');
  });

  test('keeps keyboard focus inside the open menu and makes the page behind inert', async ({ page }) => {
    await openHome(page);
    const toggle = page.getByLabel('Toggle Navigation Menu');
    await expect(toggle).not.toHaveAttribute('aria-controls');
    await toggle.click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-controls', 'mobile-menu');
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await expect(page.locator('footer')).toHaveAttribute('inert', '');

    const focusInMenu = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        const toggleEl = document.querySelector('[aria-label="Toggle Navigation Menu"]');
        return el === toggleEl || !!document.getElementById('mobile-menu')?.contains(el);
      });
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInMenu(), `focus after Tab ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInMenu(), `focus after Shift+Tab ${i + 1}`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(page.locator('main')).not.toHaveAttribute('inert');
    await expect(page.locator('footer')).not.toHaveAttribute('inert');
    await expect(toggle).not.toHaveAttribute('aria-controls');
  });
});
