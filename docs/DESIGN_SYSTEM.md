# Design System: "Mandala Bloom"

**Status:** v1 approved 2026-10-11. This replaces v0, which described the old AI Studio look. This file is the design law for every page and every agent (planner, worker, design reviewer).

- **Approved concept:** "A · Mandala Bloom", reference file `design/concepts/mandala-bloom-approved.html` (private workspace, section `#c1`).
- **Palette chosen 2026-10-12: D · Botanical Zen** (soft off-white, deep forest ink, olive-sage accent), picked for low-glare, restful reading. All text pairs pass 4.5:1 (body 6.4:1, accent text 6.9:1). It can be swapped any time by editing only the §2 token block.
- **Previously provisional colours.** They are grey-gold placeholders, picked last from options A–F. Every colour is a token (§2), so swapping the palette is a one-place change.

---

## 1. Visual theme & atmosphere

**Feel:** calm, a treat to the eyes, divine. It should feel like a quiet studio at dawn: centred, airy, unhurried.

**The signature:** a fine-line **mandala** sits behind the whole page. It slowly turns and opens like a lotus as you scroll. It's the only big effect; everything else stays still and quiet.

**Principles:**
1. **One idea per section.** A headline, at most one short line, and one action.
2. **Air over decoration.** Space separates things, not borders or boxes.
3. **Real photos of Priyanshi** carry the emotion. No stock photos or AI images.
4. **Motion is slow and soft:** fades, gentle lifts, the mandala. Never bouncy or fast.

---

## 2. Colour palette & roles: "Botanical Zen" (chosen 2026-10-12)

Define these in `src/index.css` under Tailwind v4 `@theme`. Components use **only** these tokens (`bg-bg`, `text-ink`, `border-line`, …): **no hex values in components, no `!important`, no theme switcher.**

```css
@theme {
  /* Backgrounds */
  --color-bg: #f4f6f2;          /* page background */
  --color-surface: #fafbf8;     /* cards, modal (solid) */
  --color-surface-alt: #e8ebe4; /* alternate section band, inputs */
  --color-glass: rgb(255 255 255 / 0.6); /* carousel cards over the mandala */

  /* Lines */
  --color-line: #d3d9cf;        /* hairlines, card borders */
  --color-line-strong: #a9b5a6; /* hover borders, focus fallback */

  /* Text */
  --color-ink: #1c2621;         /* headings, primary text, primary button */
  --color-ink-soft: #4f5d55;    /* body copy, descriptions (≥4.5:1 on bg) */
  --color-ink-faint: #84907f;   /* labels on large text only */

  /* Accent (gold) */
  --color-accent: #4e6b5d;      /* mandala strokes, italic highlight, dots */
  --color-accent-text: #3f5a4d; /* accent used as small text (≥4.5:1 on bg) */
  --color-on-ink: #f4f6f2;      /* text on ink buttons */

  /* States */
  --color-success: #3f6f55;
  --color-error: #9b3b32;
  --color-error-bg: #f6e9e6;
  --color-calm-bg: #e8ebe4;     /* gentle notices, e.g. the "I'm so sorry" rebook message */
}
```

**Rules:**
- At most **one accent per section**. Gold is for highlights, never for large fills.
- **Body text uses `ink-soft`, never lighter.**
  - `ink-faint` is only for labels on text that is 18px or larger.
  - Gold text must use `accent-text`.
- Status colours (`success` / `error`) mean status only, never decoration.
- When the final palette is chosen, only this block changes.

---

## 3. Typography

Self-hosted with `@fontsource` (latin subset only, no Google Fonts request):

```ts
// src/main.tsx
import '@fontsource/italiana/latin-400.css';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
```

```html
<!-- index.html: preload the three files used above the fold (Vite fingerprints them) -->
<link rel="preload" as="font" type="font/woff2" crossorigin href="./node_modules/@fontsource/italiana/files/italiana-latin-400-normal.woff2" />
<link rel="preload" as="font" type="font/woff2" crossorigin href="./node_modules/@fontsource/figtree/files/figtree-latin-400-normal.woff2" />
<link rel="preload" as="font" type="font/woff2" crossorigin href="./node_modules/@fontsource/figtree/files/figtree-latin-600-normal.woff2" />
```

