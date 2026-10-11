import { test, expect, stepShooter, openHome, bookingModal, uniqueEmail, firstAvailableSession } from './helpers';
import type { APIRequestContext } from '@playwright/test';

// Runs after 05, which leaves the admin portal locked, so nothing here signs in as admin.

const FEATURE = 'backend-rules';

async function schedule(request: APIRequestContext) {
  return (await (await request.get('/api/schedule')).json()).sessions as any[];
}

async function book(request: APIRequestContext, sessionId: string, email: string, planKey = 'free') {
  const paymentMethod = planKey === 'free' ? undefined : 'studio';
  const res = await request.post('/api/bookings', {
    data: { sessionId, fullName: 'Rules Student', email, mode: 'in_person', planKey, paymentMethod },
  });
  return { res, body: await res.json() };
}

async function outbox(request: APIRequestContext) {
  return (await (await request.get('/api/test/outbox')).json()).emails as any[];
}

test('schedule has one entry per Dubai day for 8 weeks', async ({ request }) => {
  const sessions = await schedule(request);
  expect(sessions).toHaveLength(56);
  expect(new Set(sessions.map((s) => s.id)).size).toBe(56);
  expect(new Set(sessions.map((s) => s.dateDubai)).size).toBe(56);
  const rest = sessions.filter((s) => s.isRestDay);
  expect(rest).toHaveLength(8);
  expect(rest.every((s) => s.dateDubai.startsWith('Friday'))).toBe(true);
});

test('the last seat goes to exactly one of several simultaneous bookings', async ({ request }) => {
  const sessions = await schedule(request);
  const target = [...sessions].reverse().find((s) => !s.isRestDay && s.status === 'available');
  expect(target).toBeTruthy();

  for (let i = 0; i < target.spotsLeft - 1; i++) {
    const { res } = await book(request, target.id, uniqueEmail(`fill${i}`), 'single');
    expect(res.status()).toBe(201);
  }

  const racers = await Promise.all(
    Array.from({ length: 6 }, (_, i) => book(request, target.id, uniqueEmail(`race${i}`), 'single'))
  );
  const statuses = racers.map((r) => r.res.status());
  expect(statuses.filter((s) => s === 201)).toHaveLength(1);
  for (const r of racers.filter((x) => x.res.status() !== 201)) {
    expect(r.res.status()).toBe(400);
    expect(r.body.error).toContain('fully booked');
  }

  const after = (await schedule(request)).find((s) => s.id === target.id);
  expect(after.bookedCount).toBe(after.capacity);
  expect(after.spotsLeft).toBe(0);
  expect(after.status).toBe('full');
});

test('booking emails: student confirmation and studio alert are captured, never sent', async ({ request }) => {
  await request.post('/api/test/outbox/clear');
  const session = await firstAvailableSession(request);
  const email = uniqueEmail('mail');
  const { res, body } = await book(request, session.id, email);
  expect(res.status()).toBe(201);

  // the response only carries the student's own confirmation
  expect(body.dispatchedEmails).toHaveLength(1);
  expect(body.dispatchedEmails[0].type).toBe('student_confirmation');
  expect(body.dispatchedEmails[0].recipient).toBe(email);

  const emails = await outbox(request);
  const confirmation = emails.find((e) => e.kind === 'booking_confirmation' && e.recipient === email);
  expect(confirmation).toBeTruthy();
  expect(confirmation.body).toContain(`Your Booking Token: ${body.booking.bookingToken}`);
  expect(confirmation.replyTo).toBe('nbsingh2050@gmail.com');
  expect(confirmation.sender).toContain('priyanshi@yogapriyanshi.com');

  const alert = emails.find((e) => e.kind === 'booking_alert' && e.replyTo === email);
  expect(alert).toBeTruthy();
  expect(alert.recipient).not.toBe(email);
});

test('an email failure never blocks a booking, a cancellation or a message', async ({ request }) => {
  await request.post('/api/test/email-fail', { data: { fail: true } });
  try {
    const session = await firstAvailableSession(request);
    const { res, body } = await book(request, session.id, uniqueEmail('mailfail'));
    expect(res.status()).toBe(201);
    expect(body.booking.status).toBe('confirmed');
    expect(body.dispatchedEmails).toEqual([]);

    const lookup = await request.get(`/api/bookings/${body.booking.bookingToken}`);
    expect(lookup.status()).toBe(200);

    const cancel = await request.post('/api/bookings/cancel', { data: { bookingToken: body.booking.bookingToken } });
    expect(cancel.status()).toBe(200);

    const contact = await request.post('/api/contact', {
      data: { name: 'Mail Fail', email: uniqueEmail('mailfail-contact'), message: 'Still stored?' },
    });
    expect(contact.status()).toBe(200);
  } finally {
    await request.post('/api/test/email-fail', { data: { fail: false } });
  }
});

