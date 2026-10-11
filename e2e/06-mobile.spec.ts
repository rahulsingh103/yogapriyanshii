import { test, expect, stepShooter, openHome, bookingModal, uniqueEmail } from './helpers';

const FEATURE = 'mobile';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('mobile layout has no horizontal scroll and menu works', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await shot('hero');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);

  await page.getByLabel('Toggle Navigation Menu').click();
  await expect(page.getByRole('link', { name: 'Classes & Pricing' })).toBeVisible();
  await shot('menu-open');
  await page.getByRole('link', { name: 'Contact & Location' }).click();
  await expect(page.getByRole('link', { name: 'Classes & Pricing' })).toHaveCount(0);
  await expect(page.locator('#contact')).toBeInViewport();
  await shot('contact');

  await page.getByLabel('Toggle Navigation Menu').click();
  await page.getByRole('button', { name: 'Studio Admin Portal', exact: true }).click();
  await expect(page.getByText('Instructor Portal')).toBeVisible();
  await shot('admin-from-menu');
});

test('mobile free booking end to end', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: /Book Free First Class/ }).click();
  const modal = bookingModal(page);
  await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  await shot('step1');
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Mobile Student');
  await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('mobile'));
  await shot('step2');
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  await shot('confirmed');
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the booking reference fits on the confirmation card', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    await page.getByRole('button', { name: /Book Free First Class/ }).click();
    const modal = bookingModal(page);
    await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
    await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Narrow Student');
    await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('narrow'));
    await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
    await expect(modal.getByText("You're on the mat.")).toBeVisible();

    const card = modal.getByTestId('booking-reference-card');
    await expect(card.getByTestId('booking-token')).toBeVisible();
    const { scrollWidth, clientWidth } = await card.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scrollWidth, 'confirmation card horizontal overflow').toBeLessThanOrEqual(clientWidth);

    const copy = card.getByRole('button', { name: 'Copy booking reference' });
    const box = await copy.boundingBox();
    expect(box && box.width >= 44 && box.height >= 44, 'copy button is a 44px tap target').toBe(true);
    await shot('confirmed-375');
  });
});