```css
@theme {
  --font-display: "Italiana", "Italiana Fallback", "Didot", Georgia, serif;           /* headings only */
  --font-sans: "Figtree", "Figtree Fallback", -apple-system, "Segoe UI", Roboto, sans-serif; /* everything else */
}
```

`index.css` defines the `"Figtree Fallback"` (local Arial) and `"Italiana Fallback"` (local Times New Roman) faces with `size-adjust` / `ascent-override` / `descent-override` measured against the real fonts, so the swap causes no layout shift.

**One font pair, everywhere.** Italiana is for headings, class names and quotes; Figtree is for all other text. No third font.

| Role | Font | Size (mobile → desktop) | Line height | Notes |
|---|---|---|---|---|
| Display (hero) | Italiana | `clamp(44px, 8vw, 92px)` | 0.98 | One per page; `text-wrap: balance` |
| H2 (section) | Italiana | `clamp(34px, 5.5vw, 58px)` | 1.05 | |
| H3 (card title) | Italiana | `28px` | 1.1 | Class names, teacher name |
| Modal / panel title | Italiana | `34px` → `40px` from `sm` | 1.05 | Modal headings and the schedule detail panel (`ui.title`) |
| Quote | Italiana | `clamp(26px, 4vw, 40px)` | 1.25 | Italic is fine (browser-slanted) |
| Body | Figtree 400 | `16px` | 1.6 | Max width 46ch |
| Small | Figtree 400 | `14px` | 1.5 | Card lines, helper text |
| Label / eyebrow | Figtree 600 | `12px`, uppercase, `letter-spacing: .14em` (hero eyebrow `.3em`) | 1.4 | |
| Button | Figtree 600 | `12px`, uppercase, `letter-spacing: .14em` | 1 | |

**Rules:**
- **Italiana has one weight (400). Never bold it**, because faux bold looks broken.
- Never use Italiana below 24px; it's too thin to read.
- **No text under 12px, and body copy is never under 14px.** (The old site had 94 places at 9–11px; all of them go.)
- Every heading gets `text-wrap: balance`.

---

## 4. Components

All components have default, hover, focus-visible, active and disabled states. Focus is always a visible ring: `outline: 2px solid var(--color-accent-text); outline-offset: 3px` (accent-text keeps the ring at 3:1 or better against the page).

### Buttons
| Variant | Style | Use |
|---|---|---|
| Primary | `bg-ink text-on-ink`, pill (`rounded-full`), `px-[22px] py-[14px]`, min height 48px | The one main action per section ("Book a free class") |
| Secondary | Transparent, `border border-line text-ink`, pill | Second action ("View classes") |
| Icon | 44×44 circle, `border border-line` | Carousel arrows, close, copy |

- **Hover:** primary gets slightly lighter ink (`opacity-90`); secondary and icon get `border-ink`.
- **Disabled:** `opacity-40`, `cursor-not-allowed`.

### Class card (carousel item)
- Base: `bg-glass backdrop-blur-[8px] rounded-[18px] overflow-hidden`.
- Photo on top, `min-height: 260px`.
- Text area `p-4 pb-5`:
  - Title: H3, Italiana 28px.
  - **One line:** `"<benefit> · <duration>"` (e.g. "Alignment and breath · 60 min"), 14px, `ink-soft`.
- Hover: `translateY(-4px)` over 500ms. The whole card is a button.
- **What a tap does:**
  - The 4 bookable classes (Hatha, Barre, Wheel, Chakra Flow) open the booking with the soonest session of that style preselected.
  - The 4 new classes (Spine Healing, Mobility Yoga, Yin Yoga, Prenatal & Postnatal) aren't on the timetable yet, so they open the contact pop-up with that class preset as the interest.

