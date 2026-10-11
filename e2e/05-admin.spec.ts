import { test, expect, stepShooter, openHome, apiBook, uniqueEmail } from './helpers';
import { TEST_ADMIN_PASSWORD } from './test-admin';

const FEATURE = 'admin';
const PASSWORD = TEST_ADMIN_PASSWORD;

const adminModal = (page: import('@playwright/test').Page) =>
  page.locator('div.fixed.inset-0').filter({ hasText: /Instructor Portal|Studio Overview/ });

test('admin login, dashboard metrics, settings and logout', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await apiBook(page.request, { planKey: 'single' });
  const contact = await page.request.post('/api/contact', {
    data: { name: 'Dashboard Tester', email: uniqueEmail('dash'), interest: 'Hatha Yoga', message: 'Hello from the admin test.' },
  });
  expect(contact.status()).toBe(200);

  await openHome(page);
  await page.locator('header').getByRole('button', { name: 'Admin' }).click();
  const modal = adminModal(page);
  await expect(modal.getByText('Instructor Portal')).toBeVisible();
  await shot('login');

  await modal.getByPlaceholder('Enter studio password...').fill('wrong-password');
  await modal.getByRole('button', { name: 'Sign In' }).click();
  await expect(modal.getByText(/Invalid admin password\. \(4 attempts remaining/)).toBeVisible();
  await shot('wrong-password');

  await modal.getByPlaceholder('Enter studio password...').fill(PASSWORD);
  await modal.getByRole('button', { name: 'Sign In' }).click();
  await expect(modal.getByText("Priyanshi's Studio Overview")).toBeVisible();
  await expect(modal.getByText('Total Revenue')).toBeVisible();
  await expect(modal.getByText('Earnings — Last 6 Months (AED)')).toBeVisible();
  await expect(modal.locator('table tbody tr')).toHaveCount(10);
  await expect(modal.getByText('Dashboard Tester')).toBeVisible();
  await shot('dashboard');
  await shot('dashboard-full', { fullPage: true });

  const upcoming = modal.getByText('Upcoming Bookings').locator('xpath=..');
  await expect(upcoming).not.toContainText(/^Upcoming Bookings\s*0/);

  const notify = modal.locator('input[type="email"]');
  await notify.fill('alerts@yogapriyanshi.com');
  await modal.getByRole('button', { name: 'Persist Settings' }).click();
  await expect(modal.getByText('Settings updated successfully.')).toBeVisible();
  await shot('settings-saved');

  // session survives a reload (token in localStorage) and settings persisted server-side
  await page.reload();
  await page.locator('header').getByRole('button', { name: 'Admin' }).click();
  await expect(modal.locator('input[type="email"]')).toHaveValue('alerts@yogapriyanshi.com');
  await shot('after-reload');

  await modal.getByRole('button', { name: 'Logout' }).click();
  await expect(modal.getByText('Instructor Portal')).toBeVisible();
  await shot('logged-out');
});

