import { test as base, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';

const SCREENSHOT_ROOT = path.join('test-results', 'screenshots');

/** Saves a numbered full-page screenshot under test-results/screenshots/<feature>/<test>/. */
export function stepShooter(page: Page, feature: string, testTitle: string) {
  let n = 0;
  const dir = path.join(SCREENSHOT_ROOT, feature, slug(testTitle));
  return async (step: string, opts: { fullPage?: boolean } = {}) => {
    n += 1;
    await page.waitForTimeout(250); // let transitions settle
    await page.screenshot({
      path: path.join(dir, `${String(n).padStart(2, '0')}-${slug(step)}.png`),
      fullPage: opts.fullPage ?? false,
    });
  };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
}

/** Fails the test if the page logs console errors or uncaught exceptions. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d|WebSocket|\[vite\]/.test(msg.text()))
          errors.push(msg.text());
      });
      page.on('pageerror', (err) => { if (!/WebSocket|\[vite\]/.test(err.message)) errors.push(err.message); });
      await use(errors);
      expect(errors, 'browser console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** The soonest bookable session; `minHoursAhead` skips ones too close for a free (6h+) cancellation. */
export async function firstAvailableSession(request: APIRequestContext, minHoursAhead = 0) {
  const res = await request.get('/api/schedule');
  const { sessions } = await res.json();
  const earliest = Date.now() + minHoursAhead * 60 * 60 * 1000;
  const s = sessions.find(
    (x: any) => !x.isRestDay && x.status === 'available' && new Date(x.startTimeUtc).getTime() > earliest
  );
  expect(s, 'an available session exists').toBeTruthy();
  return s;
}

export async function apiBook(request: APIRequestContext, overrides: Record<string, unknown> = {}, minHoursAhead = 0) {
  const session = await firstAvailableSession(request, minHoursAhead);
  const res = await request.post('/api/bookings', {
    data: {
      sessionId: session.id,
      fullName: 'E2E Student',
      email: uniqueEmail('api'),
      mode: 'in_person',
      planKey: 'free',
      paymentMethod: 'studio',
      ...overrides,
    },
  });
  return { res, session, body: await res.json() };
}

/** Every captured email, newest first. */
export async function outbox(request: APIRequestContext): Promise<any[]> {
  return (await (await request.get('/api/test/outbox')).json()).emails;
}

/** The newest login code sent to this address. */
export async function latestCode(request: APIRequestContext, email: string): Promise<string> {
  const mail = (await outbox(request)).find((m) => m.recipient === email && m.kind === 'login_code');
  expect(mail, `a login code for ${email}`).toBeTruthy();
  return String(mail.body.match(/\b(\d{6})\b/)?.[1]);
}

/** Rate limits would otherwise break a suite that runs on one IP. */
export async function resetAccountLimits(request: APIRequestContext) {
  expect((await request.post('/api/test/account-limits-reset', { data: {} })).status()).toBe(200);
}

/** A same-origin account write, as the browser sends it. */
export function accountPost(request: APIRequestContext, path: string, data: Record<string, unknown>) {
  return request.post(`/api/account${path}`, { data, headers: { Origin: test.info().project.use.baseURL! } });
}

export async function openHome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export const bookingModal = (page: Page) =>
  page.locator('div.fixed.inset-0').filter({ has: page.getByLabel('Close modal') });

/** The "Find your class" sheet (its close button is "Close class finder", so bookingModal() never matches it). */
export const classFinder = (page: Page) => page.getByRole('dialog', { name: 'Find your class' });
