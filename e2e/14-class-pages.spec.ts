import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, bookingModal, classFinder } from './helpers';
// Pure data modules (relative imports, no import.meta.env), so the tests check against the source of truth.
import { PRACTICE_CLASSES } from '../src/constants/classes';
import {
  CLASS_PAGES,
  CLASS_PAGE_ON_REQUEST_LINE,
  classBeforeList,
  classPageKind,
  classPagePrefill,
} from '../src/constants/class-pages';
import type { ClassName } from '../src/constants/class-finder';
import { isSafeHref, itemText, parseArticle, splitFrontMatter } from '../src/lib/article-md';
import { readPublishedArticles } from '../src/lib/article-files';
import { applyRoute } from '../src/lib/route-html';
import { resolveRoute } from '../src/lib/route';

/**
 * Homepage gzip total at 0d64302 (before Batch 4a): the built index.html was parsed for its entry
 * <script type="module">, every <link rel="modulepreload"> and every stylesheet <link>; each file was
 * gzipped with zlib.gzipSync at the default level and the sizes summed (entry 146910 + CSS 9768).
 */
const HOME_GZ_BASELINE = 156678;

const SITE = 'https://www.yogapriyanshi.com';
const SHOTS = path.join('.data', 'shots', 'batch4');
const BOOKABLE = PRACTICE_CLASSES.filter((c) => c.style);
const CONTACT_ONLY = PRACTICE_CLASSES.filter((c) => !c.style && c.name !== 'Aerial Yoga');
const content = (name: string) => CLASS_PAGES[name as ClassName];

const attr = (html: string, re: RegExp) => html.match(re)?.[1] ?? null;
const metaContent = (html: string, key: string) =>
  attr(html, new RegExp(`<meta (?:name|property)="${key.replace(/[:]/g, '\\:')}" content="([^"]*)"`));
const canonical = (html: string) => attr(html, /<link rel="canonical" href="([^"]*)"/);
const h1 = (html: string) => attr(html, /<h1[^>]*>([^<]*)<\/h1>/);
const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** No video tool, former studio, private email or old schedule line, anywhere. */
const FACTS_GUARD = /zoom|lifestyle yoga|gmail|mats and props/i;
const WORDING_GUARD = /\b(cures?|treat(s|ment)?|heal(s|ed|ing)?|guarantee[sd]?|prevents?)\b|safe for/i;
/** The drafts (outside the repo). Tests read them only to lint them; their text never enters the repo. */
const DRAFTS_DIR = path.resolve('..', 'content-drafts', 'articles');
/** Synthetic lorem fixture for the article view (P9): no draft text and no health claims. */
const FIXTURE = path.join('e2e', 'fixtures', 'article.md');

async function soonest(request: APIRequestContext, style: string) {
  const { sessions } = await (await request.get('/api/schedule')).json();
  return sessions
    .filter((s: any) => !s.isRestDay && s.status === 'available' && s.style === style)
    .sort((a: any, b: any) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc))[0];
}

/** The preloader has gone, so the React page is what's on screen. */
async function settled(page: Page) {
  await expect(page.locator('#preloader')).toHaveCount(0);
}