test('stats are real numbers and settings are validated and used for alerts', async ({ request }) => {
  const login = await request.post('/api/admin/login', { data: { password: PASSWORD } });
  expect(login.status()).toBe(200);
  const token = (await login.json()).token as string;
  const auth = { Authorization: `Bearer ${token}` };

  const stats = await (await request.get('/api/admin/stats', { headers: auth })).json();
  // nothing is paid until real payments exist, so revenue is honestly zero
  expect(stats.totalRevenueAed).toBe(0);
  expect(stats.earnings6Months).toHaveLength(6);
  for (const m of stats.earnings6Months) {
    expect(m.month).toMatch(/^[A-Z][a-z]{2}$/);
    expect(m.amountAed).toBe(0);
  }
  expect(stats.totalClients).toBeGreaterThan(0);
  expect(stats.upcomingBookingsCount).toBeGreaterThan(0);
  expect(stats.upcomingSessions.length).toBeLessThanOrEqual(10);
  expect(stats.recentMessages.length).toBeLessThanOrEqual(10);
  expect(stats.bookings.length).toBeLessThanOrEqual(20);
  expect(stats.bookings.every((b: any) => b.paymentStatus !== 'paid')).toBe(true);

  const badEmail = await request.post('/api/admin/settings', { headers: auth, data: { notificationEmail: 'not-an-email' } });
  expect(badEmail.status()).toBe(400);
  const badLink = await request.post('/api/admin/settings', { headers: auth, data: { googleDriveLink: 'javascript:alert(1)' } });
  expect(badLink.status()).toBe(400);
  const httpLink = await request.post('/api/admin/settings', { headers: auth, data: { googleDriveLink: 'http://example.com' } });
  expect(httpLink.status()).toBe(400);

  const notify = 'studio-alerts@example.com';
  const saved = await request.post('/api/admin/settings', {
    headers: auth,
    data: { notificationEmail: notify, googleDriveLink: 'https://docs.google.com/spreadsheets/d/e2e' },
  });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).settings).toEqual({
    notificationEmail: notify,
    googleDriveLink: 'https://docs.google.com/spreadsheets/d/e2e',
  });

  // the next booking alert goes to the new address
  const student = uniqueEmail('notify');
  const { res, body } = await apiBook(request, { email: student, planKey: 'single' });
  expect(res.status()).toBe(201);
  const { emails } = await (await request.get('/api/test/outbox')).json();
  const alert = emails.find((e: any) => e.kind === 'booking_alert' && e.replyTo === student);
  expect(alert, 'booking alert').toBeTruthy();
  expect(alert.recipient).toBe(notify);
  expect(alert.body).toContain(body.booking.bookingToken);

  const out = await request.post('/api/admin/logout', { headers: auth });
  expect(out.status()).toBe(200);
  expect((await request.get('/api/admin/stats', { headers: auth })).status()).toBe(401);
});

test('admin API rejects requests without a valid token', async ({ request }) => {
  expect((await request.get('/api/admin/stats')).status()).toBe(401);
  expect((await request.get('/api/admin/stats', { headers: { Authorization: 'Bearer bogus' } })).status()).toBe(401);
  expect((await request.post('/api/admin/settings', { data: { notificationEmail: 'x@y.z' } })).status()).toBe(401);
});

test('simultaneous wrong passwords never get more than 5 tries', async ({ request }) => {
  await request.post('/api/test/admin-unlock');
  // 8 guesses at once: each claims an attempt before the password check, so only 5 are ever checked.
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) => request.post('/api/admin/login', { data: { password: `parallel-bad-${i}` } }))
  );
  const bodies = await Promise.all(results.map(async (r) => ({ status: r.status(), error: (await r.json()).error as string })));
  expect(bodies.filter((b) => b.status === 401)).toHaveLength(4);
  expect(bodies.filter((b) => /^5 consecutive failed attempts/.test(b.error))).toHaveLength(1);
  expect(bodies.filter((b) => /locked for security/.test(b.error))).toHaveLength(3);
  expect(bodies.every((b) => b.status === 401 || b.status === 429)).toBe(true);

  // locked: even the right password is refused
  const right = await request.post('/api/admin/login', { data: { password: PASSWORD } });
  expect(right.status()).toBe(429);
  await request.post('/api/test/admin-unlock');
});

// Keep last: locks the admin portal for 15 minutes on this server instance.
test('admin portal locks after 5 failed attempts', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  await page.getByRole('button', { name: 'Admin Dashboard Portal' }).click();
  const modal = adminModal(page);
  for (let i = 0; i < 5; i++) {
    await modal.getByPlaceholder('Enter studio password...').fill(`bad-${i}`);
    await modal.getByRole('button', { name: 'Sign In' }).click();
    await expect(modal.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  }
  await expect(modal.getByText(/locked for 15 minutes/)).toBeVisible();
  await shot('locked');

  await modal.getByPlaceholder('Enter studio password...').fill(PASSWORD);
  await modal.getByRole('button', { name: 'Sign In' }).click();
  await expect(modal.getByText(/locked for security/)).toBeVisible();
  await expect(modal.getByText("Priyanshi's Studio Overview")).toHaveCount(0);
  await shot('correct-password-still-locked');
});
