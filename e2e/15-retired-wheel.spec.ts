import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, bookingModal, openHome, stepShooter, uniqueEmail } from './helpers';
import { TEST_ADMIN_PASSWORD } from './test-admin';
import { PRACTICE_CLASSES } from '../src/constants/classes';

const FEATURE = 'retired-wheel';
const WHEEL = /\bWheel\b/;

test.beforeEach(async ({ request }) => {
  await request.post('/api/test/admin-unlock');
});

async function schedule(request: APIRequestContext) {
  return (await (await request.get('/api/schedule')).json()).sessions as any[];
}

async function outbox(request: APIRequestContext) {
  return (await (await request.get('/api/test/outbox')).json()).emails as any[];
}

async function lookup(request: APIRequestContext, token: string) {
  const res = await request.get(`/api/bookings/${token}`);
  expect(res.status()).toBe(200);
  return res.json();
}

async function adminSessions(request: APIRequestContext) {
  const login = await request.post('/api/admin/login', { data: { password: TEST_ADMIN_PASSWORD } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const stats = await request.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
  expect(stats.status()).toBe(200);
  return (await stats.json()).upcomingSessions as any[];
}

/** The soonest session of a style, far enough ahead that cancelling it always refunds. */
async function soonest(request: APIRequestContext, style: string) {
  const earliest = Date.now() + 7 * 60 * 60 * 1000;
  const found = (await schedule(request)).find(
    (s) => !s.isRestDay && s.status === 'available' && s.style === style && Date.parse(s.startTimeUtc) > earliest
  );
  expect(found, `a ${style} session`).toBeTruthy();
  return found;
}

async function legacyBooking(request: APIRequestContext) {
  const email = uniqueEmail('legacy');
  const res = await request.post('/api/test/legacy-wheel-booking', { data: { email } });
  expect(res.status()).toBe(201);
  const { token, sessionId } = (await res.json()) as { token: string; sessionId: string };
  return { email, token, sessionId };
}

const freeBooking = (request: APIRequestContext, sessionId: string, email: string) =>
  request.post('/api/bookings', { data: { sessionId, fullName: 'E2E Student', email, mode: 'in_person', planKey: 'free' } });

const manageModal = (page: Page) => page.locator('div.fixed.inset-0').filter({ hasText: 'Manage Reservation' });

async function findReservation(page: Page, token: string) {
  await openHome(page);
  await page.locator('footer').getByRole('button', { name: 'Manage booking' }).click();
  const modal = manageModal(page);
  await modal.getByPlaceholder('e.g. YP-8K2N9F').fill(token);
  await modal.getByRole('button', { name: 'Find My Reservation' }).click();
  await expect(modal.getByText('Legacy Wheel Student')).toBeVisible();
  return modal;
}

test.describe('the migrated timetable', () => {
  test('a class every day: Vinyasa on Thursday, Yin on Friday, no Wheel', async ({ request }) => {
    const sessions = await schedule(request);
    expect(sessions).toHaveLength(56);
    expect(sessions.filter((s) => s.isRestDay)).toHaveLength(0);

    const thursdays = sessions.filter((s) => s.dateDubai.startsWith('Thursday'));
    expect(thursdays).toHaveLength(8);
    for (const s of thursdays) {
      expect(s).toMatchObject({ className: 'Vinyasa Yoga', style: 'vinyasa', timeDubai: '6:00 PM', duration: 60, capacity: 12, level: 'Some experience' });
    }
    const fridays = sessions.filter((s) => s.dateDubai.startsWith('Friday'));
    expect(fridays).toHaveLength(8);
    for (const s of fridays) {
      expect(s).toMatchObject({ className: 'Yin Yoga', style: 'yin', timeDubai: '7:00 AM', duration: 75, capacity: 12, level: 'All levels' });
    }

    expect(sessions.filter((s) => s.classId === 'wheel' || s.style === 'wheel' || WHEEL.test(s.className))).toEqual([]);
    const { classes } = await (await request.get('/api/classes')).json();
    expect(classes.map((c: any) => c.id)).toEqual(['hatha', 'barre', 'chakra', 'vinyasa', 'yin']);
    expect(classes.map((c: any) => c.style)).toEqual(['hatha', 'barre', 'chakra', 'vinyasa', 'yin']);
  });

  test('leftover empty Wheel sessions do not push real classes off the schedule', async ({ request }) => {
    const res = await request.post('/api/test/legacy-wheel-orphans');
    expect(res.status()).toBe(201);
    // None were there before, so the 8 below are what the LIMIT has to cope with.
    expect(await res.json()).toEqual({ created: 8, alreadyExisted: 0 });

    const sessions = await schedule(request);
    expect(sessions).toHaveLength(56);
    expect(sessions.filter((s) => s.isRestDay)).toHaveLength(0);
    expect(sessions[55].isRestDay).toBe(false);
    expect(sessions.filter((s) => s.classId === 'wheel')).toEqual([]);
    expect((await adminSessions(request)).filter((s) => s.classId === 'wheel')).toEqual([]);
  });
});

test.describe('booking the new classes', () => {
  for (const [name, style, slug] of [
    ['Vinyasa', 'vinyasa', 'vinyasa'],
    ['Yin Yoga', 'yin', 'yin-yoga'],
  ] as const) {
    test(`the ${name} card and page preselect its own session`, async ({ page, request }) => {
      const soonestOwn = (await schedule(request))
        .filter((s) => !s.isRestDay && s.status === 'available' && s.style === style)
        .sort((a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc))[0];
      await openHome(page);
      const classes = page.locator('#classes');
      await classes.scrollIntoViewIfNeeded();
      await classes.getByRole('button', { name: new RegExp(`^${name}`) }).click();
      const modal = bookingModal(page);
      await expect(modal.locator('select')).toHaveValue(soonestOwn.id);
      await expect(modal.locator('select option:checked')).toContainText(soonestOwn.className);
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);

      await page.goto(`/classes/${slug}`);
      await expect(page.locator('#preloader')).toHaveCount(0);
      await page.locator('#class-actions').getByRole('button', { name: 'Book a free class' }).click();
      await expect(modal.locator('select')).toHaveValue(soonestOwn.id);
    });
  }

  test('a Vinyasa booking and cancel works, with named emails and an admin row', async ({ request }) => {
    const session = await soonest(request, 'vinyasa');
    const email = uniqueEmail('vinyasa');
    await request.post('/api/test/outbox/clear');

    const res = await freeBooking(request, session.id, email);
    expect(res.status()).toBe(201);
    const { booking } = await res.json();
    expect(booking.sessionTitle).toBe('Vinyasa Yoga');

    const emails = await outbox(request);
    const confirmation = emails.find((e) => e.kind === 'booking_confirmation' && e.recipient === email);
    const alert = emails.find((e) => e.type === 'studio_alert' && e.body.includes(email));
    for (const mail of [confirmation, alert]) {
      expect(mail).toBeTruthy();
      expect(`${mail.subject}\n${mail.body}`).toContain('Vinyasa Yoga');
      expect(mail.body).toContain(session.dateDubai);
      expect(`${mail.subject}\n${mail.body}`).not.toMatch(/undefined|null|NaN/);
    }

    const row = (await adminSessions(request)).find((s) => s.id === session.id);
    expect(row).toMatchObject({ className: 'Vinyasa Yoga', style: 'vinyasa', bookedCount: session.bookedCount + 1 });

    const cancel = await request.post('/api/bookings/cancel', { data: { bookingToken: booking.bookingToken } });
    expect(cancel.status()).toBe(200);
    expect((await cancel.json()).booking.creditStatus).toBe('refunded');
    expect((await schedule(request)).find((s) => s.id === session.id).bookedCount).toBe(session.bookedCount);
  });
});

test.describe('a Wheel booking made before the class was retired', () => {
  test('lookup and admin keep the label, and a new booking is refused without using a seat or the free class', async ({ request }) => {
    const { token, sessionId } = await legacyBooking(request);

    const found = await lookup(request, token);
    expect(found.booking.sessionTitle).toBe('Wheel Yoga');
    expect(found.booking.status).toBe('confirmed');
    expect(found.session).toMatchObject({ classId: 'wheel', style: 'wheel', bookedCount: 1 });
    expect((await adminSessions(request)).find((s) => s.id === sessionId)).toMatchObject({ className: 'Wheel Yoga', bookedCount: 1 });

    const newcomer = uniqueEmail('refused');
    const refused = await freeBooking(request, sessionId, newcomer);
    expect(refused.status()).toBe(404);
    expect((await lookup(request, token)).session.bookedCount).toBe(1);

    // The refused attempt left the newcomer's free class unused.
    const real = await soonest(request, 'hatha');
    const first = await freeBooking(request, real.id, newcomer);
    expect(first.status()).toBe(201);
    expect((await first.json()).booking.paymentStatus).toBe('free');
  });

  test('Manage Booking works at 375px and on desktop', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const { token } = await legacyBooking(page.request);

    await page.setViewportSize({ width: 375, height: 812 });
    let modal = await findReservation(page, token);
    await expect(modal.getByText('Wheel Yoga')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot('phone');

    await page.setViewportSize({ width: 1440, height: 900 });
    modal = await findReservation(page, token);
    await expect(modal.getByText('Wheel Yoga')).toBeVisible();
    await expect(modal.getByText('Eligible for Free Cancellation')).toBeVisible();
    await shot('desktop');
    await modal.getByRole('button', { name: 'Confirm Cancellation' }).click();
    await expect(modal.getByText('Reservation Cancelled')).toBeVisible();
    await expect(modal.getByText('Refunded', { exact: true })).toBeVisible();
    await shot('cancelled');
  });

  test('cancelling refunds, releases the seat, returns the free class, alerts by name and leaves admin', async ({ request }) => {
    const { email, token, sessionId } = await legacyBooking(request);
    await request.post('/api/test/outbox/clear');

    const cancel = await request.post('/api/bookings/cancel', { data: { bookingToken: token } });
    expect(cancel.status()).toBe(200);
    const body = await cancel.json();
    expect(body.booking.creditStatus).toBe('refunded');
    expect(body.booking.status).toBe('cancelled');

    const after = await lookup(request, token);
    expect(after.booking.creditStatus).toBe('refunded');
    expect(after.session.bookedCount).toBe(0);

    const alert = (await outbox(request)).find((e) => e.type === 'studio_alert' && e.body.includes(email));
    expect(alert).toBeTruthy();
    expect(`${alert.subject}\n${alert.body}`).toContain('Wheel Yoga');

    expect((await adminSessions(request)).find((s) => s.id === sessionId)).toBeUndefined();

    // The free class came back.
    const real = await soonest(request, 'barre');
    const again = await freeBooking(request, real.id, email);
    expect(again.status()).toBe(201);
    expect((await again.json()).booking.paymentStatus).toBe('free');
  });
});

test.describe('before the migration has run', () => {
  test('Thursday and Friday are empty days with their own labels, and nothing offers Wheel', async ({ page, request }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const on = await request.post('/api/test/unmigrated-template', { data: { on: true } });
    expect(on.status()).toBe(200);
    try {
      const sessions = await schedule(request);
      expect(sessions).toHaveLength(56);
      const empty = sessions.filter((s) => s.isRestDay);
      expect(empty).toHaveLength(16);
      expect(empty.every((s) => /^(Thursday|Friday)/.test(s.dateDubai))).toBe(true);
      expect(empty.every((s) => s.className === 'No class')).toBe(true);
      expect(sessions.filter((s) => s.classId === 'wheel' || s.style === 'wheel')).toEqual([]);

      const refused = await request.post('/api/bookings', {
        data: { sessionId: empty[0].id, fullName: 'X', email: uniqueEmail('empty'), mode: 'in_person', planKey: 'single' },
      });
      expect(refused.status()).toBe(400);
      expect((await refused.json()).error).toBe('No classes are scheduled on this day.');

      await openHome(page);
      const section = page.locator('#schedule');
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByText('Retrieving live studio availability...')).toHaveCount(0);
      const cards = section.locator('div.border-dashed').filter({ hasText: 'No class' });
      await expect(cards).toHaveCount(2);
      await expect(cards.filter({ hasText: 'Thursday' })).toHaveCount(1);
      await expect(cards.filter({ hasText: 'Friday' })).toHaveCount(1);
      await expect(section.getByText('Rest Day')).toHaveCount(0);
      await expect(section.getByText(WHEEL)).toHaveCount(0);
      await shot('schedule');

      // A Vinyasa card has no session yet, so booking falls back to another class, visibly named.
      const classes = page.locator('#classes');
      await classes.scrollIntoViewIfNeeded();
      await classes.getByRole('button', { name: /^Vinyasa/ }).click();
      const modal = bookingModal(page);
      await expect(modal.locator('select option:checked')).not.toContainText(WHEEL);
      await expect(modal.locator('select option')).not.toHaveCount(0);
    } finally {
      const off = await request.post('/api/test/unmigrated-template', { data: { on: false } });
      expect(off.status()).toBe(200);
    }
    expect((await schedule(request)).filter((s) => s.isRestDay)).toHaveLength(0);
  });

  test('the test route takes only a boolean', async ({ request }) => {
    for (const on of ['true', 1, null]) {
      expect((await request.post('/api/test/unmigrated-template', { data: { on } })).status()).toBe(400);
    }
    expect((await schedule(request)).filter((s) => s.isRestDay)).toHaveLength(0);
  });
});

