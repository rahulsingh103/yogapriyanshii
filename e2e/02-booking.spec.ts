import { test, expect, stepShooter, openHome, bookingModal, uniqueEmail, apiBook } from './helpers';

const FEATURE = 'booking';

async function openBooking(page: import('@playwright/test').Page) {
  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Book Free Class' }).click();
  const modal = bookingModal(page);
  await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  await expect(modal.locator('select option').first()).toBeAttached();
  return modal;
}

test('free first class: full happy path with validation', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('free');
  const modal = await openBooking(page);
  await shot('step1-package-and-slot');

  await modal.getByRole('button', { name: 'Online Live Stream' }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await expect(modal.getByText('Step 2 of 2')).toBeVisible();
  await shot('step2-details');

  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText('Please provide your name and email address.')).toBeVisible();
  await shot('validation-empty');

  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Test Student');
  await modal.getByPlaceholder('layla@example.com').fill('not-an-email');
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText('Please enter a valid email address.')).toBeVisible();
  await shot('validation-bad-email');

  await modal.getByPlaceholder('layla@example.com').fill(email);
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  const token = await modal.locator('span.font-mono.text-2xl').innerText();
  expect(token).toMatch(/^YP-[0-9A-HJKMNP-TV-Z]{16}$/);
  await expect(modal.getByText('Online Stream')).toBeVisible();
  await expect(modal.getByText('Complimentary', { exact: true })).toBeVisible();
  await shot('confirmation');

  await modal.getByRole('button', { name: 'View Email Copy' }).click();
  await expect(modal.getByText(`Your Booking Token: ${token}`)).toBeVisible();
  await shot('email-copy');

  // booking really persisted server-side
  const lookup = await page.request.get(`/api/bookings/${token}`);
  expect(lookup.status()).toBe(200);
  expect((await lookup.json()).booking.customerEmail).toBe(email);

  await modal.getByRole('button', { name: 'Return to Studio' }).click();
  await expect(modal).toHaveCount(0);
});

test('same email cannot claim the free class twice', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('dupe');
  const first = await apiBook(page.request, { email });
  expect(first.res.status()).toBe(201);

  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Repeat Student');
  await modal.getByPlaceholder('layla@example.com').fill(email);
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText('This email has already used its free first class.', { exact: false })).toBeVisible();
  await expect(modal.getByText("You're on the mat.")).toHaveCount(0);
  await shot('duplicate-free-rejected');
});

test('paid single class, pay at studio', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /AED 350/ }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Studio Payer');
  await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('studio'));
  await expect(modal.getByText(/Settle AED 350 at BurJuman/)).toBeVisible();
  await shot('pay-at-studio-selected');
  await modal.getByRole('button', { name: 'Reserve Seat (Pay at Studio)' }).click();
  await expect(modal.getByText("You're on the mat.")).toBeVisible();
  await expect(modal.getByText('AED 350 (Pay at Studio)')).toBeVisible();
  await shot('confirmation');
});

test('paid packs are reserved to pay at the studio, with no card or bank form', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  for (const [price, total, who] of [['3,000', '3000', 'pack10'], ['5,600', '5600', 'pack20']] as const) {
    const modal = await openBooking(page);
    await modal.getByRole('button', { name: new RegExp(`AED ${price}`) }).click();
    await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
    await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Studio Payer');
    await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail(who));
    // no card fields and no bank details until a real payment provider exists
    await expect(modal.getByPlaceholder('Card number')).toHaveCount(0);
    await expect(modal.getByText(/IBAN/)).toHaveCount(0);
    await shot(`${who}-pay-at-studio`);
    await modal.getByRole('button', { name: 'Reserve Seat (Pay at Studio)' }).click();
    await expect(modal.getByText("You're on the mat.")).toBeVisible();
    await expect(modal.getByText(`AED ${total} (Pay at Studio)`)).toBeVisible();
    await shot(`${who}-confirmation`);
  }
});

test('back button returns to step 1 keeping choices', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const modal = await openBooking(page);
  await modal.getByRole('button', { name: /AED 350/ }).click();
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByRole('button', { name: 'Back' }).click();
  await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  await expect(modal.getByText('Flexible studio credits')).toBeVisible();
  await shot('back-to-step1');
});

test('booking API enforces capacity, double-booking and validation rules', async ({ request }) => {
  const email = uniqueEmail('rules');
  const { res, session, body } = await apiBook(request, { email, planKey: 'single' });
  expect(res.status()).toBe(201);
  expect(body.session.spotsLeft).toBe(session.spotsLeft - 1);

  const again = await request.post('/api/bookings', {
    data: { sessionId: session.id, fullName: 'X', email, mode: 'in_person', planKey: 'single' },
  });
  expect(again.status()).toBe(400);
  const againError: string = (await again.json()).error;
  expect(againError).toContain('already booked');
  expect(againError, 'the error must not reveal the booking token').not.toContain(body.booking.bookingToken);
  expect(againError).not.toMatch(/YP-/);

  // price and payment status come from the server, whatever the browser sends
  expect(body.booking.amountAed).toBe(350);
  expect(body.booking.paymentStatus).toBe('pending_at_studio');
  const forged = await request.post('/api/bookings', {
    data: { sessionId: session.id, fullName: 'X', email: uniqueEmail('forged'), mode: 'in_person', planKey: 'pack10', paymentMethod: 'studio', amountAed: 1, paymentStatus: 'paid' },
  });
  expect(forged.status()).toBe(201);
  const forgedBody = await forged.json();
  expect(forgedBody.booking.amountAed).toBe(3000);
  expect(forgedBody.booking.paymentStatus).toBe('pending_at_studio');

  // card and bank transfer are refused by the server until real payments exist
  for (const method of ['card', 'bank_transfer']) {
    const refused = await request.post('/api/bookings', {
      data: { sessionId: session.id, fullName: 'X', email: uniqueEmail(method), mode: 'in_person', planKey: 'single', paymentMethod: method },
    });
    expect(refused.status()).toBe(400);
  }

  const bad = await request.post('/api/bookings', {
    data: { sessionId: session.id, fullName: 'X', email: 'nope', mode: 'in_person' },
  });
  expect(bad.status()).toBe(400);

  const missing = await request.post('/api/bookings', { data: { sessionId: session.id } });
  expect(missing.status()).toBe(400);

  const { sessions } = await (await request.get('/api/schedule')).json();
  const rest = sessions.find((s: any) => s.isRestDay);
  const restRes = await request.post('/api/bookings', {
    data: { sessionId: rest.id, fullName: 'X', email: uniqueEmail('rest'), mode: 'in_person', planKey: 'single' },
  });
  expect(restRes.status()).toBe(400);

  const full = sessions.find((s: any) => !s.isRestDay && s.spotsLeft === 0 && s.status !== 'past');
  if (full) {
    const fullRes = await request.post('/api/bookings', {
      data: { sessionId: full.id, fullName: 'X', email: uniqueEmail('full'), mode: 'in_person', planKey: 'single' },
    });
    expect(fullRes.status()).toBe(400);
  }
});
