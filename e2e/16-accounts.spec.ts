import path from 'path';
import { test as plainTest, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { test, expect, openHome, uniqueEmail, apiBook, bookingModal, latestCode, resetAccountLimits, accountPost, outbox } from './helpers';
import { PRODUCTION_SITE_URL, accountSecretFrom } from '../backend/config';
import { clearedSessionCookie, sessionCookie } from '../backend/accounts';
import { OFFERS_CONSENT } from '../backend/validate';
import { SITE_URL } from '../src/lib/page-meta';
import { sha256 } from '../backend/tokens';
import { ipSubject } from '../backend/rate-limit';

// Student accounts: the floating header, email one-time codes, sessions, limits and the Account sheet.
// Any spec that expects a 5xx in the browser uses plainTest: Chrome logs every 5xx as a console error.

const SHOTS = path.join('.data', 'shots', 'accounts');
const CONSENT = OFFERS_CONSENT.text;
const SENT = { success: true, message: 'Check your email.' };

const sheet = (page: Page) => page.getByRole('dialog').filter({ has: page.getByLabel('Close account window', { exact: true }) });
const pill = (page: Page) => page.locator('header > div').first();
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const counts = async (request: APIRequestContext) => (await (await request.get('/api/test/account-table-counts')).json()) as Record<string, number>;
const row = async (request: APIRequestContext, email: string) =>
  (await (await request.post('/api/test/account-row', { data: { email } })).json()) as {
    account: Record<string, unknown> | null;
    loginCode: Record<string, unknown> | null;
    sessionHashes: string[];
  };
const capInfo = async (request: APIRequestContext, cap?: number | null) =>
  (await (await request.post('/api/test/account-email-cap', { data: cap === undefined ? {} : { cap } })).json()) as { cap: number; count: number };

async function apiSignUp(request: APIRequestContext, email: string, offersOptIn = false) {
  expect((await accountPost(request, '/request-code', { intent: 'signup', email, offersOptIn })).status()).toBe(200);
  const res = await accountPost(request, '/verify', { email, code: await latestCode(request, email) });
  expect(res.status()).toBe(200);
  return res;
}

/** Logged in, as a returning browser: the cookie plus the hint. */
async function logInBrowser(page: Page, email: string, offersOptIn = false) {
  await apiSignUp(page.request, email, offersOptIn);
  await page.addInitScript(() => window.localStorage.setItem('yp_has_session', '1'));
}

/** The nav's middle is the pill's middle, however wide the two sides are. */
async function expectCentred(page: Page) {
  const p = (await pill(page).boundingBox())!;
  const n = (await nav(page).boundingBox())!;
  expect(Math.abs(n.x + n.width / 2 - (p.x + p.width / 2))).toBeLessThanOrEqual(1);
}

/** Polled: the menu and the sheet settle from a slightly smaller scale. */
const minTarget = (el: Locator) => expect.poll(async () => (await el.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

test.beforeEach(async ({ request }) => {
  await resetAccountLimits(request);
  await request.post('/api/test/email-fail', { data: { fail: false } });
  await request.post('/api/test/outbox/clear');
});

test.afterAll(async ({ request }) => {
  await resetAccountLimits(request);
});

test.describe('the header', () => {
  for (const width of [1280, 1080]) {
    test(`at ${width}px the links are centred in the pill logged out, logged in and while checking`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openHome(page);
      await expect(page.locator('header').getByRole('button', { name: 'Log in' })).toBeVisible();
      await expect(page.locator('header').getByRole('button', { name: 'Sign up' })).toBeVisible();
      await expectCentred(page);

      // A hint and no answer yet: the slots are there, but nothing shows.
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route('**/api/account/me', async (route) => {
        await held;
        await route.continue();
      });
      await logInBrowser(page, uniqueEmail('centre'));
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('header').getByRole('button', { name: 'Log in' })).toHaveCount(0);
      await expect(page.locator('header').getByRole('button', { name: 'Sign up' })).toHaveCount(0);
      await expectCentred(page);
      release();

      await expect(page.locator('header').getByRole('button', { name: 'Account' })).toBeVisible();
      await expect(page.locator('header').getByRole('button', { name: 'Log in' })).toHaveCount(0);
      await expectCentred(page);
    });
  }

  test('matches the owner\'s bar: logo, links, Log in text, dark Sign up, and no Book pill', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHome(page);
    const header = page.locator('header');
    await expect(header.getByRole('button', { name: /book/i })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'YogaPriyanshi' })).toBeVisible();
    await expect(nav(page).getByRole('link')).toHaveText(['Classes', 'Schedule', 'About', 'Contact']);
    const signUp = header.getByRole('button', { name: 'Sign up' });
    const dark = await signUp.evaluate((el) => getComputedStyle(el).backgroundColor);
    const logIn = header.getByRole('button', { name: 'Log in' });
    expect(dark).not.toBe(await logIn.evaluate((el) => getComputedStyle(el).backgroundColor));
    expect((await logIn.boundingBox())!.x).toBeLessThan((await signUp.boundingBox())!.x);
    await page.locator('#preloader').waitFor({ state: 'detached' });
    await pill(page).screenshot({ path: path.join(SHOTS, '1280-header.png') });
    await page.screenshot({ path: path.join(SHOTS, '1280-home.png') });
  });

  test.describe('sharp, logged in', () => {
    test.use({ deviceScaleFactor: 2 });

    test('the logged-in bar at 1280 and 375: Account in place of Log in and Sign up', async ({ page }) => {
      await logInBrowser(page, uniqueEmail('sharp'));
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await expect(page.locator('header').getByRole('button', { name: 'Account' })).toBeVisible();
      await expectCentred(page);
      await page.locator('#preloader').waitFor({ state: 'detached' });
      await pill(page).screenshot({ path: path.join(SHOTS, '1280-header-logged-in.png') });

      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByLabel('Toggle Navigation Menu')).toBeVisible();
      await expect(page.locator('header > div').getByRole('button', { name: 'Account' })).toBeHidden();
      await pill(page).screenshot({ path: path.join(SHOTS, '375-header-logged-in.png') });
      await page.getByLabel('Toggle Navigation Menu').click();
      await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Account' })).toBeVisible();
      await page.waitForTimeout(400); // the menu settles in
      await page.screenshot({ path: path.join(SHOTS, '375-menu-logged-in.png') });
    });
  });

  test('the bar and the menu switch at exactly 1080px', async ({ page }) => {
    await page.setViewportSize({ width: 1079, height: 800 });
    await openHome(page);
    await expect(page.getByLabel('Toggle Navigation Menu')).toBeVisible();
    await expect(nav(page)).toBeHidden();
    await expect(page.locator('header > div').getByRole('button', { name: 'Log in' })).toBeHidden();

    await page.setViewportSize({ width: 1080, height: 800 });
    await expect(page.getByLabel('Toggle Navigation Menu')).toBeHidden();
    await expect(nav(page)).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: 'Log in' })).toBeVisible();
  });

  test.describe('at 375px', () => {
    test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

    test('the overlay has Sign up and Log in, or Account once logged in; no overflow', async ({ page }) => {
      await openHome(page);
      await page.getByLabel('Toggle Navigation Menu').tap();
      const menu = page.getByRole('dialog', { name: 'Menu' });
      await minTarget(menu.getByRole('button', { name: 'Sign up' }));
      await minTarget(menu.getByRole('button', { name: 'Log in' }));
      await expect(menu.getByRole('button', { name: 'Account' })).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOTS, '375-menu.png') });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

      // The bar is opaque while the menu is open, so the links never show through under the logo.
      await expect.poll(() => pill(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
        await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      );

      // Sign up closes the menu at once: while the sheet's chunk loads, focus waits on the toggle.
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route('**/AccountModal*', async (route) => {
        await held;
        await route.continue();
      });
      await menu.getByRole('button', { name: 'Sign up' }).tap();
      await expect(menu).toHaveCount(0);
      await expect(page.getByLabel('Toggle Navigation Menu')).toBeFocused();
      release();
      await expect(sheet(page).getByRole('heading', { name: 'Sign up' })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.unroute('**/AccountModal*');

      await logInBrowser(page, uniqueEmail('overlay'));
      await page.goto('/');
      await expect(page.getByLabel('Toggle Navigation Menu')).toBeVisible();
      await page.getByLabel('Toggle Navigation Menu').tap();
      await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Account' })).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Log in' })).toHaveCount(0);
    });
  });
});

