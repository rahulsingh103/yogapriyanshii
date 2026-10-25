import { test, expect, stepShooter, openHome } from './helpers';

const FEATURE = 'content';
const WA_LINK = /^https:\/\/wa\.me\/\d{8,15}\?text=/;
const CALL_PREFILL =
  "Hi Priyanshi, I found you on yogapriyanshi.com and I'd like to book a free 15-minute call. When suits you?";

// The three verified ClassPass reviews, quoted exactly (design/PRIYANSHI-FACTS.md).
const REVIEWS = [
  {
    quote:
      'Priyanshi was amazing and made the class really fun! She explained all the exercises clearly and helped with posture and balance — I even did a headstand for the first time ever! Highly recommend and will definitely be going again.',
    caption: 'Verified ClassPass review · Yoga class',
  },
  {
    quote:
      'Amazing class! I felt so refreshed afterward — my tired back feels alive again. Priyanshi is definitely one of the best yoga instructors in Dubai.',
    caption: 'Verified ClassPass review · Spine Healing class',
  },
  {
    quote:
      "I absolutely love Priyanshi's barre yoga classes. She has a beautiful way of combining strength work with deep, intentional stretching that leaves my body feeling open and flexible. I always leave her class feeling both strong and deeply relaxed.",
    caption: 'Verified ClassPass review · Barre Yoga class',
  },
];

test('homepage sections come in the agreed order', async ({ page }) => {
  await openHome(page);
  const ids = await page.locator('main > section[id]').evaluateAll((els) => els.map((el) => el.id));
  expect(ids).toEqual([
    'home',
    'classes',
    'about',
    'testimonials',
    'how-it-works',
    'schedule',
    'pricing',
    'faq',
    'instagram',
    'first-class',
    'contact',
  ]);
  // The quote sits between Testimonials and How it works.
  const order = await page.evaluate(() => {
    const quote = document.querySelector('section[aria-label="Quote"]')!;
    const before = document.getElementById('testimonials')!;
    const after = document.getElementById('how-it-works')!;
    return [
      before.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING,
      quote.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING,
    ];
  });
  expect(order.every(Boolean)).toBe(true);
  await expect(page.locator('section[aria-label="Quote"]')).toContainText('Yogas citta vritti nirodhah');
  await expect(page.locator('section[aria-label="Quote"]')).toContainText('Yoga Sutras 1.2');
});

test('About: credentials paragraph and the four trust numbers', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const about = page.locator('#about');
  await about.scrollIntoViewIfNeeded();
  const credentials = about.getByTestId('about-credentials');
  await expect(credentials).toContainText('Rishikesh');
  await expect(credentials).toContainText('Dev Sanskriti Vishwavidyalaya');
  await expect(credentials).toContainText("one of the UAE's largest yoga studios");
  await expect(credentials).toContainText('prenatal yoga');
  // The paragraph doesn't repeat what the trust numbers already say.
  await expect(credentials).not.toContainText(/300 hours|Bachelor's|Yoga Alliance|7 years|seven years|500/i);
  const words = (await credentials.textContent())!.trim().split(/\s+/).length;
  expect(words, 'credentials paragraph word count').toBeLessThanOrEqual(40);

  const pairs = await about.locator('dl > div').evaluateAll((divs) =>
    divs.map((d) => [d.querySelector('dd')!.textContent!.trim(), d.querySelector('dt')!.textContent!.trim()])
  );
  expect(pairs).toEqual([
    ['7 years', 'Teaching since 2019'],
    ['300 hours', 'Yoga Alliance registered training'],
    ["Bachelor's", 'In Yogic Science'],
    ['Up to 500', 'People led on International Yoga Day'],
  ]);
  // The real photo of Priyanshi has loaded.
  const img = about.locator('img');
  await expect(img).toHaveAttribute('src', /burj-forearm-stand-1/);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await shot('about');
});

test('Testimonials: the three verified reviews, quoted exactly, with no links and no auto-advance', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const section = page.locator('#testimonials');
  await section.scrollIntoViewIfNeeded();
  const items = section.getByTestId('testimonial');
  await expect(items).toHaveCount(3);
  for (const [i, review] of REVIEWS.entries()) {
    await expect(items.nth(i).locator('blockquote')).toHaveText(review.quote);
    await expect(items.nth(i).locator('figcaption')).toHaveText(review.caption);
  }
  await expect(section.locator('a')).toHaveCount(0);
  await shot('testimonials');
});

