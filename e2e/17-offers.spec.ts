import path from 'path';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { test, expect, openHome, uniqueEmail, latestCode, resetAccountLimits, accountPost, outbox } from './helpers';
import { TEST_ADMIN_PASSWORD } from './test-admin';
import { dubaiYmd, formatDay } from '../src/lib/dubai-date';

// Opt-in offer emails: the admin Offers tab, at-most-once sending, the daily cap, and the no-login
// unsubscribe. Every test starts from no accounts and no offers (test routes only).

const SHOTS = path.join('.data', 'shots', 'accounts');
const OFFERS = '/api/admin/offers';

async function adminToken(request: APIRequestContext) {
  await request.post('/api/test/admin-unlock');
  const res = await request.post('/api/admin/login', { data: { password: TEST_ADMIN_PASSWORD } });
  expect(res.status()).toBe(200);
  return (await res.json()).token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** n verified, opted-in accounts. */
async function subscribers(request: APIRequestContext, n: number) {
  const emails: string[] = [];
  for (let i = 0; i < n; i++) {
    const email = uniqueEmail(`sub${i}`);
    await accountPost(request, '/request-code', { intent: 'signup', email, offersOptIn: true });
    const res = await accountPost(request, '/verify', { email, code: await latestCode(request, email) });
    expect(res.status()).toBe(200);
    emails.push(email);
  }
  await request.post('/api/test/outbox/clear');
  return emails;
}

const accountRow = async (request: APIRequestContext, email: string) =>
  (await (await request.post('/api/test/account-row', { data: { email } })).json()).account as Record<string, unknown>;

const create = (request: APIRequestContext, token: string, data: Record<string, unknown> = {}) =>
  request.post(OFFERS, { headers: auth(token), data: { subject: 'Holiday offer', body: 'Two classes for the holidays.', ...data } });
const batch = async (request: APIRequestContext, token: string, id: string) => {
  const res = await request.post(`${OFFERS}/${id}/send-batch`, { headers: auth(token), data: {} });
  expect(res.status()).toBe(200);
  return res.json();
};
const finish = async (request: APIRequestContext, token: string, id: string) => {
  for (let i = 0; i < 20; i++) {
    const res = await batch(request, token, id);
    if (res.offer.status === 'done') return res;
  }
  throw new Error('offer did not finish');
};

const offerMails = async (request: APIRequestContext) => (await outbox(request)).filter((m) => m.kind === 'offer');

async function openOffers(page: Page, token: string) {
  await page.addInitScript((t) => window.localStorage.setItem('yp_admin_token', t), token);
  await openHome(page);
  await page.locator('footer').getByRole('button', { name: 'Studio admin' }).click();
  const admin = page.getByRole('dialog', { name: "Priyanshi's Studio Overview" });
  await admin.getByRole('tab', { name: 'Offers' }).click();
  await expect(admin.getByRole('heading', { name: 'Offers', exact: true })).toBeVisible();
  return admin;
}

test.beforeEach(async ({ request }) => {
  await request.post('/api/test/account-limits-reset', { data: { allData: true } });
  await request.post('/api/test/offer-daily-limit', { data: { limit: null } });
  await request.post('/api/test/email-fail', { data: { fail: false } });
  await request.post('/api/test/outbox/clear');
});

test.afterAll(async ({ request }) => {
  await request.post('/api/test/account-limits-reset', { data: { allData: true } });
  await request.post('/api/test/offer-daily-limit', { data: { limit: null } });
});

test('admin only: 401 without a token on all three routes', async ({ request }) => {
  expect((await request.get(OFFERS)).status()).toBe(401);
  expect((await request.post(OFFERS, { data: { subject: 'x', body: 'y' } })).status()).toBe(401);
  expect((await request.post(`${OFFERS}/00000000-0000-4000-8000-000000000000/send-batch`, { data: {} })).status()).toBe(401);
  expect((await request.get(OFFERS, { headers: auth('nope') })).status()).toBe(401);
});

test('refusals: no subscribers, multi-line or long subject, empty or long body, an offer already sending', async ({ request }) => {
  const token = await adminToken(request);
  const none = await create(request, token);
  expect(none.status()).toBe(400);
  expect((await none.json()).error).toBe('There are no subscribers yet.');

  await subscribers(request, 2);
  expect((await create(request, token, { subject: 'one\ntwo' })).status()).toBe(400);
  expect((await create(request, token, { subject: 'x'.repeat(121) })).status()).toBe(400);
  expect((await create(request, token, { subject: '' })).status()).toBe(400);
  expect((await create(request, token, { body: '' })).status()).toBe(400);
  expect((await create(request, token, { body: 'x'.repeat(5001) })).status()).toBe(400);
  expect((await (await request.get(OFFERS, { headers: auth(token) })).json()).offers).toEqual([]);

  const first = await create(request, token);
  expect(first.status()).toBe(200);
  const active = await create(request, token);
  expect(active.status()).toBe(409);
  // Two at once: still only one offer.
  const { offers, current, subscribers: count } = await (await request.get(OFFERS, { headers: auth(token) })).json();
  expect(count).toBe(2);
  expect(offers).toHaveLength(1);
  expect(current.id).toBe((await first.json()).offer.id);
  // No list of people in the answer.
  expect(JSON.stringify({ offers, current })).not.toContain('@');
  await finish(request, token, current.id);
  expect((await request.post(`${OFFERS}/not-a-uuid/send-batch`, { headers: auth(token), data: {} })).status()).toBe(404);
  expect((await request.post(`${OFFERS}/00000000-0000-4000-8000-000000000000/send-batch`, { headers: auth(token), data: {} })).status()).toBe(404);
});

test('opted-in accounts get it exactly once, even with concurrent batches: token, footer, both headers', async ({ request }) => {
  const token = await adminToken(request);
  const emails = await subscribers(request, 4);

  // Someone who said no, and someone who has only asked for a code, get nothing.
  const notOptedIn = uniqueEmail('noopt');
  await accountPost(request, '/request-code', { intent: 'signup', email: notOptedIn });
  await accountPost(request, '/verify', { email: notOptedIn, code: await latestCode(request, notOptedIn) });
  const pendingOnly = uniqueEmail('pending');
  await accountPost(request, '/request-code', { intent: 'signup', email: pendingOnly, offersOptIn: true });
  await request.post('/api/test/outbox/clear');

  const created = await create(request, token);
  const { offer } = await created.json();
  expect(offer.remaining).toBe(4);

  await Promise.all([batch(request, token, offer.id), batch(request, token, offer.id), batch(request, token, offer.id)]);
  const done = await finish(request, token, offer.id);
  expect(done.offer).toMatchObject({ status: 'done', sent: 4, failed: 0, skipped: 0, remaining: 0 });

  const mails = await offerMails(request);
  expect(mails.map((m) => m.recipient).sort()).toEqual([...emails].sort());

  const tokens = new Set<string>();
  const site = test.info().project.use.baseURL!;
  for (const mail of mails) {
    const row = await accountRow(request, mail.recipient);
    const t = String(row.unsubscribe_token);
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    tokens.add(t);
    expect(mail.subject).toBe('Holiday offer');
    // Offers send from their own subdomain; booking mail stays on the main domain (spec 07).
    expect(mail.sender).toContain('<offers@news.yogapriyanshi.com>');
    expect(mail.body.startsWith('Two classes for the holidays.\n')).toBe(true);
    expect(mail.body).toContain(`${site}/unsubscribe?token=${t}`);
    expect(mail.headers).toEqual({
      'List-Unsubscribe': `<${site}/api/offers/unsubscribe?token=${t}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(mail.ref).toMatch(/^[0-9a-f-]{36}$/);
    expect(mail.type).toBe('student_offer');
  }
  expect(tokens.size).toBe(4);

  // A finished offer sends nothing more.
  await batch(request, token, offer.id);
  expect(await offerMails(request)).toHaveLength(4);
});

test('GET /api/admin/offers returns at most 10 offers', async ({ request }) => {
  const token = await adminToken(request);
  await subscribers(request, 1);
  await request.post('/api/test/offer-daily-limit', { data: { limit: 1000 } });
  for (let i = 0; i < 11; i++) {
    const { offer } = await (await create(request, token, { subject: `Offer ${i}` })).json();
    await finish(request, token, offer.id);
  }
  const { offers } = await (await request.get(OFFERS, { headers: auth(token) })).json();
  expect(offers).toHaveLength(10);
  expect(offers[0].subject).toBe('Offer 10');
});

test('someone who unsubscribes mid-send is skipped', async ({ request }) => {
  const token = await adminToken(request);
  const emails = await subscribers(request, 3);
  await request.post('/api/test/offer-daily-limit', { data: { limit: 1 } });
  const { offer } = await (await create(request, token)).json();
  const first = await batch(request, token, offer.id);
  expect(first.paused).toBe(true);
  const [sentTo] = (await offerMails(request)).map((m) => m.recipient);
  const other = emails.filter((e) => e !== sentTo)[0];
  const t = String((await accountRow(request, other)).unsubscribe_token);
  expect((await request.post(`/api/offers/unsubscribe?token=${t}`)).status()).toBe(200);

  await request.post('/api/test/offer-daily-limit', { data: { limit: null } });
  const done = await finish(request, token, offer.id);
  expect(done.offer).toMatchObject({ status: 'done', sent: 2, failed: 0, skipped: 1 });
  expect((await offerMails(request)).map((m) => m.recipient)).not.toContain(other);
});

test('the daily cap pauses and resumes, with nothing sent twice', async ({ request }) => {
  const token = await adminToken(request);
  const emails = await subscribers(request, 3);
  await request.post('/api/test/offer-daily-limit', { data: { limit: 2 } });
  const { offer } = await (await create(request, token)).json();
  const res = await batch(request, token, offer.id);
  expect(res.paused).toBe(true);
  expect(res.offer).toMatchObject({ status: 'sending', sent: 2, remaining: 1 });
  expect(await offerMails(request)).toHaveLength(2);

  const still = await batch(request, token, offer.id);
  expect(still.paused).toBe(true);
  expect(await offerMails(request)).toHaveLength(2);

  await request.post('/api/test/offer-daily-limit', { data: { limit: 3 } });
  const done = await finish(request, token, offer.id);
  expect(done.offer).toMatchObject({ status: 'done', sent: 3 });
  expect((await offerMails(request)).map((m) => m.recipient).sort()).toEqual([...emails].sort());
});

test('failures are counted and never retried', async ({ request }) => {
  const token = await adminToken(request);
  await subscribers(request, 2);
  const { offer } = await (await create(request, token)).json();
  await request.post('/api/test/email-fail', { data: { fail: true } });
  const failed = await batch(request, token, offer.id);
  await request.post('/api/test/email-fail', { data: { fail: false } });
  expect(failed.offer).toMatchObject({ status: 'done', sent: 0, failed: 2, remaining: 0 });
  await batch(request, token, offer.id);
  expect(await offerMails(request)).toEqual([]);
});

test('a send cut off mid-call counts as not delivered and is never sent again', async ({ request }) => {
  const token = await adminToken(request);
  const emails = await subscribers(request, 2);
  const { offer } = await (await create(request, token)).json();
  await request.post('/api/test/offer-interrupt', { data: { offerId: offer.id } });
  const done = await finish(request, token, offer.id);
  expect(done.offer).toMatchObject({ status: 'done', sent: 1, failed: 1 });
  const mails = await offerMails(request);
  expect(mails).toHaveLength(1);
  expect(emails).toContain(mails[0].recipient);
});

test.describe('unsubscribe', () => {
  test('GET on the API only redirects, GET on the page changes nothing, and a malformed token loses its token', async ({ page, request }) => {
    const [email] = await subscribers(request, 1);
    const t = String((await accountRow(request, email)).unsubscribe_token);
    const redirect = await request.get(`/api/offers/unsubscribe?token=${t}`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers()['location']).toBe(`/unsubscribe?token=${t}`);
    const bad = await request.get('/api/offers/unsubscribe?token=../../evil', { maxRedirects: 0 });
    expect(bad.status()).toBe(302);
    expect(bad.headers()['location']).toBe('/unsubscribe');
    expect((await accountRow(request, email)).offers_opt_in).toBe(1);

    const html = await request.get(`/unsubscribe?token=${t}`);
    expect(html.status()).toBe(200);
    expect(await html.text()).toContain('<meta name="robots" content="noindex" />');

    await page.goto(`/unsubscribe?token=${t}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Unsubscribe from offers' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect((await accountRow(request, email)).offers_opt_in).toBe(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('main')).not.toContainText(email);
    await expect(page.locator('body')).not.toContainText(email);
  });

  test('the button unsubscribes with no login, a repeat is success, and the toggle can turn it back on', async ({ page, request }) => {
    const [email] = await subscribers(request, 1);
    const row = await accountRow(request, email);
    const t = String(row.unsubscribe_token);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/unsubscribe?token=${t}`);
    await page.locator('#preloader').waitFor({ state: 'detached' });
    await page.screenshot({ path: path.join(SHOTS, '1280-unsubscribe.png') });
    await page.getByRole('button', { name: 'Unsubscribe', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: "You're unsubscribed" })).toBeFocused();
    await page.screenshot({ path: path.join(SHOTS, '1280-unsubscribe-done.png') });
    const after = await accountRow(request, email);
    expect(after.offers_opt_in).toBe(0);
    expect(after.offers_opted_out_at).toBeTruthy();
    await expect(page.locator('body')).not.toContainText(email);

    // Repeat: still a success, nothing else changes.
    const repeat = await request.post(`/api/offers/unsubscribe?token=${t}`);
    expect(repeat.status()).toBe(200);
    expect((await accountRow(request, email)).offers_opted_out_at).toBe(after.offers_opted_out_at);

    expect((await accountPost(request, '/update', { offersOptIn: true })).status()).toBe(200);
    const back = await accountRow(request, email);
    expect(back.offers_opt_in).toBe(1);
    expect(back.offers_opted_out_at).toBeNull();
  });

  test('mail one-click works with no cookie, no Origin and a form body', async ({ playwright, request }) => {
    const [email] = await subscribers(request, 1);
    const t = String((await accountRow(request, email)).unsubscribe_token);
    const clean = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL! });
    const res = await clean.post(`/api/offers/unsubscribe?token=${t}`, { form: { 'List-Unsubscribe': 'One-Click' } });
    expect(res.status()).toBe(200);
    await clean.dispose();
    expect((await accountRow(request, email)).offers_opt_in).toBe(0);
  });

  test('an unknown or missing token gets one generic 404, and the page says so', async ({ page, request }) => {
    const messages = new Set<string>();
    for (const url of [`/api/offers/unsubscribe?token=${'0'.repeat(64)}`, '/api/offers/unsubscribe?token=bad', '/api/offers/unsubscribe']) {
      const res = await request.post(url);
      expect(res.status()).toBe(404);
      messages.add((await res.json()).error);
    }
    expect(messages.size).toBe(1);

    await page.goto('/unsubscribe');
    await expect(page.getByRole('heading', { level: 1, name: "This link doesn't work" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unsubscribe', exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/unsubscribe?token=${'0'.repeat(64)}`);
    await page.getByRole('button', { name: 'Unsubscribe', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: "This link doesn't work" })).toBeFocused();
    await page.locator('#preloader').waitFor({ state: 'detached' });
    await page.screenshot({ path: path.join(SHOTS, '1280-unsubscribe-invalid.png') });
  });

  test('after a failed request the button has focus again, and a retry works', async ({ page, request }) => {
    const [email] = await subscribers(request, 1);
    const t = String((await accountRow(request, email)).unsubscribe_token);
    await page.goto(`/unsubscribe?token=${t}`);
    await page.route('**/api/offers/unsubscribe*', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"Please try again in a moment."}' }), { times: 1 });
    const button = page.getByRole('button', { name: 'Unsubscribe', exact: true });
    await button.click();
    await expect(page.getByRole('alert')).toHaveText('Please try again in a moment.');
    await expect(button).toBeFocused();
    expect((await accountRow(request, email)).offers_opt_in).toBe(1);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: "You're unsubscribed" })).toBeFocused();
  });
});

