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
    ['about', "Hi, I'm Priyanshi."],
    ['schedule', 'Weekly schedule'],
    ['contact', 'Get in touch'],
  ] as const) {
    const section = page.locator(`#${id}`);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(heading);
    await shot(`section-${id}`);
  }

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

test('a bookable carousel card opens booking with that style preselected', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const classes = page.locator('#classes');
  await classes.scrollIntoViewIfNeeded();
  await classes.getByRole('button', { name: /^Barre/ }).click();
  const modal = bookingModal(page);
  await expect(modal.locator('select')).toBeVisible();
  await expect(modal.locator('select option:checked')).toContainText('Barre');
  await shot('barre-preselected');
});

test('pricing cards open booking with the matching package selected', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await shot('pricing');

  await page.locator('#pricing').getByRole('button', { name: /^Book First class\b.*Free/ }).click();
  const modal = bookingModal(page);
  await expect(modal.getByText('Complimentary introductory class')).toBeVisible();
  await shot('free-plan-modal');
  await modal.getByLabel('Close modal').click();

  await page.locator('#pricing').getByRole('button', { name: /^Book Single class\b.*AED 350/ }).click();
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

test('shared links get a preview card (Open Graph image, title and description)', async ({ page, request }) => {
  await openHome(page);
  const meta = (sel: string) => page.locator(sel).getAttribute('content');
  expect(await meta('meta[property="og:title"]')).toContain('YogaPriyanshi');
  expect(await meta('meta[property="og:description"]')).toBeTruthy();
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  const image = await meta('meta[property="og:image"]');
  expect(image).toBe('https://www.yogapriyanshi.com/og-image.jpg?v=3');
  expect(await meta('meta[property="og:image:width"]')).toBe('1200');
  expect(await meta('meta[property="og:image:height"]')).toBe('630');
  // The file itself ships with the site.
  const res = await request.get('/og-image.jpg');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/jpeg');
});
