import { test, expect, stepShooter, openHome, uniqueEmail } from './helpers';

const FEATURE = 'contact';

async function adminToken(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/admin/login', { data: { password: 'Priyanshi2026!' } });
  expect(res.status()).toBe(200);
  return (await res.json()).token as string;
}

test('contact form sends a message that reaches the admin inbox', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('contact');
  await openHome(page);
  const contact = page.locator('#contact');
  await contact.scrollIntoViewIfNeeded();
  await shot('empty-form');

  // browser-level required validation blocks empty submit
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByText('Message Sent')).toHaveCount(0);

  await contact.getByPlaceholder('e.g. Sarah Jenkins').fill('Contact Tester');
  await contact.getByPlaceholder('sarah@example.com').fill(email);
  await contact.locator('select').selectOption('Wheel Yoga');
  await contact.getByPlaceholder(/Tell Priyanshi/).fill('Is the Wheel class OK for beginners?');
  await shot('filled-form');
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByText('Message Sent')).toBeVisible();
  await shot('sent');

  const token = await adminToken(page.request);
  const stats = await (await page.request.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })).json();
  const msg = stats.recentMessages.find((m: any) => m.email === email);
  expect(msg).toBeTruthy();
  expect(msg.interest).toBe('Wheel Yoga');

  await contact.getByRole('button', { name: 'Send Another Message' }).click();
  await expect(contact.getByPlaceholder('e.g. Sarah Jenkins')).toHaveValue('');
});

test('honeypot submissions are silently discarded', async ({ request }) => {
  const email = uniqueEmail('bot');
  const res = await request.post('/api/contact', {
    data: { name: 'Bot', email, message: 'spam', website: 'http://spam.example' },
  });
  expect(res.status()).toBe(200);
  const token = await adminToken(request);
  const stats = await (await request.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(stats.recentMessages.find((m: any) => m.email === email)).toBeUndefined();
});

test('contact API rejects missing fields', async ({ request }) => {
  const res = await request.post('/api/contact', { data: { name: 'Only name' } });
  expect(res.status()).toBe(400);
});
