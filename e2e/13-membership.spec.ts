import path from 'path';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { test, expect, openHome, uniqueEmail } from './helpers';
import { TEST_ADMIN_PASSWORD } from './test-admin';

// Batch 3: the monthly membership. The Pricing card, the "Join the membership" contact sheet, the
// stored request, the alert, and the admin Members tab (New -> Contacted -> Active with a start date).

const SHOTS = path.join('.data', 'shots', 'batch3');
const MEMBERS = '/api/admin/members';
const PERKS = [
  '12 classes a month',
  'Recordings included (details shared when you join)',
  'In person in Dubai or live online',
];
const PLAN_LINE = '• Plan: 12-class monthly membership (AED 2,999 a month)';
const STALE = 'This request was updated elsewhere. Refresh to see the latest.';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today in Dubai as YYYY-MM-DD, the same way the server and the UI work it out. */
const dubaiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());

/** YYYY-MM-DD plus `days`. */
function addDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "25 Oct 2026", as the Members cards show dates. */
function formatDay(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Spec 05 locks the admin portal at its end, so every sign-in here unlocks first (test mode only). */
async function adminToken(request: APIRequestContext) {
  await request.post('/api/test/admin-unlock');
  const res = await request.post('/api/admin/login', { data: { password: TEST_ADMIN_PASSWORD } });
  expect(res.status()).toBe(200);
  return (await res.json()).token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A membership request through the public API; returns its id from the Members list. */
async function requestMembership(
  request: APIRequestContext,
  token: string,
  data: Record<string, unknown> = {}
): Promise<{ id: string; email: string; name: string }> {
  const email = uniqueEmail('member');
  const name = (data.name as string) ?? `Member ${email.slice(4, 22)}`;
  const res = await request.post('/api/contact', { data: { name, email, interest: 'Monthly membership', ...data } });
  expect(res.status(), await res.text()).toBe(200);
  const list = await (await request.get(`${MEMBERS}?page=1`, { headers: auth(token) })).json();
  const member = list.members.find((m: { email: string }) => m.email === email);
  expect(member, 'the new request is on page 1 (newest first)').toBeTruthy();
  return { id: member.id, email, name };
}

const update = (request: APIRequestContext, token: string, id: string, data: Record<string, unknown>) =>
  request.post(`${MEMBERS}/${id}`, { headers: auth(token), data });

async function openPricing(page: Page) {
  await openHome(page);
  const pricing = page.locator('#pricing');
  await pricing.scrollIntoViewIfNeeded();
  return pricing;
}

async function openJoin(page: Page) {
  const pricing = await openPricing(page);
  await pricing.getByTestId('membership-card').getByRole('button', { name: 'Join the membership' }).click();
  await expect(page.getByRole('dialog', { name: 'Join the membership' }).getByPlaceholder('e.g. Sarah Jenkins')).toBeVisible();
  // Unnamed from here on: on success the dialog takes the "Request Sent" heading as its name.
  return page.getByRole('dialog');
}

/** The element's opacity times every ancestor's: 1 once every fade has finished. */
const shownOpacity = (target: Locator) =>
  target.evaluate((el) => {
    let o = 1;
    for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  });

/** Waits until a sheet is fully shown and at rest, so a screenshot never catches it mid-arrival. */
async function settled(dialog: Locator) {
  await expect.poll(() => shownOpacity(dialog)).toBe(1);
  await expect
    .poll(() =>
      dialog.evaluate((el) => {
        const t = new DOMMatrix(getComputedStyle(el.parentElement!).transform);
        return t.m42 === 0 && t.a === 1;
      })
    )
    .toBe(true);
}

const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function openAdminSignedIn(page: Page, token: string) {
  await openHome(page);
  await page.evaluate((t) => localStorage.setItem('yp_admin_token', t), token);
  await page.reload(); // the dashboard reads its saved session when the page loads
  await page.locator('footer').getByRole('button', { name: 'Studio admin' }).click();
  const admin = page.getByRole('dialog', { name: "Priyanshi's Studio Overview" });
  await expect(admin.getByText('Total Revenue')).toBeVisible();
  return admin;
}

test('the Pricing card shows the membership copy, and the four plan rows are unchanged', async ({ page }) => {
  const pricing = await openPricing(page);
  const card = pricing.getByTestId('membership-card');
  await expect(card.getByRole('heading', { level: 3 })).toHaveText('Monthly membership');
  await expect(card).toContainText('AED 2,999');
  await expect(card).toContainText('a month');
  await expect(card.locator('li')).toHaveText(PERKS);
  // The CTA sits after the perks, outside every list item (spec 09 relies on `#pricing li button`).
  await expect(card.locator('li button')).toHaveCount(0);
  const cta = card.getByRole('button', { name: 'Join the membership' });
  await expect(cta).toBeVisible();
  // The owner ruled these out. Word-bounded, because the approved perk says "details shared".
  expect((await card.textContent()) ?? '').not.toMatch(/priority|\bshare(s|able)?\b|\bpacks?\b/i);

  for (const name of [/^Book First class\b.*Free/, /^Book Single class\b.*AED 350/, /^Book 10-class pack\b/, /^Book 20-class pack\b/]) {
    await expect(pricing.getByRole('button', { name })).toBeVisible();
  }
  await expect(pricing.locator('li button')).toHaveCount(4);
  await expect(pricing.locator('li button').first()).toHaveAccessibleName(/^Book First class/);
  await expect(pricing).toContainText('or online with the details Priyanshi sends after you book');

  // One accent: the perk ticks.
  const tick = card.locator('li svg').first();
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent-text').trim());
  expect(accent).not.toBe('');
  expect(await tick.evaluate((el) => getComputedStyle(el).color)).toBe(
    await page.evaluate((v) => {
      const probe = document.createElement('span');
      probe.style.color = v;
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    }, accent)
  );
});

test('"Join the membership" opens the contact sheet preset to the membership, and success offers WhatsApp', async ({ page }) => {
  const dialog = await openJoin(page);
  await expect(dialog.getByLabel('Area of Interest')).toHaveValue('Monthly membership');
  await expect(dialog).toContainText('12 classes a month for AED 2,999. Send your details and Priyanshi will reply within a day.');
  const times = dialog.getByLabel('Preferred days and times (optional)');
  await expect(times).toHaveAttribute('placeholder', 'e.g. Weekday mornings, or Saturdays');
  await expect(times).not.toHaveAttribute('required', '');

  // An empty submit marks name and email, never the optional preferred times.
  await dialog.getByRole('button', { name: 'Send Request' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please fill in all required fields.');
  await expect(dialog.getByPlaceholder('e.g. Sarah Jenkins')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByPlaceholder('sarah@example.com')).toHaveAttribute('aria-invalid', 'true');
  await expect(times).not.toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByPlaceholder('e.g. Sarah Jenkins')).toBeFocused();

  // The format is a two-segment group; tapping the pressed one clears it.
  const group = dialog.getByRole('group', { name: 'In person or online (optional)' });
  const inPerson = group.getByRole('button', { name: 'In person in Dubai' });
  const online = group.getByRole('button', { name: 'Live online' });
  await inPerson.click();
  await expect(inPerson).toHaveAttribute('aria-pressed', 'true');
  await inPerson.click();
  await expect(inPerson).toHaveAttribute('aria-pressed', 'false');
  await online.click();
  await expect(online).toHaveAttribute('aria-pressed', 'true');
  await expect(inPerson).toHaveAttribute('aria-pressed', 'false');

  const email = uniqueEmail('join');
  const name = '  Asha   Rao  ';
  await dialog.getByPlaceholder('e.g. Sarah Jenkins').fill(name);
  await dialog.getByPlaceholder('sarah@example.com').fill(email);
  await dialog.getByLabel('Phone (optional)').fill('+971 50 765 4321');
  await dialog.getByRole('button', { name: 'Send Request' }).click();
  await expect(dialog.getByRole('heading', { name: 'Request Sent' })).toBeFocused();
  await expect(dialog).toContainText('Thank you. Priyanshi will be in touch within 24 hours to set up your membership.');

  // WhatsApp carries the trimmed name and the plan only: no email and no phone digits.
  const wa = dialog.getByRole('link', { name: 'Continue on WhatsApp' });
  const href = (await wa.getAttribute('href'))!;
  expect(href).toMatch(/^https:\/\/wa\.me\/\d{8,15}\?text=/);
  const text = new URL(href).searchParams.get('text')!;
  expect(text).toBe("Hi Priyanshi, I'm Asha Rao and I've just asked to join the 12-class monthly membership (AED 2,999).");
  expect(text).not.toContain('@');
  expect(text).not.toMatch(/7654321|765|4321/);
  await expect(wa).toHaveAttribute('target', '_blank');
  await expect(wa).toHaveAttribute('rel', /noopener/);

  // The request reached the server as Live online.
  const token = await adminToken(page.request);
  const list = await (await page.request.get(`${MEMBERS}?page=1`, { headers: auth(token) })).json();
  const member = list.members.find((m: { email: string }) => m.email === email);
  // The server stores the name as typed (trimmed); only the WhatsApp prefill collapses the spaces.
  expect(member).toMatchObject({ name: 'Asha   Rao', format: 'online', status: 'new', preferredTimes: '' });

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  // A new request starts clean: the sent format is not still pressed.
  await page.locator('#pricing').getByTestId('membership-card').getByRole('button', { name: 'Join the membership' }).click();
  const again = page.getByRole('dialog', { name: 'Join the membership' });
  await expect(again.getByRole('button', { name: 'Live online' })).toHaveAttribute('aria-pressed', 'false');
  await expect(again.getByRole('button', { name: 'In person in Dubai' })).toHaveAttribute('aria-pressed', 'false');
});

test('membership mode follows the selected interest', async ({ page }) => {
  await openHome(page);
  const section = page.locator('#contact');
  await section.scrollIntoViewIfNeeded();
  await section.getByRole('button', { name: 'Contact Priyanshi' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Send a message' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'In person or online (optional)' })).toHaveCount(0);

  // Picking it from the list enters the mode...
  await dialog.getByLabel('Area of Interest').selectOption('Monthly membership');
  await expect(dialog.getByRole('heading', { name: 'Join the membership' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Live online' }).click();
  await expect(dialog.getByRole('button', { name: 'Send Request' })).toBeVisible();

  // ...and switching away clears the format and makes the message required again.
  await dialog.getByLabel('Area of Interest').selectOption('Hatha Yoga');
  await expect(dialog.getByRole('heading', { name: 'Send a message' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'In person or online (optional)' })).toHaveCount(0);
  await dialog.getByPlaceholder('e.g. Sarah Jenkins').fill('Mode Switch');
  await dialog.getByPlaceholder('sarah@example.com').fill(uniqueEmail('switch'));
  await dialog.getByRole('button', { name: 'Send Message' }).click();
  await expect(dialog.getByPlaceholder(/Tell Priyanshi/)).toHaveAttribute('aria-invalid', 'true');

  await dialog.getByLabel('Area of Interest').selectOption('Monthly membership');
  await expect(dialog.getByRole('button', { name: 'Live online' })).toHaveAttribute('aria-pressed', 'false');
});

test('an accepted request is stored with its message, alerts the studio and appears in Members', async ({ request }) => {
  const token = await adminToken(request);
  await request.post('/api/test/outbox/clear');
  const email = uniqueEmail('stored');
  const phone = '+971 50 222 3333';
  const res = await request.post('/api/contact', {
    data: { name: 'Stored Member', email, phone, interest: 'Monthly membership', format: 'online' },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ success: true, message: 'Thank you — Priyanshi will be in touch within 24 hours.' });

  const { emails } = await (await request.get('/api/test/outbox')).json();
  const alert = emails.find((e: { kind: string; replyTo?: string }) => e.kind === 'contact_alert' && e.replyTo === email);
  expect(alert, 'membership alert').toBeTruthy();
  expect(alert.subject).toBe('New message: Stored Member (Monthly membership)');
  expect(alert.body).toBe(`New message from the website contact form.

• Name: Stored Member
• Email: ${email}
• Phone: ${phone}
• Interest: Monthly membership
${PLAN_LINE}
• Format: Live online

No preferred times given.

Reply to this email to answer Stored Member directly.`);

  const stats = await (await request.get('/api/admin/stats', { headers: auth(token) })).json();
  const msg = stats.recentMessages.find((m: { email: string }) => m.email === email);
  expect(msg).toMatchObject({ interest: 'Monthly membership', message: '', phone });

  const list = await (await request.get(`${MEMBERS}?page=1`, { headers: auth(token) })).json();
  const member = list.members.find((m: { email: string }) => m.email === email);
  expect(member).toMatchObject({
    id: msg.id,
    name: 'Stored Member',
    phone,
    planKey: 'monthly12',
    planLabel: '12-class monthly membership',
    priceAed: 2999,
    format: 'online',
    preferredTimes: '',
    status: 'new',
    startDate: null,
  });
  expect(member.requestedAt).toBe(msg.createdAt);

  // With preferred times and no format: no Format line, and the times are the message.
  const email2 = uniqueEmail('times');
  await request.post('/api/contact', {
    data: { name: 'Times Member', email: email2, interest: 'Monthly membership', message: 'Weekday mornings', format: '' },
  });
  const { emails: after } = await (await request.get('/api/test/outbox')).json();
  const alert2 = after.find((e: { kind: string; replyTo?: string }) => e.kind === 'contact_alert' && e.replyTo === email2);
  expect(alert2.body).toContain(`• Interest: Monthly membership\n${PLAN_LINE}\n\nWeekday mornings\n`);
  expect(alert2.body).not.toContain('Format:');

  // Other interests: byte-identical to before, with no Plan line, and `format` is ignored.
  const email3 = uniqueEmail('plain');
  const plain = await request.post('/api/contact', {
    data: { name: 'Plain Sender', email: email3, interest: 'Hatha Yoga', message: 'Hello there.', format: 'zoom' },
  });
  expect(plain.status()).toBe(200);
  const { emails: last } = await (await request.get('/api/test/outbox')).json();
  const alert3 = last.find((e: { kind: string; replyTo?: string }) => e.kind === 'contact_alert' && e.replyTo === email3);
  expect(alert3.body).toBe(`New message from the website contact form.

• Name: Plain Sender
• Email: ${email3}
• Interest: Hatha Yoga

Hello there.

Reply to this email to answer Plain Sender directly.`);
  const all = await (await request.get(`${MEMBERS}?page=1`, { headers: auth(token) })).json();
  expect(all.members.find((m: { email: string }) => m.email === email3)).toBeUndefined();
});

test('membership requests are validated on the server', async ({ request }) => {
  const token = await adminToken(request);
  const badFormat = await request.post('/api/contact', {
    data: { name: 'Bad Format', email: uniqueEmail('fmt'), interest: 'Monthly membership', format: 'zoom' },
  });
  expect(badFormat.status()).toBe(400);
  expect((await badFormat.json()).error).toBe('Please choose in person or online, or leave it empty.');

  const tooLong = await request.post('/api/contact', {
    data: { name: 'Too Long', email: uniqueEmail('long'), interest: 'Monthly membership', message: 'x'.repeat(2001) },
  });
  expect(tooLong.status()).toBe(400);
  expect((await tooLong.json()).error).toBe('Please keep your preferred times under 2000 characters.');

  // A control character is not a length problem.
  const control = await request.post('/api/contact', {
    data: { name: 'Odd Chars', email: uniqueEmail('ctrl'), interest: 'Monthly membership', message: 'Mornings\u0007' },
  });
  expect(control.status()).toBe(400);
  expect((await control.json()).error).toBe('Please remove unusual characters from your preferred times.');

  const noName = await request.post('/api/contact', { data: { email: uniqueEmail('noname'), interest: 'Monthly membership' } });
  expect(noName.status()).toBe(400);

  // Every other interest still needs a message.
  const empty = await request.post('/api/contact', {
    data: { name: 'Empty Message', email: uniqueEmail('empty'), interest: 'Hatha Yoga', message: '' },
  });
  expect(empty.status()).toBe(400);
  expect((await empty.json()).error).toBe('Please provide your name, email, and message.');

  // The honeypot looks like it worked and stores nothing.
  const botEmail = uniqueEmail('bot');
  const bot = await request.post('/api/contact', {
    data: { name: 'Bot', email: botEmail, interest: 'Monthly membership', website: 'http://spam.example' },
  });
  expect(bot.status()).toBe(200);
  const list = await (await request.get(`${MEMBERS}?page=1`, { headers: auth(token) })).json();
  expect(list.members.find((m: { email: string }) => m.email === botEmail)).toBeUndefined();
});

test('the Members API needs an admin session', async ({ request }) => {
  const token = await adminToken(request);
  const { id } = await requestMembership(request, token);
  const attempts: Record<string, string>[] = [{}, { Authorization: 'Bearer bogus' }, { Authorization: `Bearer ${'0'.repeat(64)}` }];
  for (const headers of attempts) {
    expect((await request.get(`${MEMBERS}?page=1`, { headers })).status()).toBe(401);
    expect((await request.post(`${MEMBERS}/${id}`, { headers, data: { status: 'contacted', expectedStatus: 'new' } })).status()).toBe(401);
  }
  const list = await (await request.get(`${MEMBERS}?page=1`, { headers: auth(token) })).json();
  expect(list.members.find((m: { id: string }) => m.id === id).status).toBe('new');
});

test('status changes go one step at a time, with a real start date, and stale saves get 409', async ({ request }) => {
  const token = await adminToken(request);
  const { id } = await requestMembership(request, token, { format: 'in_person' });
  const today = dubaiToday();
  const expect400 = async (data: Record<string, unknown>, error?: string) => {
    const res = await update(request, token, id, data);
    expect(res.status(), JSON.stringify(data)).toBe(400);
    if (error) expect((await res.json()).error).toBe(error);
  };

  await expect400({ status: 'active', expectedStatus: 'new', startDate: today }, "That status change isn't allowed.");
  await expect400({ status: 'paused', expectedStatus: 'new' });
  await expect400({ status: 'contacted', expectedStatus: 'bogus' });
  await expect400({ status: 'contacted', expectedStatus: 'new', startDate: today });

  const contacted = await update(request, token, id, { status: 'contacted', expectedStatus: 'new' });
  expect(contacted.status()).toBe(200);
  expect((await contacted.json()).member).toMatchObject({ id, status: 'contacted', startDate: null, format: 'in_person' });

  await expect400({ status: 'active', expectedStatus: 'contacted' }, 'Please enter a valid start date.');
  await expect400({ status: 'active', expectedStatus: 'contacted', startDate: '2026-02-30' }, 'Please enter a valid start date.');
  await expect400({ status: 'active', expectedStatus: 'contacted', startDate: '2026-3-1' }, 'Please enter a valid start date.');
  await expect400({ status: 'active', expectedStatus: 'contacted', startDate: addDays(today, 400) }, 'Please enter a valid start date.');
  await expect400({ status: 'active', expectedStatus: 'contacted', startDate: addDays(today, -400) }, 'Please enter a valid start date.');

  const active = await update(request, token, id, { status: 'active', expectedStatus: 'contacted', startDate: today });
  expect(active.status()).toBe(200);
  const activeMember = (await active.json()).member;
  expect(activeMember).toMatchObject({ status: 'active', startDate: today });

  // Editing the date keeps it Active.
  const moved = await update(request, token, id, { status: 'active', expectedStatus: 'active', startDate: addDays(today, 10) });
  expect(moved.status()).toBe(200);
  const movedMember = (await moved.json()).member;
  expect(movedMember).toMatchObject({ status: 'active', startDate: addDays(today, 10) });
  expect(movedMember.updatedAt >= activeMember.updatedAt).toBe(true);

  // A save based on an old status is refused.
  const stale = await update(request, token, id, { status: 'new', expectedStatus: 'contacted' });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toBe(STALE);

  // Leaving Active clears the start date.
  const back = await update(request, token, id, { status: 'contacted', expectedStatus: 'active' });
  expect(back.status()).toBe(200);
  expect((await back.json()).member).toMatchObject({ status: 'contacted', startDate: null });

  for (const missing of ['3f0c8a52-1b2d-4e5f-8a9b-0c1d2e3f4a5b', 'not-a-uuid', id.toUpperCase(), "1' OR '1'='1"]) {
    const res = await request.post(`${MEMBERS}/${encodeURIComponent(missing)}`, {
      headers: auth(token),
      data: { status: 'contacted', expectedStatus: 'new' },
    });
    expect(res.status(), missing).toBe(404);
    expect((await res.json()).error).toBe('Membership request not found.');
  }
});

test('the Members list pages 20 at a time, newest first, and filters by status', async ({ request }) => {
  const token = await adminToken(request);
  const created = new Set<string>();
  for (let i = 0; i < 21; i++) created.add((await requestMembership(request, token, { name: `Page Member ${i}` })).id);
  expect(created.size).toBe(21);

  const first = await (await request.get(`${MEMBERS}?page=1`, { headers: auth(token) })).json();
  expect(first.pageSize).toBe(20);
  expect(first.page).toBe(1);
  expect(first.members).toHaveLength(20);
  expect(first.total).toBe(first.counts.new + first.counts.contacted + first.counts.active);
  expect(first.total).toBeGreaterThanOrEqual(21);

  const pages = Math.ceil(first.total / 20);
  const seen = new Set<string>();
  for (let p = 1; p <= pages; p++) {
    const body = await (await request.get(`${MEMBERS}?page=${p}`, { headers: auth(token) })).json();
    expect(body.members.length).toBe(p < pages ? 20 : first.total - 20 * (pages - 1));
    // Newest first, ties broken by id.
    for (let i = 1; i < body.members.length; i++) {
      const [a, b] = [body.members[i - 1], body.members[i]];
      expect(a.requestedAt > b.requestedAt || (a.requestedAt === b.requestedAt && a.id > b.id), `page ${p} row ${i}`).toBe(true);
    }
    for (const m of body.members) {
      expect(seen.has(m.id), `no overlap (${m.id})`).toBe(false);
      seen.add(m.id);
    }
  }
  expect(seen.size).toBe(first.total);
  for (const id of created) expect(seen.has(id)).toBe(true);

  // Past the last page: an empty page, not an error.
  const beyond = await request.get(`${MEMBERS}?page=${pages + 1}`, { headers: auth(token) });
  expect(beyond.status()).toBe(200);
  expect((await beyond.json()).members).toEqual([]);

  for (const query of ['page=0', 'page=abc', 'page=99999', 'page=1001', 'page=1&page=2', 'page=-1', 'status=bogus', 'status[]=new']) {
    expect((await request.get(`${MEMBERS}?${query}`, { headers: auth(token) })).status(), query).toBe(400);
  }
  expect((await request.get(`${MEMBERS}?status=`, { headers: auth(token) })).status()).toBe(200);
  expect((await request.get(MEMBERS, { headers: auth(token) })).status()).toBe(200);

  // Move one to Contacted; the filter returns only that status, and its total matches the count.
  const one = [...created][0];
  expect((await update(request, token, one, { status: 'contacted', expectedStatus: 'new' })).status()).toBe(200);
  for (const status of ['new', 'contacted'] as const) {
    const body = await (await request.get(`${MEMBERS}?page=1&status=${status}`, { headers: auth(token) })).json();
    expect(body.members.length).toBeGreaterThan(0);
    expect(body.members.every((m: { status: string }) => m.status === status)).toBe(true);
    expect(body.total).toBe(body.counts[status]);
  }
  const contacted = await (await request.get(`${MEMBERS}?page=1&status=contacted`, { headers: auth(token) })).json();
  expect(contacted.members.some((m: { id: string }) => m.id === one)).toBe(true);
});

test('the admin Members tab moves a request along, shows the start date and reports a stale save', async ({ page }) => {
  const token = await adminToken(page.request);
  const a = await requestMembership(page.request, token, { name: 'Tab Member A', message: 'Saturdays', format: 'online' });
  const b = await requestMembership(page.request, token, { name: 'Tab Member B' });
  const admin = await openAdminSignedIn(page, token);

  // Overview is the default and unchanged.
  const tabs = admin.getByRole('tablist', { name: 'Dashboard sections' });
  const overview = tabs.getByRole('tab', { name: 'Overview' });
  const members = tabs.getByRole('tab', { name: 'Members' });
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await expect(members).toHaveAttribute('aria-selected', 'false');
  await expect(admin.getByRole('tabpanel', { name: 'Overview' })).toContainText('Earnings — Last 6 Months (AED)');
  await expect(admin.locator('table tbody tr')).toHaveCount(10);
  // A membership request without preferred times shows no empty quote in Recent Messages.
  const recentB = admin.getByText('Tab Member B', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-[16px]")][1]');
  await expect(recentB).toContainText('Interest: Monthly membership');
  await expect(recentB.locator('p')).toHaveCount(0);

  // Keyboard: arrows, Home and End.
  await overview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(members).toBeFocused();
  await expect(members).toHaveAttribute('aria-selected', 'true');
  await expect(admin.getByRole('heading', { name: 'Membership requests' })).toBeVisible();
  await expect(admin.getByText('Total Revenue')).toHaveCount(0); // the inactive panel is unmounted
  await page.keyboard.press('ArrowLeft');
  await expect(overview).toBeFocused();
  await expect(admin.getByText('Total Revenue')).toBeVisible();
  await page.keyboard.press('End');
  await expect(members).toBeFocused();
  await page.keyboard.press('Home');
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await members.click();
  const panel = admin.getByRole('tabpanel', { name: 'Members' });
  await expect(panel.getByText('New, then Contacted, then Active with a start date.')).toBeVisible();

  const cardA = panel.getByTestId('member-request').filter({ hasText: 'Tab Member A' });
  await expect(cardA).toContainText('12-class monthly membership · AED 2,999 a month');
  await expect(cardA).toContainText('Format: Live online');
  await expect(cardA).toContainText('Preferred times: Saturdays');
  await expect(cardA).toContainText(`Requested ${formatDay(dubaiToday())}`);
  await expect(cardA.getByRole('link', { name: a.email })).toHaveAttribute('href', `mailto:${a.email}`);
  await expect(cardA.getByTestId('member-status')).toHaveText('New');
  // Screen readers hear "Status: New"; the words "Status:" are visually hidden.
  const pillA = cardA.getByTestId('member-status').locator('..');
  await expect(pillA).toHaveText('Status: New');
  await expect(pillA.locator('.sr-only')).toHaveText('Status:');
  const statusA = cardA.getByLabel('Status');
  // Only the current status and its allowed next steps: no New -> Active jump.
  await expect(statusA.locator('option')).toHaveText(['New', 'Contacted']);

  await statusA.selectOption('contacted');
  await cardA.getByRole('button', { name: 'Save' }).click();
  await expect(cardA.getByTestId('member-status')).toHaveText('Contacted');
  await expect(cardA.getByLabel('Status').locator('option')).toHaveText(['Contacted', 'New', 'Active']);
  // Focus lands on the saved card's name, and the save is announced.
  await expect(cardA.getByRole('heading', { name: 'Tab Member A' })).toBeFocused();
  await expect(panel.getByRole('status').filter({ hasText: 'Saved:' })).toHaveText('Saved: Tab Member A is now Contacted.');

  await cardA.getByLabel('Status').selectOption('active');
  const date = cardA.getByLabel('Start date');
  await expect(date).toHaveValue(dubaiToday());
  await cardA.getByRole('button', { name: 'Save' }).click();
  await expect(cardA.getByTestId('member-status')).toHaveText('Active');
  await expect(cardA).toContainText(`Start date: ${formatDay(dubaiToday())}`);

  const later = addDays(dubaiToday(), 14);
  await cardA.getByLabel('Start date').fill(later);
  // After a save the list is fetched again; let that land before B is changed behind the UI's back.
  const refetched = page.waitForResponse((r) => r.url().includes('/api/admin/members?') && r.request().method() === 'GET');
  await cardA.getByRole('button', { name: 'Save' }).click();
  await expect(cardA).toContainText(`Start date: ${formatDay(later)}`);
  await refetched;
  const saved = await (await page.request.get(`${MEMBERS}?page=1&status=active`, { headers: auth(token) })).json();
  expect(saved.members.find((m: { id: string }) => m.id === a.id)).toMatchObject({ status: 'active', startDate: later });

  // Someone else moves B first: this card's save is refused with the 409 message.
  expect((await update(page.request, token, b.id, { status: 'contacted', expectedStatus: 'new' })).status()).toBe(200);
  const cardB = panel.getByTestId('member-request').filter({ hasText: 'Tab Member B' });
  await expect(cardB.getByTestId('member-status')).toHaveText('New');
  await cardB.getByLabel('Status').selectOption('contacted');
  await cardB.getByRole('button', { name: 'Save' }).click();
  await expect(cardB.getByRole('alert')).toHaveText(STALE);
  // The top-bar Refresh fetches the Members list too, so the message's advice works.
  await admin.getByRole('button', { name: 'Refresh' }).click();
  await expect(cardB.getByTestId('member-status')).toHaveText('Contacted');

  // The Active filter lists only Active requests.
  const filters = panel.getByRole('group', { name: 'Show requests' });
  const activeFilter = filters.getByRole('button', { name: /^Active \(\d+\)$/ });
  await activeFilter.click();
  await expect(activeFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByTestId('member-request').filter({ hasText: 'Tab Member A' })).toBeVisible();
  await expect(panel.getByTestId('member-request').filter({ hasText: 'Tab Member B' })).toHaveCount(0);
  const labels = await panel.getByTestId('member-status').allInnerTexts();
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((l) => /^active$/i.test(l.trim()))).toBe(true);
  await expect(panel).toContainText(/Page 1 of \d+/);
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('the card, the join sheet and the Members tab fit a phone', async ({ page }) => {
    const pricing = await openPricing(page);
    expect(await pageOverflow(page), 'page overflow at #pricing').toBeLessThanOrEqual(0);
    const card = pricing.getByTestId('membership-card');
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    const cta = card.getByRole('button', { name: 'Join the membership' });
    expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await cta.tap();
    await expect(page.getByRole('dialog', { name: 'Join the membership' }).getByPlaceholder('e.g. Sarah Jenkins')).toBeVisible();
    const dialog = page.getByRole('dialog');
    await settled(dialog);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    for (const name of ['In person in Dubai', 'Live online']) {
      expect((await dialog.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await dialog.getByPlaceholder('e.g. Sarah Jenkins').fill('Phone Member');
    await dialog.getByPlaceholder('sarah@example.com').fill(uniqueEmail('phone'));
    await dialog.getByRole('button', { name: 'In person in Dubai' }).tap();
    await dialog.getByRole('button', { name: 'Send Request' }).tap();
    await expect(dialog.getByRole('heading', { name: 'Request Sent' })).toBeVisible();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    expect((await dialog.getByRole('link', { name: 'Continue on WhatsApp' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const token = await adminToken(page.request);
    const admin = await openAdminSignedIn(page, token);
    await admin.getByRole('tab', { name: 'Members' }).tap();
    const panel = admin.getByRole('tabpanel', { name: 'Members' });
    const first = panel.getByTestId('member-request').first();
    await expect(first).toBeVisible();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    expect(await admin.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    // The controls wrap: the status select and Save are full width.
    const cardBox = (await first.boundingBox())!;
    const select = (await first.getByLabel('Status').boundingBox())!;
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(375);
    expect(select.width).toBeGreaterThan(cardBox.width * 0.8);
  });
});

test('screenshots: the card, the join sheet, success and the Members tab at 1280 and 375', async ({ page }) => {
  const token = await adminToken(page.request);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    const pricing = await openPricing(page);
    const card = pricing.getByTestId('membership-card');
    await expect.poll(() => shownOpacity(card)).toBe(1);
    if (width === 1280) await pricing.screenshot({ path: path.join(SHOTS, `${width}-pricing-card.png`) });
    else {
      // A phone element shot would stitch the fixed header and sticky bar over the card: centre it instead.
      await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect.poll(() => card.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(400);
      await page.screenshot({ path: path.join(SHOTS, `${width}-pricing-card.png`) });
    }

    await card.getByRole('button', { name: 'Join the membership' }).click();
    await expect(page.getByRole('dialog', { name: 'Join the membership' })).toBeVisible();
    const dialog = page.getByRole('dialog');
    await settled(dialog);
    await page.screenshot({ path: path.join(SHOTS, `${width}-join-sheet.png`) });
    await dialog.getByPlaceholder('e.g. Sarah Jenkins').fill('Screenshot Member');
    await dialog.getByPlaceholder('sarah@example.com').fill(uniqueEmail('shot'));
    const online = dialog.getByRole('button', { name: 'Live online' });
    await online.click();
    await dialog.getByLabel('Preferred days and times (optional)').fill('Weekday mornings');
    // The pressed segment eases to ink over 200ms: wait until it matches the ink submit button.
    const ink = await dialog.getByRole('button', { name: 'Send Request' }).evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect.poll(() => online.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ink);
    await page.screenshot({ path: path.join(SHOTS, `${width}-join-filled.png`) });
    await dialog.getByRole('button', { name: 'Send Request' }).click();
    await expect(dialog.getByRole('heading', { name: 'Request Sent' })).toBeFocused();
    await settled(dialog);
    await page.screenshot({ path: path.join(SHOTS, `${width}-join-success.png`) });

    const admin = await openAdminSignedIn(page, token);
    const membersTab = admin.getByRole('tab', { name: 'Members' });
    await membersTab.click();
    await expect(admin.getByTestId('member-request').first()).toBeVisible();
    await settled(admin);
    // Both pills ease their colours over 200ms: wait until the selected one is ink and the other clear.
    const allFilter = admin.getByRole('button', { name: 'All', exact: true });
    const inkBg = await allFilter.evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect.poll(() => membersTab.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(inkBg);
    await expect
      .poll(() => admin.getByRole('tab', { name: 'Overview' }).evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgba(0, 0, 0, 0)');
    await page.screenshot({ path: path.join(SHOTS, `${width}-members-tab.png`) });
  }
});