### Carousel ("Choose your practice")
- A horizontal scroll with `scroll-snap-type: x mandatory`. Card width `min(78%, 300px)`, gap 16px.
- Prev and next icon buttons sit at the top right (hidden on touch-only screens is fine); keyboard focusable, scrollable with the arrow keys.
- The 8 classes, in this order: Hatha, Barre, Wheel, Chakra Flow, Spine Healing, Mobility Yoga, Yin Yoga, Prenatal & Postnatal. The durations of the 4 new classes are placeholders until Priyanshi confirms them.

### Header / navigation
- Wordmark "YogaPriyanshi" (Italiana 24px) on the left. Links (Classes, Schedule, About, Contact) are labels (12px uppercase). The primary button "Book free class" sits on the right. Nothing else goes in the header.
- Transparent over the hero. After 80px of scroll it becomes `bg-bg/85` with backdrop blur and a hairline bottom border.
- On mobile: wordmark plus a menu icon, opening a full-screen calm overlay with links in Italiana 34px.
- "Manage booking" and "Studio admin" live in the mobile overlay and the footer, not in the header.

### Sticky book bar (mobile only)
- Appears after the hero leaves view: a bottom bar with `bg-bg/90`, blur, safe-area padding, holding one primary button "Book a free class".
- Hides again while "Your first class is free" (`#first-class`) or Contact (`#contact`) is on screen, since both have their own dark button.

### Booking modal (and Cancel / Admin / Contact modals)
- All four use one shell, `ModalSheet.tsx`: focus trap, Escape, focus returns to the opener, the page behind is `inert`, and Lenis is stopped while open. Admin may use a wider sheet (1040px).
- A centred sheet: `bg-surface rounded-[20px]`, max width 560px, inner padding 32px (20px on mobile). The backdrop is `bg-ink/60` with blur.
- On mobile it becomes a bottom sheet with full width and top corners rounded.
- Steps show as "Step 1 of 2" (label style).
- **Keep every existing behaviour, `data-testid`, role and label.** Restyle only.
- **Notices:**
  - Errors: `bg-error-bg text-error`.
  - Gentle notices (rebook refused, "no other sessions"): `bg-calm-bg text-ink`.
  - All of them keep `role="alert"`.

### Forms
- Inputs: `bg-surface-alt rounded-[12px]`, height 48px, 16px text (prevents iOS zoom), label above (12px uppercase).
- Focus: a `border-ink` ring. Errors appear inline under the field, 14px, in `error`.
- Placeholders use `ink-soft`.
- A field with an error gets `aria-invalid` and `aria-describedby` pointing at its message; the summary `role="alert"` stays above the form.
- After a successful submit (booking, cancel, contact), focus moves to the result heading (`tabIndex={-1}`) so screen readers announce it.

### Contact
- The Contact section is a heading, one address line and a primary button "Contact Priyanshi". The button opens the contact form in a pop-up (the same sheet as the booking modal), not an inline form.
- The form: name, email, phone (optional, `type="tel"`), interest and message.

### Schedule
- A segmented week switcher (This Week / Next Week / Week 3) and a refresh icon button. One glass card per day (a `<button>`, `rounded-[18px]`); the selected card is `bg-ink text-on-ink`. Friday is a dashed "Rest Day" card.
- Full and past cards fade the surface only (no glass, `border-dashed border-line`); their text keeps the normal tokens, never `opacity`.
- A glass detail panel for the selected session: one meta line ("60 min · Beginner · In person or online") and the primary "Book This Class (N Left)" button. Then one "good to know" line ("Mats and props provided. Online? Your Zoom link arrives an hour before.") and the secondary "Cancel / Manage Reservation" button.

### Pricing
- A hairline list (`border-line`), transparent so the mandala shows through: 4 rows, each a `<button>` that opens booking with that plan (name in Italiana 28px, one short line, the price, an arrow icon). One line below: "Pay at the studio. Free cancellation up to 6 hours before class."