test.describe('public text', () => {
  test('home, FAQ, head tags and the contact form never name a Wheel class', async ({ page, request }) => {
    expect(await (await request.get('/')).text()).not.toMatch(WHEEL);

    await openHome(page);
    const faq = page.locator('#faq');
    await faq.scrollIntoViewIfNeeded();
    await faq.getByRole('button', { name: 'Which classes do you teach?' }).click();
    await expect(faq).toContainText('Vinyasa and Yin Yoga are on the weekly schedule');
    expect(await page.content()).not.toMatch(WHEEL);

    await page.locator('#contact').getByRole('button', { name: 'Contact Priyanshi' }).click();
    const contact = page.getByRole('dialog', { name: 'Send a message' });
    const options = await contact.getByLabel('Area of Interest').locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(0);
    expect(options.join('|')).not.toMatch(WHEEL);
  });

  test('all 10 class pages never name a Wheel class', async ({ page, request }) => {
    expect(PRACTICE_CLASSES).toHaveLength(10);
    for (const cls of PRACTICE_CLASSES) {
      const res = await request.get(`/classes/${cls.slug}`);
      expect(res.status(), cls.slug).toBe(200);
      expect(await res.text(), `${cls.slug} served`).not.toMatch(WHEEL);
      await page.goto(`/classes/${cls.slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(cls.name);
      expect(await page.content(), `${cls.slug} rendered`).not.toMatch(WHEEL);
    }
  });
});
