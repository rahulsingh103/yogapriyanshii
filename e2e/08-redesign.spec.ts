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

test('the Yin Yoga card opens the contact pop-up with Yin Yoga as the interest', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  await classes.getByRole('button', { name: /^Yin Yoga/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Send a message' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Area of Interest')).toHaveValue('Yin Yoga');
  await expect(bookingModal(page)).toHaveCount(0);
  await shot('contact-yin');

  // reopening from the Contact section goes back to the general interest
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.locator('#contact').getByRole('button', { name: 'Contact Priyanshi' }).click();
  await expect(dialog.getByLabel('Area of Interest')).toHaveValue('General enquiry');
});

test('a header nav link lands the section just below the header', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  // No document.fonts.ready wait: the fonts are preloaded and their fallbacks are metric-matched,
  // so the font swap doesn't move the target. Schedule is the target because everything above it
  // is static (Contact sits too close to the end of the page to reach the top at this height).
  await page.locator('header nav[aria-label="Main"]').getByRole('link', { name: 'Schedule', exact: true }).click();
  const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));
  expect(padding).toBeGreaterThan(0);
  const sectionTop = () => page.locator('#schedule').evaluate((el) => el.getBoundingClientRect().top);
  // Wait for the smooth scroll to finish, then check the landing position.
  await expect.poll(async () => Math.abs((await sectionTop()) - padding), { timeout: 10_000 }).toBeLessThanOrEqual(6);
  await shot('schedule-landing');
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

  test('the header logo is inert while the menu is open, and widening past 900px closes the menu', async ({ page }) => {
    await openHome(page);
    await page.getByLabel('Toggle Navigation Menu').click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(page.locator('header a[href="#home"]')).toHaveAttribute('inert', '');

    await page.setViewportSize({ width: 1100, height: 844 });
    await expect(menu).toHaveCount(0);
    await expect(page.locator('main')).not.toHaveAttribute('inert');
    await expect(page.locator('header a[href="#home"]')).not.toHaveAttribute('inert');
    // Lenis is running again: the page scrolls.
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});

test('Escape closes the booking sheet and returns focus to the button that opened it', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const opener = page.locator('header').getByRole('button', { name: 'Book free class' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Select practice' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await shot('sheet-open');

  // Tab stays inside the sheet
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `focus after Tab ${i + 1}`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(bookingModal(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('main')).not.toHaveAttribute('inert');
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('the booking sheet sits at the bottom of the screen with no horizontal overflow', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    await page.locator('#home').getByRole('button', { name: 'Book a free class' }).click();
    const dialog = page.getByRole('dialog', { name: 'Select practice' });
    await expect(dialog.locator('select option').first()).toBeAttached();
    // let the slide-up finish
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height)).toBe(812);
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBe(375);
    const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'sheet horizontal overflow').toBeLessThanOrEqual(0);
    await shot('bottom-sheet');
  });
});

test('the Buddha preloader fades away once the site is ready', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('#home h1')).toBeVisible();
});

test('a calm notice appears while offline and clears when back online', async ({ page, context }) => {
  await openHome(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByTestId('offline-notice')).toContainText("You're offline");
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByTestId('offline-notice')).toContainText('Back online');
  await expect(page.getByTestId('offline-notice')).toHaveCount(0, { timeout: 6000 });
});
