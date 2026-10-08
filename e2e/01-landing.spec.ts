import { test, expect, stepShooter, openHome, bookingModal } from './helpers';

const FEATURE = 'landing';

test('landing page renders every section with working images', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const brokenImages: string[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() === 'image' && r.status() >= 400) brokenImages.push(r.url());
  });

  await openHome(page);
  await expect(page).toHaveTitle(/YogaPriyanshi/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Connect with your body');
  await shot('hero');

  for (const [id, heading] of [
    ['classes', 'Choose your practice'],
    ['about', "Hello, I'm Priyanshi."],
    ['schedule', 'Weekly schedule'],
    ['contact', 'Get in touch'],
  ] as const) {
    const section = page.locator(`#${id}`);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(heading);
    await shot(`section-${id}`);
  }
  await expect(page.getByRole('heading', { name: 'Four paths to stillness' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Voices from the mat' })).toBeVisible();

  // every <img> actually decoded
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState('networkidle');
  const undecoded = await page.$$eval('img', (imgs) =>
    imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute('src'))
  );
  expect(undecoded, 'images that failed to load').toEqual([]);
  expect(brokenImages).toEqual([]);
  await shot('footer');
  await shot('full-page', { fullPage: true });
});

test('header navigation jumps to each section', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const nav = page.locator('header nav');
  for (const name of ['Classes', 'Schedule', 'About', 'Contact']) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.locator(`#${name.toLowerCase()}`)).toBeInViewport();
    await shot(`nav-${name}`);
  }
});

test('sticky book bar appears after scrolling and opens booking', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const bar = page.getByLabel('Quick booking bar');
  await expect(bar).toHaveCount(0);
  await page.mouse.wheel(0, 1200);
  await expect(bar).toBeVisible();
  await shot('sticky-bar-visible');
  await bar.getByRole('button', { name: 'Book Now' }).click();
  await expect(bookingModal(page).getByText('Select practice')).toBeVisible();
  await shot('booking-opened');
});

test('"Book This Style" scrolls to the schedule', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: 'Book This Style' }).first().click();
  await expect(page.locator('#schedule')).toBeInViewport();
  await shot('schedule-in-view');
});

test('pricing cards open booking with the matching package selected', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.locator('#classes').scrollIntoViewIfNeeded();
  await shot('pricing');

  await page.locator('#classes').getByRole('button', { name: 'Claim Free Class' }).click();
  const modal = bookingModal(page);
  await expect(modal.getByText('Complimentary introductory class')).toBeVisible();
  await shot('free-plan-modal');
  await modal.getByLabel('Close modal').click();

  await page.locator('#classes').getByRole('button', { name: 'Get Started' }).first().click();
  await expect(modal.getByText('Flexible studio credits')).toBeVisible();
  await shot('paid-plan-modal');
});

test('schedule week tabs, session selection and "Book This Class"', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const schedule = page.locator('#schedule');
  await schedule.scrollIntoViewIfNeeded();
  await expect(schedule.getByText('Retrieving live studio availability...')).toHaveCount(0);
  await expect(schedule.getByText('Rest Day')).toBeVisible();
  await shot('this-week');

  await schedule.getByRole('button', { name: 'Next Week' }).click();
  await shot('next-week');
  await schedule.getByRole('button', { name: 'Week 3' }).click();
  await shot('week-3');

  // pick a card with open spots and book it
  const card = schedule.getByText(/\d+ spots left/).first().locator('xpath=ancestor::*[contains(@class,"cursor-pointer") or @role="button" or self::button][1]');
  const target = (await card.count()) ? card : schedule.getByText(/\d+ spots left/).first();
  await target.click();
  const bookBtn = schedule.getByRole('button', { name: /Book This Class \(\d+ Left\)/ });
  await expect(bookBtn).toBeVisible();
  const detailTitle = await schedule.locator('h3').first().innerText();
  await shot('session-selected');

  await bookBtn.click();
  const modal = bookingModal(page);
  await expect(modal.locator('select')).toBeVisible();
  await expect(modal.locator('select option:checked')).toContainText(detailTitle);
  await shot('booking-preselected');
});
