import type { APIRequestContext, CDPSession, Locator, Page } from '@playwright/test';
import { test, expect, stepShooter, openHome, bookingModal } from './helpers';

const FEATURE = 'apple-design';

/** The soonest available session of a timetable style (what a bookable card preselects). */
async function soonest(request: APIRequestContext, style: string) {
  const { sessions } = await (await request.get('/api/schedule')).json();
  const s = sessions
    .filter((x: any) => !x.isRestDay && x.status === 'available' && x.style === style)
    .sort((a: any, b: any) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc))[0];
  expect(s, `an available ${style} session exists`).toBeTruthy();
  return s;
}

/** A real touch stream through CDP (pointerType "touch", like a finger on a phone). */
function finger(cdp: CDPSession, page: Page) {
  let at = { x: 0, y: 0 };
  return {
    down: async (x: number, y: number) => {
      at = { x, y };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    },
    /** Moves by (dx, dy) in `steps` events, one per ~16ms frame. */
    move: async (dx: number, dy: number, steps = 6) => {
      const from = at;
      for (let i = 1; i <= steps; i++) {
        at = { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
        await page.waitForTimeout(16);
      }
    },
    up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    /** The system takes the touch away (pointercancel), as an incoming call or a gesture would. */
    cancel: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }),
  };
}

const top = async (el: Locator) => (await el.boundingBox())!.y;

/** Opens the phone booking sheet from the hero and waits until it has fully risen. */
async function openPhoneSheet(page: Page, height: number) {
  await openHome(page);
  await page.locator('#home').getByRole('button', { name: 'Book a free class' }).click();
  const dialog = page.getByRole('dialog', { name: 'Select practice' });
  await expect(dialog.locator('select option').first()).toBeAttached();
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height)).toBe(height);
  return dialog;
}