test.describe('no account needed', () => {
  test('an anonymous load makes no account request', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/account')) calls.push(r.url());
    });
    await openHome(page);
    await page.waitForLoadState('networkidle');
    await page.goto('/classes/hatha');
    await page.waitForLoadState('networkidle');
    expect(calls).toEqual([]);
  });

  plainTest('a /me failure with a stale hint shows Log in and Sign up, and the hint stays', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('yp_has_session', '1'));
    await page.route('**/api/account/me', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' }));
    await page.goto('/');
    await expect(page.locator('header').getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: 'Sign up' })).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('yp_has_session'))).toBe('1');
    await page.unroute('**/api/account/me');
    await page.route('**/api/account/me', (route) => route.abort());
    await page.reload();
    await expect(page.locator('header').getByRole('button', { name: 'Log in' })).toBeVisible();
  });

  test('a /me that never answers stops holding the header after about 4 seconds', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/account/me', async (route) => {
      await held;
      await route.continue();
    });
    await logInBrowser(page, uniqueEmail('slow'));
    const started = Date.now();
    await page.goto('/');
    const logIn = page.locator('header').getByRole('button', { name: 'Log in' });
    await expect(logIn).toBeVisible({ timeout: 8000 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(3500);
    // A late answer still swaps the account in.
    release();
    await expect(page.locator('header').getByRole('button', { name: 'Account' })).toBeVisible();
  });

  test('opening Account asks the server again: an unsubscribe elsewhere and an ended session both show', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const email = uniqueEmail('stale');
    await logInBrowser(page, email, true);
    await page.goto('/');
    const entry = page.locator('header').getByRole('button', { name: 'Account' });
    await expect(entry).toBeVisible();
    // Unsubscribed from an offer email while the page was open.
    const token = String((await row(request, email)).account!.unsubscribe_token);
    expect((await request.post(`/api/offers/unsubscribe?token=${token}`)).status()).toBe(200);
    await entry.click();
    const s = sheet(page);
    await expect(s.getByRole('switch', { name: CONSENT })).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');

    // The session ended: the sheet turns into Log in.
    await request.post('/api/test/account-session-expire', { data: { email } });
    await entry.click();
    await expect(s.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: 'Account' })).toHaveCount(0);
  });

  test('a stale hint with no session shows the buttons and clears the hint', async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('seeded')) {
        window.sessionStorage.setItem('seeded', '1');
        window.localStorage.setItem('yp_has_session', '1');
      }
    });
    await page.goto('/');
    await expect(page.locator('header').getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('yp_has_session'))).toBeNull();
  });

  test('booking works logged out and logged in, and creates no account', async ({ page, request }) => {
    const before = (await counts(request)).accounts;
    const { res } = await apiBook(request, { email: uniqueEmail('book-out') });
    expect(res.status()).toBe(201);
    expect((await counts(request)).accounts).toBe(before);

    const email = uniqueEmail('book-in');
    await logInBrowser(page, email);
    const afterLogin = (await counts(request)).accounts;
    expect(afterLogin).toBe(before + 1);
    await page.goto('/');
    await expect(page.locator('header').getByRole('button', { name: 'Account' })).toBeVisible();
    await page.locator('#home').getByRole('button', { name: 'Book a trial class' }).click();
    const modal = bookingModal(page);
    await expect(modal.getByText('Step 1 of 2')).toBeVisible();
    await expect(modal.locator('select option').first()).toBeAttached();
    await modal.getByRole('button', { name: /Continue to Checkout/ }).click();
    await modal.getByPlaceholder('e.g. Layla Al-Mansoor').fill('Logged In Student');
    // No prefill: booking stays separate from the account.
    await expect(modal.getByPlaceholder('layla@example.com')).toHaveValue('');
    await modal.getByPlaceholder('layla@example.com').fill(uniqueEmail('book-other'));
    await modal.getByRole('button', { name: 'Reserve Seat (Pay in Person)' }).click();
    await expect(modal.getByText("You're on the mat.")).toBeVisible();
    expect((await counts(request)).accounts).toBe(afterLogin);
  });
});

