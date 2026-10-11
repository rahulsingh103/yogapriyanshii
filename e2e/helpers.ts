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
      ...overrides,
    },
  });
  return { res, session, body: await res.json() };
}

export async function openHome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export const bookingModal = (page: Page) =>
  page.locator('div.fixed.inset-0').filter({ has: page.getByLabel('Close modal') });