### Footer
- Transparent with a hairline top border: wordmark, address, Instagram, the quiet buttons "Manage booking" and "Studio admin", and the copyright line (14px). The policy lives in Pricing, not here. No dark bands anywhere on the page.

### Teacher block ("Hi, I'm Priyanshi.")
- Two columns on desktop (photo | text), stacked on mobile. Photo `min-height: 380px`, `rounded-[4px]`.
- The heading is H2. One sentence of body text, max.

### Quote
- Centred, max 24ch, Italiana. No quotation-mark graphics, no attribution clutter.

---

## 5. Layout principles

**Container:**
- Max width 1040px, side padding 20px (`px-5`).
- Narrow container for text-only blocks: 640px.

**Spacing scale (4px base):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.

| Use | Value |
|---|---|
| Section padding (block) | 128px desktop / 80px mobile |
| Gap inside a section (heading → content) | 24px |
| Gap between cards | 16px |
| Card padding | 16–20px |
| Hero | `min-height: 92vh`, centred |

**Rules:**
- Spacing between siblings uses `gap`, never stacked margins.
- Only values from the scale; no `mt-[37px]`.

**Text budget, to avoid clutter:**
- Each section has **one heading, at most one line of body (about 15 words) and at most one button.**
- Longer content (class details, chakra knowledge, policies) goes on its own page or behind a tap, never on the homepage.

**Homepage order:**
1. Hero: "Connect with your body." / "Yoga with Priyanshi. Your first class is on us." / [Book a free class]
2. Choose your practice: the carousel of 8 classes.
3. Hi, I'm Priyanshi.: photo plus one line.
4. Quote: "Yoga is the journey of the self, through the self, to the self."
5. Schedule: this week's classes with spots left (existing live schedule, restyled).
6. Pricing: free first class, single, 10-pack, 20-pack (compact, pay at studio).
7. Your first class is free: "Classes every day except Friday · in person or online" / [Pick a time]
8. Contact: the address plus a "Contact Priyanshi" button that opens the form in a pop-up. Footer.

Testimonials and the photo gallery come back once real ones exist.

---

## 6. Depth & elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | none | Sections, text |
| Glass | `bg-glass` + `backdrop-blur-[8px]` | Carousel cards over the mandala |
| Raised | `shadow-[0_8px_30px_rgb(43_38_32/0.08)]` | Modals, sticky header after scroll |

**No other shadows.** Borders are hairlines (`border-line`) and used rarely.

---

## 7. Animation & interaction

**Motion philosophy:** slow, soft and few. One signature (the mandala), gentle reveals, small lifts on hover.
**Tier:** L2 (scroll-linked background plus entrance reveals). No pinning or scroll-jacking.

### Dependencies (from the toolkit in `design/DESIGN-PHASE.md` §1)
- **Lenis** (`lenis`): smooth scrolling.
- **motion** (already installed): reveals, modal and sheet transitions.
- **Animate UI icons** (`npx shadcn@latest add @animate-ui/icons-…`): arrow, check, copy, menu and close icons, which animate gently on hover or tap.

### Base setup
```tsx
// main.tsx / App.tsx
import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import { MotionConfig } from 'motion/react';

<MotionConfig reducedMotion="user">
  <ReactLenis root options={{ lerp: 0.08, anchors: { offset: -88 } }}>
    <App />
  </ReactLenis>
</MotionConfig>
// Scrollable modals get data-lenis-prevent so their own scroll still works.
```

### The mandala (signature effect)
- One `<canvas>` in a fixed, full-screen background layer (`position: fixed; inset: 0; z-index: -1; pointer-events: none`).
- Centred, size `min(115vmin, 980px)`.
- Five rings of petals, with 12 / 16 / 24 / 32 / 48 petals. Alternate rings are drawn in `accent` at 42% and `ink` at 16%, with hairline circles between them.
- **Scroll progress `p` (0 → 1) over the page drives it:**
  - rotation `p × 135°`;
  - bloom (scale) `0.62 + p × 0.45`.
