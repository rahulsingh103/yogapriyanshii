import { test, expect, stepShooter, openHome, uniqueEmail } from './helpers';
import { TEST_ADMIN_PASSWORD } from './test-admin';

const FEATURE = 'contact';

async function adminToken(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/admin/login', { data: { password: TEST_ADMIN_PASSWORD } });
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

  // the studio was alerted, with replies going straight to the student
  const { emails } = await (await page.request.get('/api/test/outbox')).json();
  const alert = emails.find((e: any) => e.kind === 'contact_alert' && e.replyTo === email);
  expect(alert, 'contact alert email').toBeTruthy();
  expect(alert.recipient).toBe('nbsingh2050@gmail.com');
  expect(alert.body).toContain('Is the Wheel class OK for beginners?');

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

test('contact API rejects missing fields and bad input', async ({ request }) => {
  const res = await request.post('/api/contact', { data: { name: 'Only name' } });
  expect(res.status()).toBe(400);
  const badEmail = await request.post('/api/contact', { data: { name: 'A', email: 'nope', message: 'hi' } });
  expect(badEmail.status()).toBe(400);
  const badInterest = await request.post('/api/contact', {
    data: { name: 'A', email: uniqueEmail('interest'), message: 'hi', interest: '<script>' },
  });
  expect(badInterest.status()).toBe(400);
  const tooLong = await request.post('/api/contact', {
    data: { name: 'A', email: uniqueEmail('long'), message: 'x'.repeat(2001) },
  });
  expect(tooLong.status()).toBe(400);
});