test.describe('sign-up and log-in', () => {
  test('sign-up end to end: email and an unticked box only, then the account view', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const email = uniqueEmail('signup');
    await openHome(page);
    await page.locator('header').getByRole('button', { name: 'Sign up' }).click();
    const s = sheet(page);
    await expect(s.getByRole('heading', { name: 'Sign up' })).toBeFocused();
    await expect(s.getByText("You don't need an account to read or book.")).toBeVisible();
    // Email and the box, and nothing else: no name, no password.
    await expect(s.locator('input:visible')).toHaveCount(2);
    await expect(s.getByLabel(/name/i)).toHaveCount(0);
    await expect(s.locator('input[type="password"]')).toHaveCount(0);
    const box = s.getByRole('checkbox', { name: CONSENT });
    await expect(box).not.toBeChecked();
    await page.screenshot({ path: path.join(SHOTS, '1280-sign-up.png') });

    await s.getByLabel('Email', { exact: true }).fill(email.toUpperCase());
    await box.check();
    await s.getByRole('button', { name: 'Email me a code' }).click();
    await expect(s.getByRole('heading', { name: 'Enter your code' })).toBeFocused();
    // Sign-up wording: a code always comes, so there is no "no account yet" line.
    await expect(s.getByText(`We emailed ${email.toUpperCase()} a 6-digit code. Enter it here within 10 minutes.`)).toBeVisible();
    await expect(s.getByText(/no account yet/)).toHaveCount(0);

    // Nothing exists until the code is verified; the code itself is only stored hashed.
    const code = await latestCode(request, email);
    // The email says what entering the code will turn on.
    const mail = (await outbox(request)).find((m) => m.recipient === email && m.kind === 'login_code');
    expect(mail.body).toContain('Entering it also turns on monthly and holiday offers by email from Priyanshi.');
    const pending = await row(request, email);
    expect(pending.account).toBeNull();
    expect(pending.loginCode).toBeTruthy();
    expect(String(pending.loginCode!.code_hash)).not.toContain(code);
    expect(String(pending.loginCode!.code_hash)).not.toBe(sha256(code));
    expect(pending.loginCode!.pending_offers).toBe(1);

    const field = s.getByLabel('6-digit code');
    await expect(field).toHaveAttribute('inputmode', 'numeric');
    await expect(field).toHaveAttribute('autocomplete', 'one-time-code');
    await page.screenshot({ path: path.join(SHOTS, '1280-code.png') });
    await field.fill(code);
    await s.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(s.getByRole('heading', { name: 'Your account is ready' })).toBeFocused();
    await expect(s.getByTestId('account-email')).toHaveText(email);
    await expect(s.getByRole('switch', { name: CONSENT })).toHaveAttribute('aria-checked', 'true');
    // Straight after verifying: where offers stand, in words, and a Done button above Log out.
    await expect(s.getByTestId('account-offers-state')).toHaveText('Offers by email are on. You can turn them off below at any time.');
    const done = s.getByRole('button', { name: 'Done' });
    const logOut = s.getByRole('button', { name: 'Log out' });
    expect((await done.boundingBox())!.y).toBeLessThan((await logOut.boundingBox())!.y);
    await page.screenshot({ path: path.join(SHOTS, '1280-account.png') });
    await page.screenshot({ path: path.join(SHOTS, '1280-done.png') });

    const { account, loginCode } = await row(request, email);
    expect(loginCode).toBeNull();
    expect(account!.offers_opt_in).toBe(1);
    expect(account!.offers_consent_version).toBe(OFFERS_CONSENT.version);
    expect(String(account!.offers_consent_at)).toMatch(/^\d{4}-/);
    expect(Object.keys(account!).filter((k) => /name/.test(k))).toEqual([]);

    // Focus hand-off: the opener is gone, so Done hands focus to Account.
    await done.click();
    await expect(s).toHaveCount(0);
    await expect(page.locator('header').getByRole('button', { name: 'Account' })).toBeFocused();
    await expect(page.locator('header').getByRole('button', { name: 'Sign up' })).toHaveCount(0);

    // Opened again from the bar: no Done and no offers line, only the account view.
    await page.locator('header').getByRole('button', { name: 'Account' }).click();
    await expect(s.getByRole('heading', { name: 'Your account' })).toBeFocused();
    await expect(s.getByRole('button', { name: 'Done' })).toHaveCount(0);
    await expect(s.getByTestId('account-offers-state')).toHaveCount(0);
  });

  test('a sign-up without the box: the email and the view both say offers stay off', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const email = uniqueEmail('signup-off');
    await openHome(page);
    await page.locator('header').getByRole('button', { name: 'Sign up' }).click();
    const s = sheet(page);
    await s.getByLabel('Email', { exact: true }).fill(email);
    await s.getByRole('button', { name: 'Email me a code' }).click();
    const mail = (await outbox(request)).find((m) => m.recipient === email && m.kind === 'login_code');
    expect(mail.body).toContain('Offers by email stay off.');
    expect(mail.body).not.toContain('turns on');
    await s.getByLabel('6-digit code').fill(await latestCode(request, email));
    await s.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(s.getByTestId('account-offers-state')).toHaveText('Offers by email are off. You can turn them on below at any time.');
    await expect(s.getByRole('switch', { name: CONSENT })).toHaveAttribute('aria-checked', 'false');
  });

  test('log-in end to end, the toggle, and log-out hands focus to Log in', async ({ page, request, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const email = uniqueEmail('login');
    await apiSignUp(request, email);
    await request.post('/api/account/logout', { headers: { Origin: test.info().project.use.baseURL! }, data: {} });
    await resetAccountLimits(request);
    await request.post('/api/test/outbox/clear');

    await openHome(page);
    await page.locator('header').getByRole('button', { name: 'Log in' }).click();
    const s = sheet(page);
    await expect(s.getByRole('heading', { name: 'Log in' })).toBeFocused();
    await expect(s.getByRole('checkbox')).toHaveCount(0);
    await s.getByLabel('Email', { exact: true }).fill(email);
    await s.getByRole('button', { name: 'Email me a code' }).click();
    // Log-in wording: the email might say there is no account, so the sheet says so.
    await expect(s.getByText("If there's no account yet, the email will say so.", { exact: false })).toBeVisible();
    const mail = (await outbox(request)).find((m) => m.recipient === email && m.kind === 'login_code');
    expect(mail.body).not.toContain('Offers by email');
    expect(mail.body).not.toContain('turns on');
    await s.getByLabel('6-digit code').fill(await latestCode(request, email));
    await s.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(s.getByRole('heading', { name: "You're logged in" })).toBeFocused();

    // Flags as the browser sees them.
    const cookie = (await context.cookies()).find((c) => c.name === 'yp_session')!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/api', secure: false });
    expect(cookie.expires * 1000).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    // The server holds only the hash.
    const { sessionHashes, account } = await row(request, email);
    expect(sessionHashes).toContain(sha256(cookie.value));
    expect(sessionHashes).not.toContain(cookie.value);
    expect(account!.offers_opt_in).toBe(0);

    // The toggle follows the server: a refused update leaves it where it was.
    const toggle = s.getByRole('switch', { name: CONSENT });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.route('**/api/account/update', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Not saved."}' }), { times: 1 });
    await toggle.click();
    await expect(s.getByRole('alert')).toHaveText('Not saved.');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Keyboard: Space toggles, and focus stays on the switch while it saves and after. Only the switch
    // is busy: Log out keeps its own label.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/account/update', async (route) => {
      await held;
      await route.continue();
    }, { times: 1 });
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-disabled', 'true');
    await expect(toggle).toBeFocused();
    await expect(s.getByRole('button', { name: 'Log out' })).toBeVisible();
    await expect(s.getByText('One moment...')).toHaveCount(0);
    await page.keyboard.press('Space'); // ignored while saving
    release();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).not.toHaveAttribute('aria-disabled', 'true');
    await expect(toggle).toBeFocused();
    const on = (await row(request, email)).account!;
    expect(on.offers_opt_in).toBe(1);
    expect(on.offers_consent_version).toBe(OFFERS_CONSENT.version);
    expect(on.offers_opted_out_at).toBeNull();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    const off = (await row(request, email)).account!;
    expect(off.offers_opt_in).toBe(0);
    expect(off.offers_opted_out_at).toBeTruthy();

    await s.getByRole('button', { name: 'Log out' }).click();
    await expect(s).toHaveCount(0);
    const logIn = page.locator('header').getByRole('button', { name: 'Log in' });
    await expect(logIn).toBeFocused();
    expect(await page.evaluate(() => window.localStorage.getItem('yp_has_session'))).toBeNull();
    expect((await context.cookies()).find((c) => c.name === 'yp_session')).toBeUndefined();
  });

  test('"Send a new code" shows its wait, and "Use a different email" goes back', async ({ page, request }) => {
    const email = uniqueEmail('resend');
    await page.clock.install();
    await openHome(page);
    await page.locator('header').getByRole('button', { name: 'Sign up' }).click();
    const s = sheet(page);
    await s.getByLabel('Email', { exact: true }).fill(email);
    await s.getByRole('button', { name: 'Email me a code' }).click();
    await expect(s.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
    await expect(s.getByRole('button', { name: /Send a new code in \d+s/ })).toBeDisabled();
    const first = await latestCode(request, email);

    await page.clock.runFor(61_000);
    const resend = s.getByRole('button', { name: 'Send a new code', exact: true });
    await expect(resend).toBeEnabled();
    await resetAccountLimits(request); // the server's own 60-second window, which this clock can't move
    // While the new code is on its way only "Send a new code" shows progress, and the typed code stays.
    await s.getByLabel('6-digit code').fill('12');
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/account/request-code', async (route) => {
      await held;
      await route.continue();
    }, { times: 1 });
    await resend.click();
    await expect(s.getByRole('button', { name: 'Sending...' })).toBeVisible();
    await expect(s.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
    await expect(s.getByText('Checking...')).toHaveCount(0);
    await expect(s.getByLabel('6-digit code')).toHaveValue('12');
    release();
    await expect(s.getByRole('button', { name: /Send a new code in \d+s/ })).toBeDisabled();
    // Seen as well as heard, the code is cleared only now, and focus is in the code field.
    await expect(s.getByRole('status')).toHaveText('We sent a new code.');
    await expect(s.getByRole('status')).toBeVisible();
    await expect(s.getByLabel('6-digit code')).toHaveValue('');
    await expect(s.getByLabel('6-digit code')).toBeFocused();
    await expect.poll(async () => (await outbox(request)).filter((m) => m.recipient === email).length).toBe(2);
    const second = await latestCode(request, email);

    // The replaced code is dead, unless the two happen to match.
    if (first !== second) {
      await s.getByLabel('6-digit code').fill(first);
      await s.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(s.getByRole('alert')).toContainText("That code didn't work");
      const field = s.getByLabel('6-digit code');
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      // Focus goes to the field to fix, and the error sits between it and the button.
      await expect(field).toBeFocused();
      const alertBox = (await s.getByRole('alert').boundingBox())!;
      expect(alertBox.y).toBeGreaterThan((await field.boundingBox())!.y);
      expect(alertBox.y).toBeLessThan((await s.getByRole('button', { name: 'Continue', exact: true }).boundingBox())!.y);
      await page.screenshot({ path: path.join(SHOTS, '1280-error.png') });
    }

    await s.getByRole('button', { name: 'Use a different email' }).click();
    await expect(s.getByRole('heading', { name: 'Sign up' })).toBeFocused();
    await expect(s.getByLabel('Email', { exact: true })).toHaveValue(email);

    // The same email again inside the server's minute: the wait error goes away when the wait ends.
    await s.getByRole('button', { name: 'Email me a code' }).click();
    await expect(s.getByRole('alert')).toContainText(/Please wait \d+ seconds/);
    await page.clock.runFor(61_000);
    await expect(s.getByRole('alert')).toHaveCount(0);
  });

  test('the switch keeps keyboard focus, and the sheet can close while a code is checked', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const email = uniqueEmail('closed');
    await openHome(page);
    await page.locator('header').getByRole('button', { name: 'Sign up' }).click();
    const s = sheet(page);
    await s.getByLabel('Email', { exact: true }).fill(email);
    await s.getByRole('button', { name: 'Email me a code' }).click();
    await s.getByLabel('6-digit code').fill(await latestCode(request, email));
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/account/verify', async (route) => {
      await held;
      await route.continue();
    }, { times: 1 });
    await s.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(s.getByRole('button', { name: 'Checking...' })).toBeFocused();
    await expect(s.getByRole('button', { name: 'Send a new code', exact: false })).toHaveAttribute('aria-disabled', 'true');
    // Closed before the answer: once it comes, focus goes to Account, not to the page.
    await page.keyboard.press('Escape');
    await expect(s).toHaveCount(0);
    release();
    const accountButton = page.locator('header').getByRole('button', { name: 'Account' });
    await expect(accountButton).toBeVisible();
    await expect(accountButton).toBeFocused();
  });

  plainTest('a failed send shows the error and no code step', async ({ page, request }) => {
    await resetAccountLimits(request);
    await request.post('/api/test/email-fail', { data: { fail: true } });
    try {
      await page.goto('/');
      await page.locator('header').getByRole('button', { name: 'Sign up' }).click();
      const s = sheet(page);
      await s.getByLabel('Email', { exact: true }).fill(uniqueEmail('fail'));
      await s.getByRole('button', { name: 'Email me a code' }).click();
      await expect(s.getByRole('alert')).toContainText("couldn't send your email");
      await expect(s.getByRole('heading', { name: 'Enter your code' })).toHaveCount(0);
      await expect(s.getByRole('heading', { name: 'Sign up' })).toBeVisible();
    } finally {
      await request.post('/api/test/email-fail', { data: { fail: false } });
    }
  });

  test('wrong, malformed, expired and reused codes all get one message', async ({ request }) => {
    const email = uniqueEmail('codes');
    await accountPost(request, '/request-code', { intent: 'signup', email });
    const code = await latestCode(request, email);
    const wrong = code === '000000' ? '000001' : '000000';
    const messages = new Set<string>();
    const tryCode = async (value: string, status = 400) => {
      const res = await accountPost(request, '/verify', { email, code: value });
      expect(res.status()).toBe(status);
      const body = await res.json();
      if (status === 400) {
        messages.add(body.error);
        // No code, email or token in an error.
        const text = JSON.stringify(body);
        expect(text).not.toContain(email);
        expect(text).not.toContain(value);
      }
      return res;
    };
    await tryCode(wrong);
    await tryCode('abc');

    await request.post('/api/test/login-code-expire', { data: { email } });
    await tryCode(code);

    // Replaced: only the newest works; once used, it's gone.
    await resetAccountLimits(request);
    await accountPost(request, '/request-code', { intent: 'signup', email });
    const fresh = await latestCode(request, email);
    await tryCode(fresh, 200);
    await tryCode(fresh);
    expect(messages.size).toBe(1);
  });

  test('the sixth attempt fails even with the right code', async ({ request }) => {
    const email = uniqueEmail('attempts');
    await accountPost(request, '/request-code', { intent: 'signup', email });
    const code = await latestCode(request, email);
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) expect((await accountPost(request, '/verify', { email, code: wrong })).status()).toBe(400);
    expect((await accountPost(request, '/verify', { email, code })).status()).toBe(400);
    expect((await row(request, email)).account).toBeNull();
  });

  test('concurrent verifies have one winner', async ({ request }) => {
    const email = uniqueEmail('race');
    await accountPost(request, '/request-code', { intent: 'signup', email });
    const code = await latestCode(request, email);
    const results = await Promise.all([1, 2, 3, 4].map(() => accountPost(request, '/verify', { email, code })));
    expect(results.map((r) => r.status()).sort()).toEqual([200, 400, 400, 400]);
    expect((await row(request, email)).sessionHashes).toHaveLength(1);
  });

  test('the code is 6 digits, in the outbox, and the email ref is a random id', async ({ request }) => {
    const email = uniqueEmail('ref');
    await accountPost(request, '/request-code', { intent: 'signup', email });
    const [mail] = (await outbox(request)).filter((m) => m.recipient === email);
    expect(mail.kind).toBe('login_code');
    expect(mail.type).toBe('student_account');
    expect(mail.body).toMatch(/\b\d{6}\b/);
    expect(mail.ref).toMatch(/^[0-9a-f-]{36}$/);
    expect(mail.ref).not.toContain(email);
    expect(mail.headers).toBeUndefined();
  });
});