- Redraw only inside `requestAnimationFrame`, cap DPR at 2, and pause when the tab is hidden.
- Stroke colours are read from the CSS tokens, so a palette change recolours the mandala too.
- It must never block the content: it sits behind everything, and a mobile frame takes under 4ms to draw.

### Entrance (scroll reveal)
- Each section goes from `opacity .15 → 1` and `translateY(18px → 0)` over 900ms, eased `cubic-bezier(.2,.7,.2,1)`, when 15% of it is visible.
- **Never start fully hidden.** The page must read correctly before any JavaScript or animation runs.

### Hero word fade (approved 2026-10-12)
- The hero headline appears word by word: each word rises 8px out of an 8px blur over 1.1s, staggered 180ms. The eyebrow, line and button follow. It takes about 2s in total, plays once on load, and is pure CSS (`.word-fade` in `index.css`).
- This is the one exception to "never start fully hidden": it runs without JavaScript and ends within about 2s. With reduced motion everything shows at once.

### Hover & focus
- Cards lift 4px over 500ms.
- Buttons take 200ms colour transitions.
- Icon buttons change border, and their Animate UI icon animates once.
- Focus rings are always visible (§4).

### Modals
- They fade in plus a 12px rise over 300ms.
- On mobile, the bottom sheet slides up over 350ms.
- The backdrop fades.

### Reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  /* Lenis switches off its smoothing automatically; MotionConfig reducedMotion="user" disables transforms */
  .reveal { opacity: 1 !important; transform: none !important; } /* the one allowed !important: accessibility override */
  .card-lift:hover { transform: none; }
}
```
With reduced motion on, the mandala is drawn once, fully bloomed and still.

---

## 8. Do's and don'ts

**Do:**
- Use tokens for every colour, size and spacing value.
- Keep one heading, one line and one action per section.
- Use Priyanshi's real photos and videos, compressed (WebP or AVIF; videos under 20 MB, muted, `playsinline`).
- Keep all booking, cancel, contact and admin behaviour and test ids. All e2e tests (35 today) must stay green.
- Check 375px and 1280px screenshots for every changed section.

**Don't:**
- No new fonts, no bold Italiana, no text under 12px.
- No hex values or `!important` in components, and no theme switcher.
- No extra effects: no particles, cursor trails, parallax on every image, bouncing, typewriter text or auto-playing carousels.
- No stock or AI photos, and no emoji as icons.
- No fake data: no sample numbers, no fake reviews, no "success" when the server failed.
- No long paragraphs on the homepage.

---

## 9. Responsive behaviour

| Breakpoint | Changes |
|---|---|
| < 640px (phone) | Single column. Section padding 80px. Hero display at its clamp minimum. Carousel cards 78% wide. Teacher block stacks. Header uses the menu overlay. Sticky book bar on. Modals become bottom sheets. |
| 640–1024px (tablet) | Two-column teacher block. Carousel cards 300px. Header links visible from 900px. |
| > 1024px (desktop) | Container 1040px. Section padding 128px. Carousel arrows visible. |

- No horizontal scroll at any width.
- Touch targets are at least 44×44.
- Inputs use 16px text.

---

## 10. Accessibility

- Text contrast at least 4.5:1, which the tokens in §2 are chosen for. Re-check this when the final palette arrives.
- Every image has `alt`. The mandala canvas is `aria-hidden`.
- The carousel is keyboard reachable, and its arrow buttons have `aria-label`s.
- Modals trap focus, close on Escape, and return focus to the button that opened them.
- Errors use `role="alert"`. Live updates (e.g. "Copied") use `aria-live="polite"`.

---

## 11. Quality checklist

Every change passes these before it ships:
- the web-design skill's 100-point checklist (`.claude/skills/web-design/references/quality-checklist.md`);
- the reviewer agents (code, design, mobile and accessibility);
- a Lighthouse check through BrowserTools when available (aim for 90+ on performance and accessibility on mobile).
