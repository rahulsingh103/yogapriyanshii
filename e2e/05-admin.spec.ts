import { test, expect, stepShooter, openHome, apiBook } from './helpers';

const FEATURE = 'admin';
const PASSWORD = 'Priyanshi2026!';

const adminModal = (page: import('@playwright/test').Page) =>
  page.locator('div.fixed.inset-0').filter({ hasText: /Instructor Portal|Studio Overview/ });

test('admin login, dashboard metrics, settings and logout', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await apiBook(page.request, { planKey: 'single' });

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
  await expect(modal.getByText('Nour Al-Sabah')).toBeVisible();
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

test('admin API rejects requests without a valid token', async ({ request }) => {
  expect((await request.get('/api/admin/stats')).status()).toBe(401);
  expect((await request.get('/api/admin/stats', { headers: { Authorization: 'Bearer bogus' } })).status()).toBe(401);
  expect((await request.post('/api/admin/settings', { data: { notificationEmail: 'x@y.z' } })).status()).toBe(401);
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