test.describe('no enumeration', () => {
  test('all four branches answer alike and send exactly one email', async ({ request }) => {
    const existing = uniqueEmail('enum-existing');
    await apiSignUp(request, existing);
    await request.post('/api/test/outbox/clear');
    const before = (await row(request, existing)).account!;

    const cases = [
      { intent: 'signup', email: uniqueEmail('enum-new'), kind: 'login_code' },
      { intent: 'signup', email: existing, kind: 'login_code', offersOptIn: true },
      { intent: 'login', email: existing, kind: 'login_code' },
      { intent: 'login', email: uniqueEmail('enum-unknown'), kind: 'login_no_account' },
    ];
    for (const c of cases) {
      await resetAccountLimits(request);
      await request.post('/api/test/outbox/clear');
      const res = await accountPost(request, '/request-code', { intent: c.intent, email: c.email, offersOptIn: c.offersOptIn });
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual(SENT);
      const mails = (await outbox(request)).filter((m) => m.recipient === c.email);
      expect(mails.map((m) => m.kind)).toEqual([c.kind]);
    }
    const unknown = cases[3];
    const r = await row(request, unknown.email);
    expect(r.account).toBeNull();
    expect(r.loginCode).toBeNull();
    const [mail] = await outbox(request);
    expect(mail.body).not.toMatch(/\b\d{6}\b/);

    // The tick is ignored for an existing account.
    await accountPost(request, '/verify', { email: existing, code: 'nope' });
    await resetAccountLimits(request);
    await accountPost(request, '/request-code', { intent: 'signup', email: existing, offersOptIn: true });
    await accountPost(request, '/verify', { email: existing, code: await latestCode(request, existing) });
    expect((await row(request, existing)).account!.offers_opt_in).toBe(before.offers_opt_in);
  });

  test('the honeypot looks like success, stores nothing and sends nothing', async ({ request }) => {
    const email = uniqueEmail('honey');
    const before = await capInfo(request);
    const res = await accountPost(request, '/request-code', { intent: 'signup', email, website: 'http://spam.example' });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual(SENT);
    expect((await row(request, email)).loginCode).toBeNull();
    expect((await outbox(request)).filter((m) => m.recipient === email)).toEqual([]);
    expect((await capInfo(request)).count).toBe(before.count);
  });
});