test.describe('the Offers tab', () => {
  test('review shows the exact email; cancel sends nothing; send reports the outcome', async ({ page, request }) => {
    const token = await adminToken(page.request);
    await subscribers(request, 2);
    await page.setViewportSize({ width: 1280, height: 800 });
    const admin = await openOffers(page, token);
    const panel = admin.getByRole('tabpanel', { name: 'Offers' });
    await expect(panel.getByTestId('offers-subscribers')).toContainText('2 subscribers');
    await expect(panel.getByLabel('Message')).toHaveAttribute('aria-describedby', 'offer-body-help');
    await expect(panel.locator('#offer-body-help')).toContainText('An unsubscribe footer is added to every email.');
    await panel.getByLabel('Subject').fill('Spring offer');
    await panel.getByLabel('Message').fill('Join me this spring.\nSee you on the mat.');
    await panel.getByRole('button', { name: 'Review' }).click();

    await expect(panel.getByRole('heading', { name: 'Check the email' })).toBeFocused();
    const review = panel.getByTestId('offer-review');
    await expect(review).toContainText('Spring offer');
    await expect(review).toContainText('See you on the mat.');
    await expect(review).toContainText('Unsubscribe');
    await page.screenshot({ path: path.join(SHOTS, '1280-offers-review.png') });

    // Cancel at review: nothing created, nothing sent, the words are kept.
    await panel.getByRole('button', { name: 'Back to editing' }).click();
    await expect(panel.getByLabel('Subject')).toHaveValue('Spring offer');
    await expect(panel.getByLabel('Subject')).toBeFocused();
    expect(await offerMails(request)).toEqual([]);
    expect((await (await request.get(OFFERS, { headers: auth(token) })).json()).offers).toEqual([]);

    await panel.getByRole('button', { name: 'Review' }).click();
    // Held on the first batch, so the sending state can be seen.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/send-batch', async (route) => {
      await held;
      await route.continue();
    }, { times: 1 });
    await panel.getByRole('button', { name: 'Send to 2 subscribers' }).click();
    // Focus goes to the progress card, which then reports the outcome.
    await expect(panel.getByTestId('offer-progress')).toBeFocused();
    await expect(panel.getByTestId('offer-progress')).toContainText('Sending');
    await page.screenshot({ path: path.join(SHOTS, '1280-offers-sending.png') });
    release();
    await expect(panel.getByTestId('offer-progress')).toContainText('Sent 2, not delivered 0');
    await expect(panel.getByTestId('offer-progress')).toContainText('Finished');
    await expect(panel.getByTestId('offer-row').first()).toContainText('Spring offer');
    // Dates are on the studio's calendar ("7 Nov 2026"), whatever the device's zone.
    await expect(panel.getByTestId('offer-row').first()).toContainText(`${formatDay(dubaiYmd())} · Sent 2`);
    await expect(panel.getByLabel('Subject')).toHaveValue('');
    expect(await offerMails(request)).toHaveLength(2);
    await page.screenshot({ path: path.join(SHOTS, '1280-offers-sent.png') });
    // Nobody's address shows.
    await expect(panel).not.toContainText('@');
  });

  test('a closed tab shows "Continue sending", and it finishes without a duplicate', async ({ page, request }) => {
    const token = await adminToken(page.request);
    await subscribers(request, 2);
    await create(request, token);
    const admin = await openOffers(page, token);
    const panel = admin.getByRole('tabpanel', { name: 'Offers' });
    await expect(panel.getByRole('button', { name: 'Review' })).toBeDisabled();
    await panel.getByRole('button', { name: 'Continue sending' }).click();
    await expect(panel.getByTestId('offer-progress')).toContainText('Sent 2, not delivered 0');
    await expect(panel.getByRole('button', { name: 'Continue sending' })).toHaveCount(0);
    expect(await offerMails(request)).toHaveLength(2);
  });

  test('with no subscribers, Review is off and says why', async ({ page }) => {
    const token = await adminToken(page.request);
    const admin = await openOffers(page, token);
    const panel = admin.getByRole('tabpanel', { name: 'Offers' });
    await expect(panel.getByRole('button', { name: 'Review' })).toBeDisabled();
    // Said once, in the count line.
    await expect(panel.getByTestId('offers-subscribers')).toContainText('0 subscribers chose to get offers by email.');
    await expect(panel.getByText('There are no subscribers yet.')).toHaveCount(0);
  });

  test('empty fields are marked, and errors sit just above the buttons they are about', async ({ page, request }) => {
    const token = await adminToken(page.request);
    await subscribers(request, 1);
    await page.setViewportSize({ width: 1280, height: 800 });
    const admin = await openOffers(page, token);
    const panel = admin.getByRole('tabpanel', { name: 'Offers' });
    const review = panel.getByRole('button', { name: 'Review' });
    await review.click();
    await expect(panel.getByRole('alert')).toHaveText('Please write a subject and a message.');
    await expect(panel.getByLabel('Subject')).toHaveAttribute('aria-invalid', 'true');
    await expect(panel.getByLabel('Message')).toHaveAttribute('aria-invalid', 'true');
    const below = async (alert: Locator, button: Locator) => {
      const a = (await alert.boundingBox())!;
      expect(a.y + a.height).toBeLessThanOrEqual((await button.boundingBox())!.y);
      expect(a.y).toBeGreaterThan((await panel.getByLabel('Message').boundingBox())!.y);
    };
    await below(panel.getByRole('alert'), review);

    await panel.getByLabel('Subject').fill('Winter offer');
    await review.click();
    await expect(panel.getByLabel('Subject')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(panel.getByLabel('Message')).toHaveAttribute('aria-invalid', 'true');
    await panel.getByLabel('Message').fill('See you on the mat.');
    await review.click();

    // While reviewing, a refused send shows its reason above Send and Back.
    await page.route('**/api/admin/offers', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"Another offer is still sending. Finish it first."}' })
        : route.continue());
    const send = panel.getByRole('button', { name: 'Send to 1 subscriber' });
    await send.click();
    const alert = panel.getByRole('alert');
    await expect(alert).toHaveText('Another offer is still sending. Finish it first.');
    const a = (await alert.boundingBox())!;
    expect(a.y + a.height).toBeLessThanOrEqual((await send.boundingBox())!.y);
    expect(a.y).toBeGreaterThan((await panel.getByTestId('offer-review').boundingBox())!.y);
    expect(await offerMails(request)).toEqual([]);
  });

  test('the daily cap shows as paused in the tab', async ({ page, request }) => {
    const token = await adminToken(page.request);
    await subscribers(request, 2);
    await request.post('/api/test/offer-daily-limit', { data: { limit: 1 } });
    await page.setViewportSize({ width: 1280, height: 800 });
    const admin = await openOffers(page, token);
    const panel = admin.getByRole('tabpanel', { name: 'Offers' });
    await panel.getByLabel('Subject').fill('Paused offer');
    await panel.getByLabel('Message').fill('Two classes for the holidays.');
    await panel.getByRole('button', { name: 'Review' }).click();
    await panel.getByRole('button', { name: 'Send to 2 subscribers' }).click();
    const progress = panel.getByTestId('offer-progress');
    await expect(progress).toContainText('The daily limit is reached, so sending has paused.');
    await expect(progress).toContainText('Sent 1, not delivered 0, 1 still to send');
    await expect(panel.getByRole('button', { name: 'Continue sending' })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '1280-offers-paused.png') });
    expect(await offerMails(request)).toHaveLength(1);
  });

  test.describe('at 375px', () => {
    test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

    test('the tab and the unsubscribe page fit, with 44px controls', async ({ page, request }) => {
      const token = await adminToken(page.request);
      const [email] = await subscribers(request, 1);
      const admin = await openOffers(page, token);
      const panel = admin.getByRole('tabpanel', { name: 'Offers' });
      expect(await admin.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      await panel.getByLabel('Subject').fill('A subject');
      await panel.getByLabel('Message').fill('A short message.');
      await page.screenshot({ path: path.join(SHOTS, '375-offers.png') });
      // The bottom of the form: the helper and a full-width Review button.
      const reviewButton = panel.getByRole('button', { name: 'Review' });
      await reviewButton.scrollIntoViewIfNeeded();
      const field = (await panel.getByLabel('Subject').boundingBox())!;
      const reviewBox = (await reviewButton.boundingBox())!;
      expect(Math.abs(reviewBox.width - field.width)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(SHOTS, '375-offers-bottom.png') });
      await reviewButton.tap();
      const send = panel.getByRole('button', { name: 'Send to 1 subscriber' });
      expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await panel.getByRole('button', { name: 'Back to editing' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await admin.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: path.join(SHOTS, '375-offers-review.png') });

      const t = String((await accountRow(request, email)).unsubscribe_token);
      await page.goto(`/unsubscribe?token=${t}`);
      const button = page.getByRole('button', { name: 'Unsubscribe', exact: true });
      await expect(button).toBeVisible();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await page.locator('#preloader').waitFor({ state: 'detached' });
      await page.screenshot({ path: path.join(SHOTS, '375-unsubscribe.png') });
    });
  });
});
