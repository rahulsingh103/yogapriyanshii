import { test, expect, stepShooter, openHome, uniqueEmail } from './helpers';
import { TEST_ADMIN_PASSWORD } from './test-admin';

const FEATURE = 'contact';

async function adminToken(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/admin/login', { data: { password: TEST_ADMIN_PASSWORD } });
  expect(res.status()).toBe(200);
  return (await res.json()).token as string;
}

async function openContact(page: import('@playwright/test').Page) {
  await openHome(page);
  const section = page.locator('#contact');
  await section.scrollIntoViewIfNeeded();
  await section.getByRole('button', { name: 'Contact Priyanshi' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByPlaceholder('e.g. Sarah Jenkins')).toBeVisible();
  return dialog;
}

test('contact form sends a message that reaches the admin inbox', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('contact');
  const contact = await openContact(page);
  await shot('empty-form');

  // an empty submit is blocked: a summary alert, and each required field is marked and explained
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByText('Message Sent')).toHaveCount(0);
  await expect(contact.getByRole('alert')).toHaveText('Please fill in all required fields.');
  const nameField = contact.getByPlaceholder('e.g. Sarah Jenkins');
  await expect(nameField).toHaveAttribute('aria-invalid', 'true');
  await expect(nameField).toHaveAccessibleDescription('Please enter your name.');
  await expect(nameField).toBeFocused();
  await shot('empty-submit-errors');

  await contact.getByPlaceholder('e.g. Sarah Jenkins').fill('Contact Tester');
  await contact.getByPlaceholder('sarah@example.com').fill(email);
  await contact.getByLabel('Area of Interest').selectOption('Wheel Yoga');
  await contact.getByPlaceholder(/Tell Priyanshi/).fill('Is the Wheel class OK for beginners?');
  await shot('filled-form');
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByText('Message Sent')).toBeVisible();
  await expect(contact.getByRole('heading', { name: 'Message Sent' })).toBeFocused();
  await shot('sent');

  const token = await adminToken(page.request);
  const stats = await (await page.request.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })).json();
  const msg = stats.recentMessages.find((m: any) => m.email === email);
  expect(msg).toBeTruthy();
  expect(msg.interest).toBe('Wheel Yoga');
  expect(msg.phone).toBeNull();

  // the studio was alerted, with replies going straight to the student
  const { emails } = await (await page.request.get('/api/test/outbox')).json();
  const alert = emails.find((e: any) => e.kind === 'contact_alert' && e.replyTo === email);
  expect(alert, 'contact alert email').toBeTruthy();
  expect(alert.recipient).toBe('nbsingh2050@gmail.com');
  expect(alert.body).toContain('Is the Wheel class OK for beginners?');
  expect(alert.body).not.toContain('Phone:');

  await contact.getByRole('button', { name: 'Send Another Message' }).click();
  await expect(contact.getByPlaceholder('e.g. Sarah Jenkins')).toHaveValue('');
});

test('a phone number is optional, and when given it reaches the alert and the admin dashboard', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  const email = uniqueEmail('phone');
  const digits = String(Date.now()).slice(-7); // unique per run, so the dashboard link is unambiguous
  const phone = `+971 50 ${digits}`;
  const contact = await openContact(page);
  await contact.getByPlaceholder('e.g. Sarah Jenkins').fill('Phone Tester');
  await contact.getByPlaceholder('sarah@example.com').fill(email);
  await expect(contact.getByLabel('Phone (optional)')).toHaveAttribute('type', 'tel');

  // the server rejects a bad number with a clear message
  await contact.getByLabel('Phone (optional)').fill('call me maybe');
  await contact.getByPlaceholder(/Tell Priyanshi/).fill('Do you teach privately?');
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByRole('alert')).toHaveText('Please enter a valid phone number, or leave it empty.');
  await shot('bad-phone');

  await contact.getByLabel('Phone (optional)').fill(phone);
  await shot('filled-with-phone');
  await contact.getByRole('button', { name: 'Send Message' }).click();
  await expect(contact.getByText('Message Sent')).toBeVisible();

  const { emails } = await (await page.request.get('/api/test/outbox')).json();
  const alert = emails.find((e: any) => e.kind === 'contact_alert' && e.replyTo === email);
  expect(alert, 'contact alert email').toBeTruthy();
  expect(alert.body).toContain(`• Phone: ${phone}`);

  // Priyanshi sees it in the dashboard as a tap-to-call link
  const token = await adminToken(page.request);
  await page.evaluate((t) => localStorage.setItem('yp_admin_token', t), token);
  await page.reload(); // the dashboard reads its saved session when the page loads
  await page.locator('footer').getByRole('button', { name: 'Studio admin' }).click();
  const admin = page.getByRole('dialog', { name: "Priyanshi's Studio Overview" });
  await expect(admin.getByRole('link', { name: phone })).toHaveAttribute('href', `tel:+97150${digits}`);
  await shot('admin-phone');
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

test('contact API validates the optional phone and accepts the new class interests (incl. Private Aerial Yoga)', async ({ request }) => {
  for (const phone of ['abc', '1'.repeat(40), '+971 50\n123 4567', '12345']) {
    const res = await request.post('/api/contact', {
      data: { name: 'Phone Check', email: uniqueEmail('badphone'), message: 'hi', phone },
    });
    expect(res.status(), `phone ${JSON.stringify(phone)}`).toBe(400);
    expect((await res.json()).error).toBe('Please enter a valid phone number, or leave it empty.');
  }
  for (const interest of [
    'Spine Healing',
    'Mobility Yoga',
    'Yin Yoga',
    'Prenatal & Postnatal',
    'Vinyasa Yoga',
    'Ashtanga Yoga',
    'Private Aerial Yoga',
  ]) {
    const res = await request.post('/api/contact', {
      data: { name: 'Interest Check', email: uniqueEmail('interest'), message: 'hi', interest },
    });
    expect(res.status(), interest).toBe(200);
  }
});

test('a message without a phone is stored with no phone, and the alert has no phone line', async ({ request }) => {
  const email = uniqueEmail('nophone');
  const res = await request.post('/api/contact', {
    data: { name: 'No Phone', email, message: 'Email me, please.', phone: '' },
  });
  expect(res.status()).toBe(200);

  const token = await adminToken(request);
  const stats = await (await request.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })).json();
  const msg = stats.recentMessages.find((m: any) => m.email === email);
  expect(msg).toBeTruthy();
  expect(msg.phone).toBeNull();

  const { emails } = await (await request.get('/api/test/outbox')).json();
  const alert = emails.find((e: any) => e.kind === 'contact_alert' && e.replyTo === email);
  expect(alert, 'contact alert email').toBeTruthy();
  expect(alert.body).not.toContain('Phone:');
});