test.describe('limits', () => {
  test('one email a minute: the 429 names the wait and leaves the global counter alone', async ({ request }) => {
    const email = uniqueEmail('minute');
    expect((await accountPost(request, '/request-code', { intent: 'signup', email })).status()).toBe(200);
    const charged = (await capInfo(request)).count;
    expect(charged).toBe(1);
    const res = await accountPost(request, '/request-code', { intent: 'signup', email });
    expect(res.status()).toBe(429);
    expect((await res.json()).error).toMatch(/wait \d+ seconds/);
    expect((await capInfo(request)).count).toBe(charged);
    expect((await outbox(request)).filter((m) => m.recipient === email)).toHaveLength(1);
  });

  test('5 an hour and 10 a day per email', async ({ request }) => {
    const email = uniqueEmail('windows');
    const send = () => accountPost(request, '/request-code', { intent: 'signup', email });
    const clear = (scopes: string[]) => request.post('/api/test/account-limits-reset', { data: { email, scopes } });
    for (let i = 0; i < 5; i++) {
      expect((await send()).status(), `request ${i + 1}`).toBe(200);
      await clear(['email-minute']);
    }
    const sixth = await send();
    expect(sixth.status()).toBe(429);
    expect((await sixth.json()).error).toBe('Too many codes for this email. Please try again later.');

    await clear(['email-minute', 'email-hour']);
    for (let i = 0; i < 5; i++) {
      expect((await send()).status(), `request ${i + 6}`).toBe(200);
      await clear(['email-minute', 'email-hour']);
    }
    expect((await send()).status()).toBe(429);
  });

  test('20 code requests and 60 verifies an hour per IP', async ({ request }) => {
    for (let i = 0; i < 20; i++) {
      expect((await accountPost(request, '/request-code', { intent: 'login', email: uniqueEmail(`ip${i}`) })).status(), `request ${i + 1}`).toBe(200);
    }
    const over = await accountPost(request, '/request-code', { intent: 'login', email: uniqueEmail('ip-over') });
    expect(over.status()).toBe(429);
    expect((await over.json()).error).not.toMatch(/\d{1,3}\.\d{1,3}/);

    const email = uniqueEmail('verify-ip');
    for (let i = 0; i < 60; i++) expect((await accountPost(request, '/verify', { email, code: '123456' })).status()).toBe(400);
    expect((await accountPost(request, '/verify', { email, code: '123456' })).status()).toBe(429);
  });

  test('the global cap: 503, no email in any branch, and booking mail still goes', async ({ request }) => {
    const existing = uniqueEmail('cap-existing');
    await apiSignUp(request, existing);
    await resetAccountLimits(request);
    await capInfo(request, 2);
    expect((await accountPost(request, '/request-code', { intent: 'signup', email: uniqueEmail('cap1') })).status()).toBe(200);
    expect((await accountPost(request, '/request-code', { intent: 'login', email: uniqueEmail('cap2') })).status()).toBe(200);
    expect((await capInfo(request)).count).toBe(2);
    await request.post('/api/test/outbox/clear');

    for (const data of [
      { intent: 'signup', email: uniqueEmail('cap3') },
      { intent: 'signup', email: existing },
      { intent: 'login', email: existing },
      { intent: 'login', email: uniqueEmail('cap4') },
    ]) {
      const res = await accountPost(request, '/request-code', data);
      expect(res.status()).toBe(503);
      expect((await res.json()).code).toBe('account_email_cap');
    }
    expect(await outbox(request)).toEqual([]);
    expect((await capInfo(request)).count).toBe(2);

    const student = uniqueEmail('cap-booking');
    const { res } = await apiBook(request, { email: student });
    expect(res.status()).toBe(201);
    expect((await outbox(request)).filter((m) => m.recipient === student).map((m) => m.kind)).toEqual(['booking_confirmation']);
  });

  plainTest('when the cap is hit the sheet shows the reason and no code step', async ({ page, request }) => {
    await resetAccountLimits(request);
    await capInfo(request, 0);
    await page.goto('/');
    await page.locator('header').getByRole('button', { name: 'Log in' }).click();
    const s = sheet(page);
    await s.getByLabel('Email', { exact: true }).fill(uniqueEmail('cap-ui'));
    await s.getByRole('button', { name: 'Email me a code' }).click();
    await expect(s.getByRole('alert')).toContainText("can't send account emails");
    await expect(s.getByRole('heading', { name: 'Enter your code' })).toHaveCount(0);
    await resetAccountLimits(request);
  });

  test('expired rows are purged in bounded batches, and only by requests the limits let through', async ({ request }) => {
    await request.post('/api/test/account-seed-expired', { data: { count: 150 } });
    const before = await counts(request);
    const email = uniqueEmail('purge');
    await accountPost(request, '/request-code', { intent: 'signup', email });
    const after = await counts(request);
    expect(before.account_sessions - after.account_sessions).toBe(100);
    expect(before.login_codes - after.login_codes).toBe(99); // 100 gone, one new
    expect(before.rate_limits - after.rate_limits).toBeLessThanOrEqual(100);
    expect(before.rate_limits - after.rate_limits).toBeGreaterThanOrEqual(90);
    // The same email inside its minute: turned away, and it purges nothing.
    expect((await accountPost(request, '/request-code', { intent: 'signup', email })).status()).toBe(429);
    expect((await counts(request)).account_sessions).toBe(after.account_sessions);
    await accountPost(request, '/request-code', { intent: 'signup', email: uniqueEmail('purge2') });
    const last = await counts(request);
    expect(after.account_sessions - last.account_sessions).toBe(50);
  });
});