test('buttons and class cards give way the moment they are pressed', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const cta = page.locator('#home').getByRole('button', { name: 'Book a free class' });
  const scale = (el: Locator) => el.evaluate((node) => getComputedStyle(node).scale);
  await cta.hover();
  await page.mouse.down();
  await expect.poll(() => scale(cta)).toBe('0.97');
  await shot('cta-pressed');
  await page.mouse.up();
  await expect(bookingModal(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bookingModal(page)).toHaveCount(0);
  await expect.poll(() => scale(cta)).toBe('none');

  const card = page.locator('#classes').getByRole('button', { name: /^Barre/ });
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.mouse.down();
  await expect.poll(() => scale(card)).toBe('0.98');
  await page.mouse.up();
  await expect(bookingModal(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bookingModal(page)).toHaveCount(0);

  // Wide rows give far less (0.99), and ease into it instead of jumping in one frame.
  const row = page.locator('#pricing li button').first();
  await row.scrollIntoViewIfNeeded();
  const transition = await row.evaluate((node) => getComputedStyle(node).transitionProperty);
  expect(transition === 'all' || transition.split(', ').includes('scale'), `transition lists scale (${transition})`).toBe(true);
  await row.hover();
  await page.mouse.down();
  await expect.poll(() => scale(row)).toBe('0.99');
  expect(Number(await scale(row))).toBeGreaterThanOrEqual(0.99);
  await page.mouse.up();
  await expect(bookingModal(page)).toBeVisible();
});

test.describe('phone sheet', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the sheet opens without overshooting the bottom edge', async ({ page }) => {
    await openHome(page);
    // Record the sheet's bottom edge every frame while it rises.
    await page.evaluate(() => {
      const w = window as any;
      w.__sheetBottoms = [];
      const t0 = performance.now();
      const tick = () => {
        const d = document.querySelector('[role="dialog"]');
        if (d) w.__sheetBottoms.push(d.getBoundingClientRect().bottom);
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.locator('#home').getByRole('button', { name: 'Book a free class' }).click();
    await expect(page.getByRole('dialog', { name: 'Select practice' })).toBeVisible();
    await page.waitForTimeout(800);
    const bottoms: number[] = await page.evaluate(() => (window as any).__sheetBottoms);
    expect(bottoms.length, 'frames sampled during the open').toBeGreaterThan(5);
    expect(Math.min(...bottoms), 'the sheet bottom never rises above the viewport bottom').toBeGreaterThanOrEqual(844 - 0.5);
    expect(Math.round(bottoms[bottoms.length - 1])).toBe(844);
  });

  test('a downward flick on the grabber dismisses the sheet', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const dialog = await openPhoneSheet(page, 844);
    const grabber = dialog.getByTestId('sheet-grabber');
    await expect(grabber).toHaveAttribute('aria-hidden', 'true');
    await shot('sheet-open');

    const cdp = await page.context().newCDPSession(page);
    const f = finger(cdp, page);
    const box = (await grabber.boundingBox())!;
    const restTop = await top(dialog);
    await f.down(box.x + box.width / 2, box.y + 20);
    await f.move(0, 120);
    // 1:1 while dragging, and the scrim lightens with it.
    expect(Math.abs((await top(dialog)) - restTop - 120)).toBeLessThanOrEqual(2);
    const scrim = page.locator('.material-scrim');
    const scrimOpacity = Number(await scrim.evaluate((el) => getComputedStyle(el).opacity));
    expect(scrimOpacity).toBeGreaterThan(0);
    expect(scrimOpacity).toBeLessThan(1);
    await shot('dragging');
    await f.move(0, 160, 4);
    await f.up();
    await expect(bookingModal(page)).toHaveCount(0);
    await shot('dismissed');
  });

  test('a short, slow drag springs back, and an upward drag only rubber-bands', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const dialog = await openPhoneSheet(page, 844);
    const box = (await dialog.getByTestId('sheet-grabber').boundingBox())!;
    const restTop = await top(dialog);
    const cdp = await page.context().newCDPSession(page);
    const f = finger(cdp, page);

    await f.down(box.x + box.width / 2, box.y + 20);
    await f.move(0, 80);
    expect(Math.abs((await top(dialog)) - restTop - 80)).toBeLessThanOrEqual(2);
    await page.waitForTimeout(200); // hold still, so the release carries no momentum
    await f.up();
    await expect.poll(async () => Math.round((await top(dialog)) - restTop)).toBe(0);
    await expect(dialog).toBeVisible();
    await shot('sprung-back');

    // Upwards it resists: 100px of finger moves it far less than 100px.
    await f.down(box.x + box.width / 2, box.y + 20);
    await f.move(0, -100);
    const lifted = restTop - (await top(dialog));
    expect(lifted).toBeGreaterThan(5);
    expect(lifted).toBeLessThan(60);
    await f.up();
    await expect.poll(async () => Math.round((await top(dialog)) - restTop)).toBe(0);
    await expect(dialog).toBeVisible();
  });

  test('a cancelled touch on the grabber springs back and never dismisses', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const dialog = await openPhoneSheet(page, 844);
    const box = (await dialog.getByTestId('sheet-grabber').boundingBox())!;
    const restTop = await top(dialog);
    const cdp = await page.context().newCDPSession(page);
    const f = finger(cdp, page);

    // A fast pull past half the sheet: released, this would dismiss it.
    await f.down(box.x + box.width / 2, box.y + 20);
    await f.move(0, 300, 4);
    expect((await top(dialog)) - restTop).toBeGreaterThan(250);
    await f.cancel();
    await expect.poll(async () => Math.round((await top(dialog)) - restTop)).toBe(0);
    await expect(dialog).toBeVisible();
    await shot('cancel-sprung-back');
  });

  test('touching the sheet content scrolls it natively and fields still work', async ({ page }, info) => {
    test.info().annotations.push({ type: 'note', description: 'short viewport so the contact form overflows' });
    await page.setViewportSize({ width: 390, height: 560 });
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    await page.locator('#contact').getByRole('button', { name: 'Contact Priyanshi' }).click();
    const dialog = page.getByRole('dialog', { name: 'Send a message' });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height)).toBe(560);
    const restTop = await top(dialog);
    expect(await dialog.evaluate((el) => el.scrollHeight > el.clientHeight), 'the form overflows').toBe(true);

    const cdp = await page.context().newCDPSession(page);
    const f = finger(cdp, page);
    const box = (await dialog.boundingBox())!;
    await f.down(box.x + box.width / 2, box.y + box.height - 60);
    await f.move(0, -200, 8);
    await f.up();
    await expect.poll(() => dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(Math.round((await top(dialog)) - restTop), 'content touches never drag the sheet').toBe(0);
    await shot('content-scrolled');

    const name = dialog.locator('#contact-name');
    await name.tap();
    await name.fill('Touch Student');
    await expect(name).toHaveValue('Touch Student');
    await expect(dialog).toBeVisible();
  });

  test('a tap on a class card still opens booking with that class', async ({ page, request }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const hatha = await soonest(request, 'hatha');
    await openHome(page);
    const card = page.locator('#classes').getByRole('button', { name: /^Hatha/ });
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    const modal = bookingModal(page);
    await expect(modal.locator('select')).toHaveValue(hatha.id);
    await shot('tap-opened');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the sheet still drags; snap-back is instant and dismiss closes at once', async ({ page }, info) => {
      const shot = stepShooter(page, FEATURE, info.title);
      const dialog = await openPhoneSheet(page, 844);
      const box = (await dialog.getByTestId('sheet-grabber').boundingBox())!;
      const restTop = await top(dialog);
      const cdp = await page.context().newCDPSession(page);
      const f = finger(cdp, page);

      await f.down(box.x + box.width / 2, box.y + 20);
      await f.move(0, 80);
      expect(Math.abs((await top(dialog)) - restTop - 80)).toBeLessThanOrEqual(2);
      await page.waitForTimeout(200);
      await f.up();
      // No spring: back at rest on the very next frame.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
      expect(Math.round((await top(dialog)) - restTop)).toBe(0);
      await shot('instant-snap-back');

      await f.down(box.x + box.width / 2, box.y + 20);
      await f.move(0, 300, 4);
      await f.up();
      await expect(bookingModal(page)).toHaveCount(0, { timeout: 1000 });
    });
  });
});