test('Facts guard: no private email, Zoom, old mats line, or review-site links', async ({ page, request }) => {
  await openHome(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState('networkidle');
  const text = (await page.locator('body').textContent()) ?? '';
  for (const banned of [/gmail/i, /\bZoom\b/, /Mats and props/i, /\bDSVV\b/, /every pose has options/i]) {
    expect(text, `page text must not match ${banned}`).not.toMatch(banned);
  }
  const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  for (const href of hrefs) expect(href, 'no review-site links').not.toMatch(/classpass|findyoga/i);
  // The served HTML (meta tags and the FAQ JSON-LD) is clean too.
  const html = await (await request.get('/')).text();
  expect(html).not.toMatch(/gmail|zoom|classpass|findyoga/i);
});

test('How it works: three steps, the safety note and the free 15-minute call link', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const how = page.locator('#how-it-works');
  await how.scrollIntoViewIfNeeded();
  await expect(how.locator('ol > li h3')).toHaveText(['Book your free first class', 'Hear from Priyanshi', 'Practise']);
  await expect(how).toContainText('in person in Dubai');
  await expect(how).not.toContainText('across Dubai');

  const safety = how.getByTestId('safety-note');
  await expect(safety.getByRole('heading', { level: 3 })).toHaveText('Practise safely');
  await expect(safety.locator('li')).toHaveCount(3);
  await expect(safety.locator('li').nth(2)).toHaveText(
    'Classes welcome all levels: Priyanshi teaches with safe sequencing and alignment, and she is trained in prenatal yoga.'
  );
  await expect(safety).not.toContainText(/clearance|cleared by|doctor's note/i);

  const call = how.getByRole('link', { name: 'Book a free 15-minute call' });
  await expect(call).toBeVisible();
  const href = (await call.getAttribute('href'))!;
  expect(href).toMatch(WA_LINK);
  expect(new URL(href).searchParams.get('text')).toBe(CALL_PREFILL);
  await expect(call).toHaveAttribute('target', '_blank');
  await expect(call).toHaveAttribute('rel', /noopener/);
  // Its name never collides with the floating button's.
  await expect(how.getByRole('link', { name: 'Chat with Priyanshi on WhatsApp' })).toHaveCount(0);
  await shot('how-it-works');
});

test('Instagram: five lazy photos, a Follow link only, and no layout shift', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  // Collect layout shifts from the start of the page load.
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await openHome(page);
  const insta = page.locator('#instagram');
  const photos = insta.getByTestId('instagram-photo');
  await expect(photos).toHaveCount(5);
  for (const photo of await photos.all()) {
    await expect(photo).toHaveAttribute('loading', 'lazy');
    await expect(photo).toHaveAttribute('width', /\d+/);
    await expect(photo).toHaveAttribute('height', /\d+/);
    expect((await photo.getAttribute('alt'))!.length).toBeGreaterThan(10);
  }

  await insta.scrollIntoViewIfNeeded();
  for (const photo of await photos.all()) {
    await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  const links = insta.getByRole('link');
  await expect(links).toHaveCount(1);
  const follow = insta.getByRole('link', { name: 'Follow @yogapriyanshi' });
  await expect(follow).toHaveAttribute('href', 'https://instagram.com/yogapriyanshi');
  await expect(follow).toHaveAttribute('target', '_blank');
  await expect(follow).toHaveAttribute('rel', /noopener/);
  await expect(insta.getByRole('link', { name: /WhatsApp/ })).toHaveCount(0);

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls, 'cumulative layout shift').toBeLessThan(0.1);
  await shot('instagram');
});

test('Nothing auto-advances: the reviews and photo tracks stay put', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openHome(page);
  for (const id of ['testimonials', 'instagram']) {
    const track = page.locator(`#${id} ul`).first();
    await track.scrollIntoViewIfNeeded();
    const before = await track.evaluate((el) => el.scrollLeft);
    await page.waitForTimeout(3500);
    expect(await track.evaluate((el) => el.scrollLeft), `${id} track did not move by itself`).toBe(before);
  }
});

test('Schedule and FAQ carry the corrected copy', async ({ page }) => {
  await openHome(page);
  const schedule = page.locator('#schedule');
  await schedule.scrollIntoViewIfNeeded();
  await expect(schedule.getByText('Retrieving live studio availability...')).toHaveCount(0);
  await expect(schedule).toContainText('Bring your own mat. Online? Priyanshi sends you the class link.');

  await expect(page.locator('#pricing')).toContainText('or online with the details Priyanshi sends after you book');

  const faq = page.locator('#faq');
  await faq.scrollIntoViewIfNeeded();
  await faq.getByRole('button', { name: 'What should I bring or wear?' }).click();
  await expect(faq.locator('#faq-a-bring')).toContainText('bring your own mat');
  await faq.getByRole('button', { name: 'How do I pay?' }).click();
  await expect(faq.locator('#faq-a-payment')).toContainText('Priyanshi sends you the payment details');
  await faq.getByRole('button', { name: 'Which classes do you teach?' }).click();
  await expect(faq.locator('#faq-a-classes')).toContainText('Aerial yoga is private sessions only, on request.');
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('the new sections never overflow sideways', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    for (const id of ['about', 'testimonials', 'how-it-works', 'instagram']) {
      const section = page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `page overflow at #${id}`).toBeLessThanOrEqual(0);
      const box = (await section.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      await shot(id);
    }
  });
});