test.describe('the session', () => {
  test('sessionCookie() in both modes', () => {
    const token = 'a'.repeat(64);
    const dev = sessionCookie(token, { secure: false });
    expect(dev).toBe(`yp_session=${token}; Max-Age=2592000; Path=/api; HttpOnly; SameSite=Lax`);
    const prod = sessionCookie(token, { secure: true });
    expect(prod).toBe(`${dev}; Secure`);
    expect(clearedSessionCookie({ secure: true })).toBe('yp_session=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax; Secure');
  });

  test('/me, update and log-out; a session dies on log-out and on expiry; no-store', async ({ request }) => {
    const email = uniqueEmail('session');
    const anon = await request.get('/api/account/me');
    expect(await anon.json()).toEqual({ account: null });
    expect(anon.headers()['cache-control']).toBe('no-store');
    expect((await accountPost(request, '/update', { offersOptIn: true })).status()).toBe(401);

    const verified = await apiSignUp(request, email);
    expect(await verified.json()).toEqual({ account: { email, offersOptIn: false }, created: true });
    expect(verified.headers()['set-cookie']).toMatch(/^yp_session=[0-9a-f]{64}; Max-Age=2592000; Path=\/api; HttpOnly; SameSite=Lax$/);
    expect(verified.headers()['cache-control']).toBe('no-store');
    expect(await (await request.get('/api/account/me')).json()).toEqual({ account: { email, offersOptIn: false } });
    expect((await accountPost(request, '/update', { offersOptIn: 'yes' })).status()).toBe(400);
    expect(await (await accountPost(request, '/update', { offersOptIn: true })).json()).toEqual({ account: { email, offersOptIn: true } });

    // Expired: answers as logged out.
    await request.post('/api/test/account-session-expire', { data: { email } });
    expect(await (await request.get('/api/account/me')).json()).toEqual({ account: null });

    // A fresh log-in, then log-out kills it on the server too: the old cookie can't come back.
    await resetAccountLimits(request);
    await accountPost(request, '/request-code', { intent: 'login', email });
    const again = await accountPost(request, '/verify', { email, code: await latestCode(request, email) });
    const stale = again.headers()['set-cookie'].split(';')[0];
    expect((await accountPost(request, '/logout', {})).status()).toBe(200);
    const replay = await request.get('/api/account/me', { headers: { Cookie: stale } });
    expect(await replay.json()).toEqual({ account: null });
  });

  test('CSRF: foreign Origin 403, missing Origin 403, non-JSON 415, on every write', async ({ request }) => {
    for (const p of ['/request-code', '/verify', '/update', '/logout']) {
      const url = `/api/account${p}`;
      expect((await request.post(url, { headers: { Origin: 'https://evil.example' }, data: {} })).status(), url).toBe(403);
      expect((await request.post(url, { data: {} })).status(), url).toBe(403);
      const form = await request.post(url, { headers: { Origin: test.info().project.use.baseURL! }, form: { a: '1' } });
      expect(form.status(), url).toBe(415);
    }
  });

  test('IPv6 is counted by its /64, IPv4 by the address', () => {
    expect(ipSubject('203.0.113.7')).toBe('203.0.113.7');
    expect(ipSubject('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(ipSubject('2001:db8:abcd:12:1:2:3:4')).toBe('2001:db8:abcd:12::/64');
    expect(ipSubject('2001:DB8:abcd:0012::99')).toBe('2001:db8:abcd:12::/64');
    expect(ipSubject('2001:db8:abcd:12:ffff::1')).toBe(ipSubject('2001:db8:abcd:12::2'));
    expect(ipSubject('2001:db8:abcd:13::1')).not.toBe(ipSubject('2001:db8:abcd:12::1'));
    expect(ipSubject('fe80::1%en0')).toBe('fe80:0:0:0::/64');
  });

  test('an ACCOUNT_SECRET under 32 characters counts as not set', () => {
    expect(accountSecretFrom(undefined)).toBeNull();
    expect(accountSecretFrom('x'.repeat(31))).toBeNull();
    expect(accountSecretFrom('x'.repeat(32))).toBe('x'.repeat(32));
  });

  test('the production site URL is the one in the page metadata', () => {
    expect(PRODUCTION_SITE_URL).toBe(SITE_URL);
  });
});

test.describe('at 375px, touch', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('the sheet: no overflow, 44px targets, 16px inputs, focus on the toggle after log-in and log-out', async ({ page, request }) => {
    const email = uniqueEmail('phone');
    await openHome(page);
    await page.getByLabel('Toggle Navigation Menu').tap();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Sign up' }).tap();
    const s = sheet(page);
    await expect(s.getByRole('heading', { name: 'Sign up' })).toBeVisible();
    const overflow = () => s.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    const fontSize = (el: Locator) => el.evaluate((n) => getComputedStyle(n).fontSize);
    expect(await fontSize(s.getByLabel('Email', { exact: true }))).toBe('16px');
    await minTarget(s.getByLabel('Email', { exact: true }));
    await minTarget(s.getByRole('button', { name: 'Email me a code' }));
    await minTarget(s.getByRole('button', { name: /Already have an account/ }));
    await minTarget(s.getByLabel('Close account window', { exact: true }));
    await minTarget(s.locator('label[for="account-offers"]'));
    await page.screenshot({ path: path.join(SHOTS, '375-sign-up.png') });

    await s.getByLabel('Email', { exact: true }).fill(email);
    await s.getByRole('button', { name: 'Email me a code' }).tap();
    const field = s.getByLabel('6-digit code');
    await expect(field).toBeVisible();
    expect(await fontSize(field)).toBe('16px');
    await minTarget(field);
    await minTarget(s.getByRole('button', { name: /Send a new code/ }));
    await minTarget(s.getByRole('button', { name: 'Use a different email' }));
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(SHOTS, '375-code.png') });

    await field.fill(await latestCode(request, email));
    await s.getByRole('button', { name: 'Continue', exact: true }).tap();
    const toggle = s.getByRole('switch', { name: CONSENT });
    await expect(toggle).toBeVisible();
    await minTarget(toggle);
    await minTarget(s.getByRole('button', { name: 'Log out' }));
    expect(await overflow()).toBeLessThanOrEqual(0);
    await minTarget(s.getByRole('button', { name: 'Done' }));
    await page.screenshot({ path: path.join(SHOTS, '375-account.png') });

    await page.keyboard.press('Escape');
    await expect(s).toHaveCount(0);
    const menuToggle = page.getByLabel('Toggle Navigation Menu');
    await expect(menuToggle).toBeFocused();

    await menuToggle.tap();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Account' }).tap();
    await s.getByRole('button', { name: 'Log out' }).tap();
    await expect(s).toHaveCount(0);
    await expect(menuToggle).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test('WhatsApp hides while the sheet is open, and comes back after', async ({ page }) => {
    await openHome(page);
    const chat = page.getByTestId('whatsapp-chat');
    // The button waits until the hero has left the screen (owner request 2026-11-14).
    await page.evaluate(() => {
      const h = document.getElementById('home');
      window.scrollTo(0, (h?.offsetTop ?? 0) + (h?.offsetHeight ?? 0) + 40);
    });
    await expect(chat).toBeVisible();
    await page.getByLabel('Toggle Navigation Menu').tap();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Log in' }).tap();
    await expect(sheet(page).getByRole('heading', { name: 'Log in' })).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await expect(chat).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
    await expect(chat).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the sheet works with reduced motion, and the switch has no transition', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await logInBrowser(page, uniqueEmail('calm'));
    await page.goto('/');
    await page.locator('header').getByRole('button', { name: 'Account' }).click();
    const s = sheet(page);
    await expect(s.getByRole('heading', { name: 'Your account' })).toBeFocused();
    const knob = s.getByRole('switch').locator('span span');
    expect(await knob.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe('none');
  });
});

test('opening the sheet cancels a quiz still waiting for its chunk', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/ClassFinderModal*', async (route) => {
    await held;
    await route.continue();
  });
  await openHome(page);
  await page.locator('#home').getByRole('button', { name: 'Find your class' }).click();
  await page.locator('header').getByRole('button', { name: 'Log in' }).click();
  await expect(sheet(page).getByRole('heading', { name: 'Log in' })).toBeVisible();
  release();
  await page.waitForTimeout(600);
  await expect(page.getByRole('dialog', { name: 'Find your class' })).toHaveCount(0);
  await expect(sheet(page)).toBeVisible();
});
