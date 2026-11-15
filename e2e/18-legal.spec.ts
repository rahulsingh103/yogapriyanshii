import { test, expect } from '@playwright/test';
import { PRIVACY_EMAIL } from '../src/constants/privacy';
import { LEGAL_PAGES } from '../src/constants/legal';

test('privacy page: reachable from the footer, the full policy with the contact email', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('footer').getByRole('link', { name: 'Privacy policy' });
  await expect(link).toHaveAttribute('href', '/privacy');
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  for (const h of ['Who we are', 'What we collect and why', 'The class finder and your health answers', 'Cookies and browser storage', 'Who we share it with', 'How long we keep it', 'Your choices']) {
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  }
  await expect(page.getByText(PRIVACY_EMAIL).first()).toBeVisible();
  await expect(page).toHaveTitle('Privacy policy · YogaPriyanshi');
});

test('every legal page is prerendered with its text and the menu, without JavaScript', async ({ request }) => {
  for (const p of LEGAL_PAGES) {
    const res = await request.get(p.path);
    expect(res.status(), p.path).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<title>${p.title} · YogaPriyanshi</title>`);
    expect(html).toContain('aria-label="Legal pages"');
    expect(html).toContain(`href="${p.path}" aria-current="page"`);
  }
  const refund = await (await request.get('/refund-and-cancellation')).text();
  expect(refund).toContain('More than 24 hours before: cancel or move it for free.');
  expect(refund).toContain('The 10-class pack is valid for 45 days. The 20-class pack is valid for 75 days.');
  expect(await (await request.get('/privacy')).text()).toContain('We use no advertising, tracking or analytics cookies.');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  if (sitemap.includes('<urlset')) for (const p of LEGAL_PAGES) expect(sitemap).toContain(p.path);
});

test('the footer Legal column opens each page in the app, and the menu moves between them', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const footer = page.locator('footer');
  await footer.getByRole('link', { name: 'Terms of use' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of use');
  await expect(page.getByText("Anyone under 18 needs a parent or guardian's permission")).toBeVisible();
  const menu = page.getByRole('navigation', { name: 'Legal pages' });
  await expect(menu.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('aria-current', 'page');
  await menu.getByRole('link', { name: 'Health data' }).click();
  await expect(page).toHaveURL(/\/health-data$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Health data');
  await expect(page).toHaveTitle('Health data · YogaPriyanshi');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of use');
});

test('your privacy choices: honest, essential only, no switches', async ({ page }) => {
  await page.goto('/');
  await page.locator('footer').getByRole('button', { name: 'Your privacy choices' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your privacy choices' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Always on')).toBeVisible();
  await expect(dialog.getByText("None. We don't use them, so there is nothing to turn off.")).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(0);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Read the privacy policy' })).toHaveAttribute('href', '/privacy');
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
});

test('the phone footer stacks into two columns without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/refund-and-cancellation');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Refund and cancellation');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('sign-up links to the privacy policy', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.locator('header').getByRole('button', { name: 'Sign up' }).click();
  const policy = page.getByRole('link', { name: 'privacy policy' });
  await expect(policy).toHaveAttribute('href', '/privacy');
});