async function openClass(page: Page, slug: string) {
  await page.goto(`/classes/${slug}`);
  await settled(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** #classes is on screen, near the top (below the header). */
async function classesInView(page: Page) {
  await expect
    .poll(() => page.locator('#classes').evaluate((el) => Math.round(el.getBoundingClientRect().top)))
    .toBeGreaterThanOrEqual(0);
  const top = await page.locator('#classes').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(200);
}

/** The card for `slug` sits fully inside the carousel track. */
async function cardInTrack(page: Page, slug: string) {
  return page.locator(`#classes [data-card-slug="${slug}"]`).evaluate((item) => {
    const track = item.parentElement!.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    return box.left >= track.left - 1 && box.right <= track.right + 1;
  });
}

test.describe('served HTML', () => {
  test('all 11 class pages are prerendered with their own head and content', async ({ request }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const cls of PRACTICE_CLASSES) {
      const res = await request.get(`/classes/${cls.slug}`);
      expect(res.status(), cls.slug).toBe(200);
      const html = await res.text();
      const c = content(cls.name);
      expect(decode(h1(html) ?? '')).toBe(cls.name);
      const title = decode(attr(html, /<title>([^<]*)<\/title>/) ?? '');
      expect(title).toBe(`${cls.name} in Dubai · YogaPriyanshi`);
      const description = decode(metaContent(html, 'description') ?? '');
      expect(description).toBe(c.metaDescription);
      expect(description.length).toBeLessThanOrEqual(155);
      titles.add(title);
      descriptions.add(description);
      const url = `${SITE}/classes/${cls.slug}`;
      expect(canonical(html)).toBe(url);
      expect(metaContent(html, 'og:url')).toBe(url);
      expect(decode(metaContent(html, 'og:title') ?? '')).toBe(title);
      expect(decode(metaContent(html, 'og:description') ?? '')).toBe(description);
      expect(metaContent(html, 'og:image')).toContain('/og-image.jpg');
      expect(html).not.toContain('faq-jsonld');
      expect(html).not.toContain('name="robots"');
      expect(html).not.toMatch(FACTS_GUARD);
      // The static body carries no WhatsApp link (P4).
      const root = html.slice(html.indexOf('<div id="root">'));
      expect(root).not.toContain('wa.me');
      // "Spine Healing" is the class's name, the one allowed use.
      expect(decode(root).replace(/Spine Healing/g, '')).not.toMatch(WORDING_GUARD);
    }
    expect(titles.size).toBe(11);
    expect(descriptions.size).toBe(11);

    const slash = await request.get('/classes/hatha/');
    expect(slash.status()).toBe(200);
    expect(canonical(await slash.text())).toBe(`${SITE}/classes/hatha`);
  });
});

test.describe('rendered class pages', () => {
  test('each page matches its static HTML, its data and its title', async ({ page, request }) => {
    for (const cls of PRACTICE_CLASSES) {
      const html = await (await request.get(`/classes/${cls.slug}`)).text();
      const staticWho = decode(attr(html, /data-testid="class-who-for"[^>]*>([^<]*)</) ?? '');
      const staticBring = [...html.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => decode(m[1]));

      await openClass(page, cls.slug);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(cls.name);
      await expect(page.getByTestId('class-who-for')).toHaveText(staticWho);
      await expect(page.getByTestId('class-who-for')).toHaveText(content(cls.name).whoFor);
      const bring = page.getByTestId('class-before').locator('li');
      // 6 items; private Aerial drops the own-mat line.
      const expected = classBeforeList(classPageKind(cls));
      expect(expected).toHaveLength(cls.name === 'Aerial Yoga' ? 5 : 6);
      await expect(bring).toHaveCount(expected.length);
      await expect(bring).toHaveText(staticBring);
      await expect(bring).toHaveText([...expected]);
      if (cls.name === 'Aerial Yoga') await expect(page.getByTestId('class-before')).not.toContainText(/own mat/i);
      const duration = cls.line.match(/· (\d+ min)$/)?.[1];
      if (duration) await expect(page.getByTestId('class-duration')).toHaveText(duration);
      else await expect(page.getByTestId('class-duration')).toHaveCount(0);
      await expect(page).toHaveTitle(`${cls.name} in Dubai · YogaPriyanshi`);
      expect(await page.locator('main').innerText()).not.toMatch(FACTS_GUARD);
      // A direct load doesn't move focus (P14).
      await expect(page.getByRole('heading', { level: 1 })).not.toBeFocused();
    }
  });

  test('a class page served in dev has no failed requests', async ({ page }) => {
    const failures: string[] = [];
    page.on('requestfailed', (r) => failures.push(`failed ${r.url()}`));
    page.on('response', (r) => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    for (const slug of ['hatha', 'prenatal-postnatal', 'aerial-yoga']) {
      await openClass(page, slug);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator('main img')).toHaveJSProperty('complete', true);
    }
    expect(failures).toEqual([]);
  });
});

test.describe('honest actions', () => {
  for (const cls of BOOKABLE) {
    test(`${cls.name}: "Book a free class" opens booking at the soonest ${cls.name} session`, async ({ page, request }) => {
      const session = await soonest(request, cls.style!);
      expect(session, `an available ${cls.style} session`).toBeTruthy();
      await openClass(page, cls.slug);
      const actions = page.locator('#class-actions');
      await expect(actions).toContainText('Your first class is free.');
      await actions.getByRole('button', { name: 'Book a free class' }).click();
      const modal = bookingModal(page);
      await expect(modal.locator('select')).toHaveValue(session.id);
    });
  }

  test('contact-only and private pages open contact with the right interest, never "Book" or "free"', async ({ page }) => {
    for (const cls of [...CONTACT_ONLY, PRACTICE_CLASSES.find((c) => c.name === 'Aerial Yoga')!]) {
      await openClass(page, cls.slug);
      const aerial = cls.name === 'Aerial Yoga';
      const actions = page.locator('#class-actions');
      if (!aerial) await expect(actions).toContainText(CLASS_PAGE_ON_REQUEST_LINE);
      expect(await page.locator('main').innerText()).not.toMatch(/book|free/i);
      await actions.getByRole('button', { name: aerial ? 'Ask about private Aerial' : 'Ask about this class' }).click();
      const dialog = page.getByRole('dialog', { name: 'Send a message' });
      await expect(dialog.getByLabel('Area of Interest')).toHaveValue(aerial ? 'Private Aerial Yoga' : cls.contactInterest!);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });

  test('the WhatsApp link names the class, and the floating button steps aside over the actions', async ({ page }) => {
    for (const cls of PRACTICE_CLASSES) {
      await openClass(page, cls.slug);
      const link = page.locator('#class-actions').getByRole('link', { name: 'Ask Priyanshi on WhatsApp' });
      const href = (await link.getAttribute('href'))!;
      expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
      const text = decodeURIComponent(href.split('?text=')[1]);
      expect(text).toBe(classPagePrefill(cls.name));
      expect(text).not.toContain('@');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    await openClass(page, 'hatha');
    await expect(page.getByTestId('whatsapp-chat')).toBeVisible();
    await page.locator('#class-actions').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('whatsapp-chat')).toHaveCount(0);
  });
});

test.describe('carousel', () => {
  test('11 "Learn more" links open the class pages in the app, and the cards still open booking', async ({ page, request }) => {
    await page.goto('/');
    await settled(page);
    const classes = page.locator('#classes');
    await classes.scrollIntoViewIfNeeded();
    const links = classes.getByRole('link', { name: /^Learn more about / });
    await expect(links).toHaveCount(11);
    for (const [i, cls] of PRACTICE_CLASSES.entries()) {
      await expect(links.nth(i)).toHaveAccessibleName(`Learn more about ${cls.name}`);
      await expect(links.nth(i)).toHaveAttribute('href', `/classes/${cls.slug}`);
    }

    const hatha = await soonest(request, 'hatha');
    await classes.getByRole('button', { name: /^Hatha/ }).click();
    await expect(bookingModal(page).locator('select')).toHaveValue(hatha.id);
    await page.keyboard.press('Escape');
    await expect(bookingModal(page)).toHaveCount(0);

    await page.evaluate(() => ((window as any).__ypMarker = 'still here'));
    await classes.getByRole('link', { name: 'Learn more about Barre' }).click();
    await expect(page).toHaveURL(/\/classes\/barre$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Barre');
    expect(await page.evaluate(() => (window as any).__ypMarker)).toBe('still here');
    // In-app navigation lands at the top with focus on the class name (P14).
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page).toHaveTitle('Barre in Dubai · YogaPriyanshi');
  });

  test('a mouse drag that starts on "Learn more" does not navigate', async ({ page }) => {
    await page.goto('/');
    await settled(page);
    const classes = page.locator('#classes');
    await classes.scrollIntoViewIfNeeded();
    const link = classes.getByRole('link', { name: 'Learn more about Barre' });
    const box = (await link.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 8 });
    await page.mouse.move(box.x - 160, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Connect/);
  });
});

test.describe('back navigation', () => {
  async function fromCarousel(page: Page, name: string) {
    await page.goto('/');
    await settled(page);
    const classes = page.locator('#classes');
    await classes.scrollIntoViewIfNeeded();
    await classes.getByRole('link', { name: `Learn more about ${name}` }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }

  async function backOnCard(page: Page, slug: string, name: string) {
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle('YogaPriyanshi · Yoga in Dubai');
    await classesInView(page);
    await expect(page.getByRole('link', { name: `Learn more about ${name}` })).toBeFocused();
    expect(await cardInTrack(page, slug)).toBe(true);
  }

  test('browser Back restores home, the card and its focus', async ({ page }) => {
    await fromCarousel(page, 'Yin Yoga');
    await page.goBack();
    await backOnCard(page, 'yin-yoga', 'Yin Yoga');
  });

  test('"All classes" does the same', async ({ page }) => {
    await fromCarousel(page, 'Spine Healing');
    await page.getByRole('link', { name: 'All classes' }).click();
    await backOnCard(page, 'spine-healing', 'Spine Healing');
  });

  test('arriving directly, "All classes" lands on / with the classes in view', async ({ page }) => {
    await openClass(page, 'wheel');
    await page.getByRole('link', { name: 'All classes' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Connect/);
    await classesInView(page);
    await expect(page).toHaveTitle('YogaPriyanshi · Yoga in Dubai');
    // The link unmounted with the page, so focus moves to the classes heading, not <body>.
    await expect(page.locator('#classes h2').first()).toBeFocused();
  });

  test("the header's Schedule link from a class page lands on #schedule", async ({ page }) => {
    await openClass(page, 'hatha');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Schedule' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(() => page.locator('#schedule').evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(0);
    const top = await page.locator('#schedule').evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(200);
  });
});

test.describe('404', () => {
  test('unknown and mixed-case slugs are real 404s with a way home', async ({ page, request }) => {
    for (const p of ['/classes/nope', '/classes/Hatha']) {
      const res = await request.get(p);
      expect(res.status(), p).toBe(404);
      const html = await res.text();
      expect(html).toContain('<meta name="robots" content="noindex" />');
      expect(canonical(html)).toBeNull();
      expect(metaContent(html, 'og:url')).toBeNull();
      expect(h1(html)).toBe('Page not found');
      expect(html).not.toContain('faq-jsonld');
    }
    for (const p of ['/guides', '/guides/x', '/drafts/x', '/__drafts/x', '/nope']) {
      expect((await request.get(p)).status(), p).toBe(404);
    }

    await page.goto('/classes/nope');
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    await expect(page).toHaveTitle('Page not found · YogaPriyanshi');
    await expect(page.locator('footer')).not.toContainText(/guides/i);
    await page.getByRole('link', { name: 'Back to the homepage' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Connect/);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(page).toHaveTitle('YogaPriyanshi · Yoga in Dubai');
    expect(await page.evaluate(() => document.querySelector('meta[name="robots"]'))).toBeNull();
  });
});

test.describe('phone (375px, touch)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('no overflow and 44px targets on every class page and the 404', async ({ page }) => {
    for (const p of [...PRACTICE_CLASSES.map((c) => `/classes/${c.slug}`), '/classes/nope']) {
      await page.goto(p);
      await settled(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, p).toBeLessThanOrEqual(0);
      const small = await page.locator('main').evaluate((main) =>
        [...main.querySelectorAll<HTMLElement>('a, button')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
          .map(({ el }) => el.textContent)
      );
      expect(small, p).toEqual([]);
    }
  });

  test('the menu\'s Schedule link from a class page lands on #schedule', async ({ page }) => {
    await openClass(page, 'barre');
    const toggle = page.getByLabel('Toggle Navigation Menu');
    await toggle.click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await menu.getByRole('link', { name: 'Schedule', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#schedule')).toBeInViewport();
    await expect
      .poll(() => page.locator('#schedule').evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(0);
    const top = await page.locator('#schedule').evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(200);
    await expect(page.locator('#schedule h2').first()).toBeFocused();
  });
});

test('the action pills never wrap or overflow, 320 to 1440px', async ({ browser }) => {
  const page = await browser.newPage();
  try {
    for (const width of [320, 375, 640, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const slug of ['aerial-yoga', 'hatha', 'prenatal-postnatal']) {
        await page.goto(`/classes/${slug}`);
        await settled(page);
        const bad = await page.locator('#class-actions').evaluate((section) =>
          [...section.querySelectorAll<HTMLElement>('a, button')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              const box = section.getBoundingClientRect();
              // Single line (a 48px pill), no clipped text, inside the column.
              return el.scrollWidth > el.clientWidth || r.height > 49 || r.right > box.right + 0.5 || r.left < box.left - 0.5;
            })
            .map((el) => el.textContent)
        );
        expect(bad, `${slug} at ${width}`).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${slug} at ${width}`).toBeLessThanOrEqual(0);
      }
    }
  } finally {
    await page.close();
  }
});

test('screenshots at 1024, 1280 and 375', async ({ browser }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [width, height] of [[1024, 768], [1280, 900], [375, 812]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      for (const p of ['/classes/hatha', '/classes/barre', '/classes/spine-healing', '/classes/aerial-yoga', '/classes/nope']) {
        await page.goto(p);
        await settled(page);
        await page.evaluate(() => document.fonts.ready);
        const name = p.split('/').pop() === 'nope' ? '404' : p.split('/').pop();
        await page.screenshot({ path: path.join(SHOTS, `${name}-${width}.png`), fullPage: true });
      }
    } finally {
      await page.close();
    }
  }
});

// ---- Part B (Batch 4b): the hidden article pipeline. Synthetic lorem text only. ----

test.describe('articles (hidden)', () => {
  test('the parser returns plain blocks, keeps only https links and rejects bad front matter', () => {
    const article = parseArticle(fs.readFileSync(FIXTURE, 'utf-8'));
    expect(article.meta).toEqual({
      title: 'Lorem ipsum dolor sit amet',
      description: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt.',
      status: 'draft',
      reviewedBy: '',
      published: null,
      action: 'book',
      interest: null,
    });
    expect(article.blocks.map((b) => b.kind)).toEqual([
      'paragraph', 'heading', 'paragraph', 'list', 'heading', 'paragraph', 'heading', 'list',
    ]);
    const links = article.blocks.flatMap((b) =>
      b.kind === 'paragraph' ? b.inlines : b.kind === 'list' ? b.items.flatMap((it) => it.inlines) : []
    ).filter((i) => i.kind === 'link');
    expect(links.map((l) => (l.kind === 'link' ? l.href : ''))).toEqual(['https://example.com/lorem', 'https://example.com/source']);
    // The javascript: and http: links keep their words as text, without a URL; a leading "Label:" or
    // "**Label.**" becomes the item's label.
    const list = article.blocks[3];
    expect(list.kind === 'list' && list.items.map((it) => it.label)).toEqual(['Irure dolor:', null, 'Fugiat.']);
    expect(list.kind === 'list' && list.items.map(itemText)).toEqual([
      'Irure dolor: in reprehenderit',
      'Voluptate velit esse cillum dolore',
      'Fugiat. nulla pariatur',
    ]);
    // "## Sources" marks its heading and list; a source never gets a label, even with a colon.
    const sourcesHeading = article.blocks[6];
    const sources = article.blocks[7];
    expect(sourcesHeading.kind === 'heading' && sourcesHeading.sources).toBe(true);
    expect(list.kind === 'list' && list.sources).toBe(false);
    expect(sources.kind === 'list' && sources.sources && sources.items.every((it) => it.label === null)).toBe(true);
    expect(isSafeHref('https://example.com')).toBe(true);
    for (const bad of ['http://example.com', 'javascript:alert(1)', '//example.com', 'data:text/html,x', 'https//x'])
      expect(isSafeHref(bad), bad).toBe(false);
    expect(() => parseArticle('no front matter')).toThrow();
    expect(() => parseArticle('---\ntitle: Lorem\n---\n')).toThrow(/description/);
    expect(() => parseArticle('---\ntitle: Lorem\ndescription: Ipsum\nstatus: live\n---\n')).toThrow(/status/);
    // A bad line is named by its number, never by its text.
    let message = '';
    try {
      parseArticle('---\ntitle: Lorem\nsit amet consectetur\n---\n');
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/line 3/);
    expect(message).not.toContain('consectetur');
    // `action: ask` needs a known contact interest; `interest` alone is refused.
    const head = '---\ntitle: Lorem\ndescription: Ipsum\nstatus: draft\n';
    expect(parseArticle(`${head}action: ask\ninterest: Yin Yoga\n---\n`).meta).toMatchObject({ action: 'ask', interest: 'Yin Yoga' });
    expect(() => parseArticle(`${head}action: ask\n---\n`)).toThrow(/interest/);
    expect(() => parseArticle(`${head}action: ask\ninterest: Lorem ipsum\n---\n`)).toThrow(/contact interests/);
    expect(() => parseArticle(`${head}interest: Yin Yoga\n---\n`)).toThrow(/only for action: ask/);
    expect(() => parseArticle(`${head}action: call\n---\n`)).toThrow(/action/);
  });

  test('only approved articles can ship, and a published one prerenders escaped, with its own head', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yp-articles-'));
    try {
      expect(readPublishedArticles(path.join(tmp, 'missing'))).toEqual([]);
      const md = fs.readFileSync(FIXTURE, 'utf-8');
      fs.writeFileSync(path.join(tmp, 'lorem-ipsum.md'), md);
      // status: draft, no date, no reviewer: the build would fail.
      expect(() => readPublishedArticles(tmp)).toThrow(/published/);
      const approved = md.replace('status: draft', 'status: published\npublished: 2026-01-01').replace('reviewedBy:', 'reviewedBy: Lorem');
      fs.writeFileSync(path.join(tmp, 'lorem-ipsum.md'), approved);
      // Approved, but its sources are still unverified: the build would fail too.
      expect(() => readPublishedArticles(tmp)).toThrow(/unverified sources/);
      fs.writeFileSync(path.join(tmp, 'lorem-ipsum.md'), approved.replace(/ \(link to verify\)/g, '').replace(/URL to confirm/g, ''));
      expect(() => readPublishedArticles(tmp)).not.toThrow();
      fs.writeFileSync(path.join(tmp, 'lorem-ipsum.md'), approved.replace(/ \(link to verify\)/g, '').replace(/URL to confirm/g, '').concat('\nURL to confirm\n'));
      expect(() => readPublishedArticles(tmp)).toThrow(/unverified sources/);
      fs.writeFileSync(path.join(tmp, 'lorem-ipsum.md'), approved.replace(/ \(link to verify\)/g, '').replace(/URL to confirm/g, ''));
      const [only] = readPublishedArticles(tmp);
      expect(only.slug).toBe('lorem-ipsum');

      const route = resolveRoute('/guides/lorem-ipsum', { publishedArticles: ['lorem-ipsum'] });
      expect(route).toEqual({ kind: 'article', slug: 'lorem-ipsum' });
      expect(resolveRoute('/guides', { publishedArticles: ['lorem-ipsum'] })).toEqual({ kind: 'guides' });
      expect(resolveRoute('/guides')).toEqual({ kind: 'notFound' });
      expect(resolveRoute('/guides/lorem-ipsum')).toEqual({ kind: 'notFound' });
      expect(resolveRoute('/drafts/lorem-ipsum')).toEqual({ kind: 'notFound' });

      const home = [
        '<html><head>',
        '  <!-- seo:start -->',
        '  <title>x</title>',
        '  <!-- seo:end -->',
        '</head><body><div id="root"></div></body></html>',
      ].join('\n');
      const html = applyRoute(home, route, { article: only.article });
      expect(h1(html)).toBe('Lorem ipsum dolor sit amet');
      expect(decode(attr(html, /<title>([^<]*)<\/title>/) ?? '')).toBe('Lorem ipsum dolor sit amet · YogaPriyanshi');
      expect(canonical(html)).toBe(`${SITE}/guides/lorem-ipsum`);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
      expect(html).not.toMatch(/href="(javascript|http):/);
      expect(html).toContain('href="https://example.com/lorem" target="_blank" rel="noopener noreferrer"');
      expect(html).toContain('<span class="sr-only"> (opens in a new tab)</span>');
      expect(html).toMatch(/<a href="\/guides" class="[^"]*min-h-11[^"]*">All guides<\/a>/);
      expect(html).toContain('<span class="font-medium text-ink">Irure dolor: </span>');
      const index = applyRoute(home, { kind: 'guides' }, { guides: [{ slug: only.slug, meta: only.article.meta }] });
      expect(index).toContain('href="/guides/lorem-ipsum"');
      expect(canonical(index)).toBe(`${SITE}/guides`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('the article view renders the synthetic fixture on the test-only page', async ({ page, request }) => {
    const res = await request.get('/__test/article');
    expect(res.status()).toBe(200);
    expect(res.headers()['x-robots-tag']).toBe('noindex');
    expect(await res.text()).toContain('<meta name="robots" content="noindex" />');
    const md = await request.get('/__test/article.md');
    expect(md.headers()['cache-control']).toBe('no-store');

    await page.goto('/__test/article');
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lorem ipsum dolor sit amet');
    const banner = page.getByTestId('draft-banner');
    await expect(banner).toHaveText('Draft, not published. Not yet reviewed by Priyanshi.');
    expect(await banner.getAttribute('role')).toBeNull();
    await expect(page).toHaveTitle('Draft preview · YogaPriyanshi');
    const body = page.getByTestId('article-body');
    await expect(body.getByRole('heading', { level: 2 })).toHaveText(['Ut enim ad minim', 'Excepteur sint', 'Sources']);
    await expect(body.locator('li')).toHaveCount(5);
    // Text, never markup: the script tag shows as words and never runs.
    await expect(body).toContainText("<script>alert('x')</script>");
    expect(await body.locator('script').count()).toBe(0);
    const hrefs = await body.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['https://example.com/lorem', 'https://example.com/source']);
    const link = body.getByRole('link', { name: 'a safe link (opens in a new tab)' });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    // A bullet's label is in ink; the Sources list is smaller and has no accent dots.
    await expect(body.locator('li span.font-medium.text-ink').first()).toHaveText('Irure dolor:');
    const sources = page.getByTestId('article-sources');
    await expect(sources.locator('li')).toHaveCount(2);
    await expect(sources).toHaveClass(/\btext-sm\b/);
    expect(await sources.locator('.bg-accent').count()).toBe(0);
    expect(await sources.locator('span.font-medium').count()).toBe(0);

    const actions = page.locator('#article-actions');
    await actions.getByRole('button', { name: 'Book a free class' }).click();
    await expect(bookingModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(bookingModal(page)).toHaveCount(0);
    await actions.getByRole('button', { name: 'Take the 30-second quiz' }).click();
    await expect(classFinder(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(classFinder(page)).toHaveCount(0);

    // `action: ask`: the class pages' on-request pattern, opening Contact with the article's interest.
    const asked = fs
      .readFileSync(FIXTURE, 'utf-8')
      .replace('reviewedBy:\n', 'reviewedBy:\naction: ask\ninterest: Yin Yoga\n');
    await page.route('**/__test/article.md', (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: asked }));
    await page.goto('/__test/article');
    await settled(page);
    await expect(actions).toContainText(CLASS_PAGE_ON_REQUEST_LINE);
    await expect(actions.getByRole('button', { name: 'Book a free class' })).toHaveCount(0);
    await expect(actions.getByRole('button', { name: 'Take the 30-second quiz' })).toBeVisible();
    await actions.getByRole('button', { name: 'Ask about this class' }).click();
    const dialog = page.getByRole('dialog', { name: 'Send a message' });
    await expect(dialog.getByLabel('Area of Interest')).toHaveValue('Yin Yoga');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.unroute('**/__test/article.md');

    // Draft previews are off in this server (no SHOW_DRAFTS): the routes stay 404s.
    for (const p of ['/drafts/first-yoga-class', '/__drafts/first-yoga-class', '/guides/first-yoga-class']) {
      expect((await request.get(p)).status(), p).toBe(404);
    }
  });

  test.describe('article view at 375px', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    test('no overflow, 44px controls', async ({ page }) => {
      await page.goto('/__test/article');
      await settled(page);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // Inline text links are exempt (WCAG 2.5.8); the back link and the buttons are not.
      const small = await page.locator('main').evaluate((main) =>
        [...main.querySelectorAll<HTMLElement>('button, article > a, #article-actions a')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
          .map(({ el }) => el.textContent)
      );
      expect(small).toEqual([]);
    });
  });
});

// Lints the real drafts in the workspace (outside the repo). Skipped when the folder isn't there (CI, a fresh clone).
// Every assertion is on a boolean or a number, so a failure never prints draft text into the test report.
test('drafts lint: length, sources, links and wording', () => {
  test.skip(!fs.existsSync(DRAFTS_DIR), 'no content-drafts folder');
  const files = fs.readdirSync(DRAFTS_DIR).filter((f) => f.endsWith('.md'));
  expect(files.length).toBeGreaterThanOrEqual(4);
  for (const f of files) {
    const md = fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf-8');
    // A parse error is reported as a boolean, so its message can never carry draft text.
    let article: ReturnType<typeof parseArticle> | null = null;
    try {
      article = parseArticle(md);
    } catch {
      article = null;
    }
    expect(article !== null, `${f}: parses`).toBe(true);
    expect(article!.meta.status === 'draft', `${f}: status is draft`).toBe(true);
    expect(article!.meta.reviewedBy === '', `${f}: reviewedBy is empty`).toBe(true);
    const { body } = splitFrontMatter(md);
    // Like `wc -w` on everything under the front matter.
    const words = body.split(/\s+/).filter(Boolean).length;
    expect(words >= 600 && words <= 900, `${f}: ${words} words`).toBe(true);
    const [prose, sources, ...extra] = body.split(/^## Sources\s*$/m);
    expect(sources !== undefined && extra.length === 0, `${f}: one "## Sources" section`).toBe(true);
    expect(/^#\s/m.test(body), `${f}: no h1 in the body`).toBe(false);
    const items = sources.split('\n').filter((l) => l.startsWith('- '));
    expect(items.length >= 2, `${f}: ${items.length} sources`).toBe(true);
    for (const [i, item] of items.entries()) {
      expect(item.includes('(link to verify)'), `${f}: source ${i + 1} is marked "(link to verify)"`).toBe(true);
      const hrefs = [...item.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
      expect(hrefs.length > 0 || item.includes('URL to confirm'), `${f}: source ${i + 1} has a link or "URL to confirm"`).toBe(true);
    }
    // Every link anywhere is https; never a DOI (none may be invented).
    const allHrefs = [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    expect(allHrefs.every(isSafeHref), `${f}: every link is https`).toBe(true);
    expect(/doi\.org|\b10\.\d{4,9}\//i.test(md), `${f}: no DOI`).toBe(false);
    // The wording guard covers the article itself and skips "## Sources", so the publications' titles
    // stay exact (owner decision, round 3 review item 18; docs/TESTING.md).
    expect(WORDING_GUARD.test(prose.replace(/Spine Healing/g, '')), `${f}: wording guard`).toBe(false);
    expect(FACTS_GUARD.test(md), `${f}: facts guard`).toBe(false);
    expect(/postnatal (yoga )?(training|trained)|trained in postnatal/i.test(md), `${f}: no postnatal training claim`).toBe(false);
  }
});

// Last on purpose (P11): a full production build into a temp folder, with draft previews switched on and a canary draft.
test('build guarantees: pages, 404, sitemap, no draft text, home size and code split', async () => {
  test.setTimeout(240_000);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yp-dist-check-'));
  const out = path.join(tmp, 'dist');
  const drafts = path.join(tmp, 'drafts');
  const canary = `CANARY-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(drafts);
  // A well-formed draft, so nothing but the build's design keeps it out.
  fs.writeFileSync(
    path.join(drafts, 'canary-draft.md'),
    `---\ntitle: ${canary} title\ndescription: ${canary} description\nstatus: published\npublished: 2026-01-01\nreviewedBy: ${canary}\n---\n\n${canary} body.\n`
  );
  try {
    const build = spawnSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], {
      env: { ...process.env, SHOW_DRAFTS: '1', DRAFTS_DIR: drafts },
      encoding: 'utf-8',
      timeout: 200_000,
    });
    expect(build.status, build.stderr).toBe(0);

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(html|js|css|xml|txt|json)$/.test(entry.name)) files.push(full);
      }
    };
    walk(out);
    // Real drafts (outside the repo) must never reach the build either.
    const realDrafts = path.resolve('..', 'content-drafts', 'articles');
    // The dev-only preview code (P7) and the test fixture must be compiled out too.
    const secrets: Array<[string, string]> = [
      ['the canary', canary],
      ['__drafts', '__drafts'],
      ['content-drafts', 'content-drafts'],
      ['the yp-drafts flag', 'yp-drafts'],
      ['the draft banner', 'Draft, not published'],
      ['the test page', '__test/article'],
      ['the test fixture title', parseArticle(fs.readFileSync(FIXTURE, 'utf-8')).meta.title],
    ];
    let realCount = 0;
    if (fs.existsSync(realDrafts)) {
      for (const f of fs.readdirSync(realDrafts).filter((n) => n.endsWith('.md'))) {
        const { meta, blocks } = parseArticle(fs.readFileSync(path.join(realDrafts, f), 'utf-8'));
        const first = blocks.find((b) => b.kind === 'paragraph');
        secrets.push([`${f} title`, meta.title], [`${f} description`, meta.description]);
        if (first?.kind === 'paragraph') secrets.push([`${f} first paragraph`, first.inlines.map((i) => i.text).join('').slice(0, 80)]);
        realCount++;
      }
    }
    console.log(`build guarantee: ${secrets.length} strings checked (${realCount} real drafts) across ${files.length} files`);
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf-8');
      // Labels only in the message, so a failure never prints draft text.
      for (const [label, s] of secrets) expect(text.includes(s), `${label} in ${path.relative(out, f)}`).toBe(false);
    }
    // No guides are published, so none are built, and the preview component has no chunk.
    expect(fs.existsSync(path.join(out, 'guides'))).toBe(false);
    expect(fs.readdirSync(path.join(out, 'assets')).some((n) => /^DraftPreview/.test(n))).toBe(false);

    for (const cls of PRACTICE_CLASSES) {
      const html = fs.readFileSync(path.join(out, 'classes', cls.slug, 'index.html'), 'utf-8');
      expect(decode(h1(html) ?? '')).toBe(cls.name);
      expect(decode(attr(html, /<title>([^<]*)<\/title>/) ?? '')).toBe(`${cls.name} in Dubai · YogaPriyanshi`);
      expect(html).toMatch(/<link rel="modulepreload" crossorigin href="\/assets\/ClassPage-[^"]+\.js">/);
      expect(html).not.toMatch(/(href|src)="\.\//);
      expect(html).not.toContain('faq-jsonld');
    }
    const notFound = fs.readFileSync(path.join(out, '404.html'), 'utf-8');
    expect(notFound).toContain('<meta name="robots" content="noindex" />');
    expect(h1(notFound)).toBe('Page not found');
    expect(notFound).not.toMatch(/(href|src)="\.\//);

    const sitemap = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf-8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${SITE}/`, ...PRACTICE_CLASSES.map((c) => `${SITE}/classes/${c.slug}`)]);
    expect(sitemap).not.toContain('/guides');
    const robots = fs.readFileSync(path.join(out, 'robots.txt'), 'utf-8');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots).toContain('Disallow: /api/');

    const home = fs.readFileSync(path.join(out, 'index.html'), 'utf-8');
    expect(home).toContain('id="faq-jsonld"');
    // The same method as HOME_GZ_BASELINE.
    const homeFiles = [
      ...[...home.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map((m) => m[1]),
      ...[...home.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
      ...[...home.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
    ];
    const read = (url: string) => fs.readFileSync(path.join(out, url.replace(/^\//, '')));
    const gz = homeFiles.reduce((sum, url) => sum + zlib.gzipSync(read(url)).length, 0);
    console.log(`home gz ${gz} (baseline ${HOME_GZ_BASELINE}, +${gz - HOME_GZ_BASELINE})`);
    expect(gz).toBeLessThanOrEqual(HOME_GZ_BASELINE + 5120);
    // The class page copy is only in its lazy chunk, never in what the homepage loads.
    const sentence = CLASS_PAGES.Hatha.about;
    for (const url of homeFiles.filter((u) => u.endsWith('.js'))) {
      const js = read(url).toString('utf-8');
      expect(js.includes(sentence), url).toBe(false);
      expect(js.includes(CLASS_PAGE_ON_REQUEST_LINE), url).toBe(false);
    }
    const lazy = fs.readdirSync(path.join(out, 'assets')).find((f) => /^ClassPage-.+\.js$/.test(f))!;
    expect(fs.readFileSync(path.join(out, 'assets', lazy), 'utf-8')).toContain(sentence);
    // The owner's on-request line is shared with on-request articles (src/constants/on-request.ts): a lazy
    // chunk that the class pages preload, never one the homepage loads.
    const lineChunk = fs
      .readdirSync(path.join(out, 'assets'))
      .filter((f) => f.endsWith('.js'))
      .find((f) => fs.readFileSync(path.join(out, 'assets', f), 'utf-8').includes(CLASS_PAGE_ON_REQUEST_LINE))!;
    expect(lineChunk).toBeTruthy();
    expect(homeFiles.some((u) => u.endsWith(`/${lineChunk}`))).toBe(false);
    const vinyasa = fs.readFileSync(path.join(out, 'classes', 'vinyasa', 'index.html'), 'utf-8');
    expect(vinyasa).toContain(`href="/assets/${lineChunk}"`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
