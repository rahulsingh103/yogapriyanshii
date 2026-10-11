import { test, expect, stepShooter, openHome, apiBook } from './helpers';

const FEATURE = 'manage-booking';

const cancelModal = (page: import('@playwright/test').Page) =>
  page.locator('div.fixed.inset-0').filter({ hasText: 'Manage Reservation' });

test('look up and cancel a booking (≥6h notice refunds credit)', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  // 7h+ ahead so the cancellation is always the free (refunding) kind, whatever time the suite runs
  const { body, session } = await apiBook(page.request, { planKey: 'single' }, 7);
  const token: string = body.booking.bookingToken;
  const spotsAfterBooking = body.session.spotsLeft;

  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Manage Booking' }).click();
  const modal = cancelModal(page);
  await expect(modal).toBeVisible();
  await shot('lookup-form');

  await modal.getByPlaceholder('e.g. YP-8K2N9F').fill(token.toLowerCase());
  await modal.getByRole('button', { name: 'Find My Reservation' }).click();
  await expect(modal.getByText('E2E Student')).toBeVisible();
  await expect(modal.getByText('confirmed', { exact: true })).toBeVisible();
  await expect(modal.getByText('Eligible for Free Cancellation')).toBeVisible();
  await shot('booking-found');

  await modal.getByRole('button', { name: 'Confirm Cancellation' }).click();
  await expect(modal.getByText('Reservation Cancelled')).toBeVisible();
  await expect(modal.getByText('Refunded', { exact: true })).toBeVisible();
  await shot('cancelled');

  const { sessions } = await (await page.request.get('/api/schedule')).json();
  expect(sessions.find((s: any) => s.id === session.id).spotsLeft).toBe(spotsAfterBooking + 1);

  await modal.getByRole('button', { name: 'Done & Return to Studio' }).click();
  await page.locator('#schedule').getByRole('button', { name: 'Cancel / Manage Reservation' }).click();
  await modal.getByPlaceholder('e.g. YP-8K2N9F').fill(token);
  await modal.getByRole('button', { name: 'Find My Reservation' }).click();
  await expect(modal.getByText('This reservation has already been cancelled.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Confirm Cancellation' })).toHaveCount(0);
  await shot('already-cancelled');

  const again = await page.request.post('/api/bookings/cancel', { data: { bookingToken: token } });
  expect(again.status()).toBe(400);
});

test('unknown token shows a clear error', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: 'Manage / Cancel Reservation →' }).click();
  const modal = cancelModal(page);
  await modal.getByPlaceholder('e.g. YP-8K2N9F').fill('YP-000000');
  await modal.getByRole('button', { name: 'Find My Reservation' }).click();
  await expect(modal.getByText(/No (booking|reservation) found/)).toBeVisible();
  await shot('not-found');

  await modal.getByRole('button').first().click(); // close (X)
  await expect(modal).toHaveCount(0);
});