test('health check reveals nothing but ok and database', async ({ request }) => {
  const body = await (await request.get('/api/health')).json();
  expect(Object.keys(body).sort()).toEqual(['database', 'ok']);
});

test('removed routes are gone and big bodies are refused', async ({ request }) => {
  expect((await request.get('/api/emails/recent')).status()).toBe(404);
  expect((await request.get('/api/download-source')).status()).toBe(404);
  expect((await request.post('/api/gemini/math-tutor', { data: { currentPrompt: 'hi' } })).status()).toBe(404);

  const big = await request.post('/api/contact', {
    data: { name: 'Big', email: uniqueEmail('big'), message: 'x'.repeat(200 * 1024) },
  });
  expect(big.status()).toBe(413);
  expect(await big.json()).toEqual({ error: expect.any(String) });
});

test('guessed or malformed tokens get the same 404', async ({ request }) => {
  const guessed = 'YP-' + 'ABCDEFGHJKMNPQRS';
  const responses = await Promise.all([
    request.get(`/api/bookings/${guessed}`),
    request.get('/api/bookings/YP-000000'),
    request.get('/api/bookings/not-a-token'),
    request.post('/api/bookings/cancel', { data: { bookingToken: guessed } }),
  ]);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  for (const r of responses) expect(r.status()).toBe(404);
  expect(new Set(bodies.map((b) => b.error)).size).toBe(1);
});

test('tokens are normalised: lowercase, spaces and I/L/O look-alikes still match', async ({ request }) => {
  const session = await firstAvailableSession(request);
  const { body } = await book(request, session.id, uniqueEmail('norm'));
  const token: string = body.booking.bookingToken;
  const lookalike = '  ' + token.toLowerCase().replace(/1/g, 'l').replace(/0/g, 'o') + ' ';
  const res = await request.get(`/api/bookings/${encodeURIComponent(lookalike)}`);
  expect(res.status()).toBe(200);
  expect((await res.json()).booking.bookingToken).toBe(token);
});

test('early cancel of a free class gives it back, but not for the same session', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const request = page.request;
  const email = uniqueEmail('k-early');
  const first = await firstAvailableSession(request, 7); // far enough ahead for a free cancellation
  const second = (await schedule(request)).find((s) => !s.isRestDay && s.status === 'available' && s.id !== first.id);

  const booked = await book(request, first.id, email);
  expect(booked.res.status()).toBe(201);
  const cancel = await request.post('/api/bookings/cancel', { data: { bookingToken: booked.body.booking.bookingToken } });
  expect(cancel.status()).toBe(200);
  expect((await cancel.json()).booking.creditStatus).toBe('refunded');

  // same session again: refused, with the studio contact from settings
  const again = await book(request, first.id, email);
  expect(again.res.status()).toBe(400);
  expect(again.body.error).toBe(
    "I'm so sorry — for any further queries please contact the YogaPriyanshi studio directly at nbsingh2050@gmail.com."
  );

  // the booking form says the same and offers the other sessions instead
  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Book Free Class' }).click();
  const modal = bookingModal(page);
  await expect(modal.locator(`select option[value="${first.id}"]`)).toBeAttached();
  await modal.locator('select').selectOption(first.id);
  await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
  await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Rules Student');
  await modal.getByPlaceholder('layla@example.com').fill(email);
  await modal.getByRole('button', { name: 'Confirm Free Reservation' }).click();
  await expect(modal.getByText('contact the YogaPriyanshi studio directly at nbsingh2050@gmail.com')).toBeVisible();
  await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  // announced and focused, with the studio address as a mail link
  await expect(modal.getByRole('alert')).toBeFocused();
  await expect(modal.getByRole('alert').getByRole('link', { name: 'nbsingh2050@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:nbsingh2050@gmail.com'
  );
  await expect(modal.locator(`select option[value="${first.id}"]`)).toHaveCount(0);
  await shot('rebook-refused-other-sessions-offered');

  // a different session: the free class is available again
  const other = await book(request, second.id, email);
  expect(other.res.status()).toBe(201);
  expect(other.body.booking.paymentStatus).toBe('free');
});

test('late cancel of a free class keeps it used', async ({ request }) => {
  const email = uniqueEmail('k-late');
  const soon = await request.post('/api/test/session-soon', { data: { minutesFromNow: 90 } });
  expect(soon.status()).toBe(201);
  const { session } = await soon.json();

  const booked = await book(request, session.id, email);
  expect(booked.res.status()).toBe(201);
  const cancel = await request.post('/api/bookings/cancel', { data: { bookingToken: booked.body.booking.bookingToken } });
  expect(cancel.status()).toBe(200);
  const cancelBody = await cancel.json();
  expect(cancelBody.booking.creditStatus).toBe('burned');
  expect(cancelBody.noticeHours).toBeLessThan(6);

  const next = await firstAvailableSession(request);
  const again = await book(request, next.id, email);
  expect(again.res.status()).toBe(400);
  expect(again.body.error).toContain('already used its free first class');
});