test.describe('desktop carousel', () => {
  async function snapState(track: Locator) {
    return track.evaluate((el) => {
      const origin = el.getBoundingClientRect().left - el.scrollLeft;
      const max = el.scrollWidth - el.clientWidth;
      const offsets = [...el.querySelectorAll('[data-testid="practice-card"]')].map((c) =>
        Math.min(Math.max(Math.round(c.getBoundingClientRect().left - origin), 0), max)
      );
      return { left: el.scrollLeft, offsets, gliding: el.hasAttribute('data-gliding') };
    });
  }

  /** Waits until the track has stopped moving and returns where it rests. */
  async function rest(page: Page, track: Locator) {
    let prev = -1;
    await expect
      .poll(async () => {
        const s = await snapState(track);
        const still = !s.gliding && Math.abs(s.left - prev) < 0.5;
        prev = s.left;
        return still;
      }, { intervals: [100] })
      .toBe(true);
    return snapState(track);
  }

  /** Waits until the element takes pointer events (the intro loader has gone) and its reveal has settled. */
  async function settledBox(el: Locator) {
    await el.hover();
    let prev = NaN;
    await expect
      .poll(async () => {
        const y = (await el.boundingBox())!.y;
        const still = Math.abs(y - prev) < 0.5;
        prev = y;
        return still;
      }, { intervals: [100] })
      .toBe(true);
    return (await el.boundingBox())!;
  }

  const onSnap = (s: { left: number; offsets: number[] }) => s.offsets.some((o) => Math.abs(o - s.left) <= 1);

  test('a mouse drag throws the track onto a snap point without opening a class', async ({ page }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    await openHome(page);
    const classes = page.locator('#classes');
    await classes.scrollIntoViewIfNeeded();
    const track = classes.getByRole('group', { name: /Classes/ });
    const card = classes.getByRole('button', { name: /^Barre/ });
    const box = await settledBox(card);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 4 });
    // 1:1: 40px of mouse is 40px of scroll (less the 10px threshold never being lost).
    expect(Math.round((await snapState(track)).left)).toBe(40);
    await page.mouse.move(box.x + box.width / 2 - 220, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(bookingModal(page)).toHaveCount(0);
    const after = await rest(page, track);
    expect(after.left).toBeGreaterThan(0);
    expect(onSnap(after), `rests on a snap (${after.left} in ${after.offsets})`).toBe(true);
    await shot('thrown');

    // The arrows glide to the exact next snap too.
    await classes.getByRole('button', { name: 'Next classes' }).click();
    const next = await rest(page, track);
    expect(next.left).toBeGreaterThan(after.left);
    expect(onSnap(next)).toBe(true);

    // Pulling past the start rubber-bands, then settles back at 0.
    await track.evaluate((el) => el.scrollTo({ left: 0 }));
    await rest(page, track);
    const first = await settledBox(classes.getByRole('button', { name: /^Hatha/ }));
    await page.mouse.move(first.x + 40, first.y + 100);
    await page.mouse.down();
    await page.mouse.move(first.x + 200, first.y + 100, { steps: 6 });
    const band = await track.evaluate((el) => parseFloat(getComputedStyle(el).translate) || 0);
    expect(band).toBeGreaterThan(0);
    expect(band).toBeLessThan(160);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'the stretched track never widens the page').toBeLessThanOrEqual(0);
    await page.mouse.up();
    await expect.poll(() => track.evaluate((el) => getComputedStyle(el).translate)).toBe('none');
    expect((await rest(page, track)).left).toBe(0);
    await expect(bookingModal(page)).toHaveCount(0);
  });

  test('a press released off the track does not leave a drag behind', async ({ page, request }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const barre = await soonest(request, 'barre');
    await openHome(page);
    const classes = page.locator('#classes');
    await classes.scrollIntoViewIfNeeded();
    const track = classes.getByRole('group', { name: /Classes/ });
    const card = classes.getByRole('button', { name: /^Barre/ });
    const box = await settledBox(card);
    const trackBox = (await track.boundingBox())!;
    const startLeft = (await snapState(track)).left;

    // Press on a card, slide straight down off the track (no sideways travel, so no drag starts)
    // and let go out there, where the track never hears the release.
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height - 20);
    await page.mouse.down();
    await page.mouse.move(x, trackBox.y + trackBox.height + 24, { steps: 3 });
    await page.mouse.up();

    // Hovering back across the track with no button held is just a hover.
    await page.mouse.move(x, box.y + box.height / 2, { steps: 3 });
    await page.mouse.move(x - 160, box.y + box.height / 2, { steps: 8 });
    const s = await snapState(track);
    expect(Math.abs(s.left - startLeft)).toBeLessThanOrEqual(1);
    expect(await track.evaluate((el) => el.hasAttribute('data-dragging') || el.hasAttribute('data-gliding'))).toBe(false);
    await shot('hover-after-stale-press');

    // And a plain click still opens the class.
    await card.click();
    await expect(bookingModal(page).locator('select')).toHaveValue(barre.id);
  });

  test('a plain click on a card still opens booking with that class', async ({ page, request }, info) => {
    const shot = stepShooter(page, FEATURE, info.title);
    const barre = await soonest(request, 'barre');
    await openHome(page);
    const classes = page.locator('#classes');
    await classes.scrollIntoViewIfNeeded();
    await classes.getByRole('button', { name: /^Barre/ }).click();
    const modal = bookingModal(page);
    await expect(modal.locator('select')).toHaveValue(barre.id);
    await shot('click-opened');
  });
});

test('reduced transparency turns every glass surface solid', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await openHome(page);
  const bar = page.locator('header > div').first();
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect(bar).toHaveClass(/material-bar/);
  const style = (el: Locator) =>
    el.evaluate((n) => {
      const cs = getComputedStyle(n);
      return { bg: cs.backgroundColor, blur: cs.backdropFilter, display: cs.display };
    });
  await expect.poll(async () => (await style(bar)).blur).toContain('blur(20px)');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await expect.poll(async () => (await style(bar)).blur).toBe('none');
  expect((await style(bar)).bg).toBe('rgb(244, 246, 242)');
  expect((await style(page.locator('header .scroll-edge'))).display).toBe('none');
  const card = page.getByTestId('practice-card').first();
  expect(await style(card)).toMatchObject({ bg: 'rgb(250, 251, 248)', blur: 'none' });
  await shot('solid');

  await page.locator('#home').getByRole('button', { name: 'Book a free class' }).click();
  await expect(bookingModal(page)).toBeVisible();
  expect((await style(page.locator('.material-scrim'))).blur).toBe('none');
});

test('more contrast gives the bars and glass a solid fill and a defined ink edge', async ({ page }, info) => {
  const shot = stepShooter(page, FEATURE, info.title);
  await page.emulateMedia({ contrast: 'more' });
  await openHome(page);
  const bar = page.locator('header > div').first();
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect(bar).toHaveClass(/material-bar/);
  const style = (el: Locator) =>
    el.evaluate((n) => {
      const cs = getComputedStyle(n);
      return { bg: cs.backgroundColor, blur: cs.backdropFilter, shadow: cs.boxShadow };
    });
  await expect.poll(async () => (await style(bar)).blur).toBe('none');
  const b = await style(bar);
  expect(b.bg).toBe('rgb(244, 246, 242)');
  expect(b.shadow).toContain('rgb(28, 38, 33)');
  const c = await style(page.getByTestId('practice-card').first());
  expect(c.bg).toBe('rgb(250, 251, 248)');
  expect(c.shadow).toContain('rgb(28, 38, 33)');
  await shot('contrast');
});
