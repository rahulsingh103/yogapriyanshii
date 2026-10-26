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

Heading sizes are `@theme` type tokens in `index.css`. Each token carries its size, leading and (for the two largest) tracking, so a heading uses one class (`text-display`, `text-h2`, …) and never arbitrary `text-[…] leading-[…]` values.

| Role | Token | Font | Size (mobile → desktop) | Line height | Tracking | Notes |
|---|---|---|---|---|---|---|
| Display (hero) | `text-display` | Italiana | `clamp(44px, 8vw, 92px)` | 0.98 | −0.02em | One per page; `text-wrap: balance` |
| H2 (section) | `text-h2` | Italiana | `clamp(34px, 5.5vw, 58px)` | 1.05 | −0.015em | |
| Modal / panel title | `text-title sm:text-title-lg` | Italiana | `34px` → `40px` from `sm` | 1.05 | normal | Modal headings and the schedule detail panel (`ui.title`) |
| Quote | `text-quote` | Italiana | `clamp(26px, 4vw, 40px)` | 1.25 | normal | Italic is fine (browser-slanted) |
| H3 (card title) | `text-h3` | Italiana | `28px` | 1.1 | normal | Class names, pricing rows, admin section titles |
| H4 (small title) | `text-h4` | Italiana | `24px` | 1.1 | normal | Schedule card class names, the booking summary, FAQ questions |
| Body | Figtree 400 | `16px` | 1.6 | Max width 46ch |
| Small | Figtree 400 | `14px` | 1.5 | Card lines, helper text |
| Label / eyebrow | Figtree 600 | `12px`, uppercase, `letter-spacing: .14em` | 1.4 | |
| Button | Figtree 600 | `12px`, uppercase, `letter-spacing: .14em` | 1 | |

**Rules:**
- **Italiana has one weight (400). Never bold it**, because faux bold looks broken.
- Never use Italiana below 24px; it's too thin to read.
- **No text under 12px, and body copy is never under 14px.** (The old site had 94 places at 9–11px; all of them go.)
- Every heading gets `text-wrap: balance`.
- **Tracking is size-specific.** Only the two largest sizes are tightened (display −0.02em, H2 −0.015em); smaller Italiana keeps the face's own spacing, and labels and buttons keep +0.14em.
- Two Italiana uses sit outside the scale on purpose: the mobile menu links (34px, leading 1.25) and the admin stat tiles (34px, leading 1.1).
- One measure exception: FAQ answers are capped at 64ch, not the 46ch body measure, so each answer reads as one block under its full-width question row.

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
- **Active (pressed):** the press is sized to the element and happens the moment it's touched, not on release (100ms):
  - `press` (0.97): pills and icon buttons only: `ui.primary` / `ui.secondary`, the hero and header pills, the sticky bar's button, the week filter, `ICON_BUTTON`, the modal close button, the menu toggle, the copy / sheet icon buttons, and the WhatsApp button and its close button;
  - `press-soft` (0.99): wide rows and tiles, where 0.97 would move the edges by many pixels: pricing rows, FAQ question rows, the booking package tiles and format segments, the schedule session cards;
  - class cards: `card-lift` (0.98), but not while the track is being dragged.
  - Text links and quiet text buttons don't scale. Every element with a press lists `scale` in its transition (`transition duration-200 ease-spring active:duration-100`), so it eases instead of jumping in one frame.
- **Disabled:** `opacity-40`, `cursor-not-allowed`.

### Class card (carousel item)
- Base: `bg-glass backdrop-blur-[8px] rounded-[18px] overflow-hidden`.
- Photo on top, `min-height: 260px`.
- Text area `p-4 pb-5`:
  - Title: H3, Italiana 28px.
  - **One line:** `"<benefit> · <duration>"` (e.g. "Alignment and breath · 60 min"), 14px, `ink-soft`.
- Hover: `translateY(-4px)` over 500ms with `ease-spring`. The whole card is a button.
- **What a tap does:**
  - The 4 bookable classes (Hatha, Barre, Wheel, Chakra Flow) open the booking with the soonest session of that style preselected.
  - The 7 new classes (Vinyasa, Ashtanga, Spine Healing, Mobility Yoga, Yin Yoga, Prenatal & Postnatal, Aerial Yoga) aren't on the timetable, so they open the contact pop-up with that class preset as the interest. Aerial Yoga is private sessions only: its line is "Private sessions only · on request" (no duration) and its interest is "Private Aerial Yoga".
- A card whose source photo is small (Vinyasa today) ships only `<slug>-480.webp` (`smallImageOnly`), with no `srcset`.

### Carousel ("Choose your practice")
- A horizontal scroll with `scroll-snap-type: x mandatory`. Card width `min(78%, 300px)`, gap 16px.
- Prev and next icon buttons sit at the top right (hidden on touch-only screens is fine); keyboard focusable, scrollable with the arrow keys.
- **Motion:** touch keeps the native swipe and scroll-snap. The arrows and arrow keys glide on a critically damped spring to the exact next snap point (instant with reduced motion). With a mouse (`pointer: fine`, `cursor-grab`), the track can be dragged: 10px threshold, then 1:1; rubber-band past either end; on release the momentum is projected and it glides (slight bounce, with the release velocity) to the nearest snap. A real drag never opens a class; a plain click or tap still does. Any glide stops on a new press, grab, wheel or touch.
- The 11 classes, in this order: Hatha, Barre, Wheel, Chakra Flow, Vinyasa, Ashtanga, Spine Healing, Mobility Yoga, Yin Yoga, Prenatal & Postnatal, Aerial Yoga. The durations of the new classes are placeholders until Priyanshi confirms them.
- Photos: Vinyasa (crow), Ashtanga (Burj forearm stand) and Aerial (the original window photo, with a light grade: blues about 25% less saturated and slightly warmer, the silk keeps its blue) are real; the other 8 are AI placeholders until the photo shoot.

### Header / navigation
- Wordmark "YogaPriyanshi" (Italiana 24px) on the left. Links (Classes, Schedule, About, Contact) are labels (12px uppercase). The primary button "Book free class" sits on the right. Nothing else goes in the header.
- Transparent over the hero. After 80px of scroll it becomes the **bar material** (§6): `bg-bg/85` (the same opacity as before the redesign), `backdrop-blur-[20px] backdrop-saturate-[1.8]`, the `shadow-glass-edge` top light, and a 16px scroll-edge fade below it (`from-bg/85`) instead of a hairline or shadow. 85% keeps the nav labels above 4.5:1 over the busiest content, with margin to spare (the worst pixel measured 4.61:1 even at 80%).
- On mobile: wordmark plus a menu icon, opening a full-screen calm overlay with links in Italiana 34px. It settles in from the centre (opacity plus scale 0.98 → 1, critically damped spring) and leaves the same way.
- "Manage booking" and "Studio admin" live in the mobile overlay and the footer, not in the header.

### Sticky book bar (mobile only)
- Appears after the hero leaves view: a bottom bar in the bar material (`bg-bg/90`, 20px blur, `shadow-glass-edge`, a `from-bg/90` scroll-edge fade above it instead of a top border), safe-area padding, holding one primary button "Book a free class". It rises from the bottom edge and leaves the same way.
- Hides again while "Your first class is free" (`#first-class`) or Contact (`#contact`) is on screen, since both have their own dark button.

### Booking modal (and Cancel / Admin / Contact modals)
- All four, and the class finder, use one shell, `ModalSheet.tsx`: focus trap, Escape, focus returns to the opener, the page behind is `inert`, and Lenis is stopped while open. Admin may use a wider sheet (1040px).
- A centred sheet: `bg-surface rounded-[20px]`, max width 560px, inner padding 32px (20px on mobile). The backdrop is `bg-ink/60` with blur.
- On mobile it becomes a bottom sheet with full width and top corners rounded, and a decorative grabber (36×5 pill, `line-strong`, 6px from the top edge) at the top; when the sheet can be dragged its top padding grows to 28px, so the grabber isn't cramped against "Step 1 of 2". The grabber belongs to the sheet's scrolling content, so it scrolls away with a long form; the close button and Escape still close it. A 40px `surface` bleed sits under the sheet's bottom edge and moves with it, so an upward rubber-band never shows a gap onto the backdrop.
- **Drag to dismiss (phone only):** only the top 48px grab strip drags; content scrolling and form fields stay native. 10px threshold, then 1:1 with the finger (keeping the grab offset); upwards it rubber-bands. On release, the momentum is projected (deceleration 0.998); past half the sheet's height it springs away with the finger's velocity and closes, otherwise it springs back. It can be grabbed again mid-flight, and the backdrop lightens as it moves. Off (`dismissible={false}`) for Admin and while a form is sending.
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
- The Contact section is a heading, one address line and a primary button "Contact Priyanshi" (plus the secondary "Chat on WhatsApp" pill while WhatsApp is enabled). The button opens the contact form in a pop-up (the same sheet as the booking modal), not an inline form.
- The form: name, email, phone (optional, `type="tel"`), interest and message.
- **Membership mode** (`interest === MEMBERSHIP.interest`, "Monthly membership"). It follows the current select value: "Join the membership" presets it, and picking "Monthly membership" from the list also enters it. Switching to another interest leaves it, clears the format choice and makes the message required again. In the mode:
  - the title (same id, so it still names the dialog) is "Join the membership", with the intro "12 classes a month for AED 2,999. Send your details and Priyanshi will reply within a day.";
  - after the interest, "In person or online (optional)": a `role="group"` labelled by that text, with two `aria-pressed` segments, "In person in Dubai" and "Live online", in the booking modal's segment style (`bg-surface-alt` track, `press-soft`, `min-h-11`, pressed `bg-ink text-on-ink`). Tapping the pressed one clears it;
  - the message is "Preferred days and times (optional)" (placeholder "e.g. Weekday mornings, or Saturdays"), not required;
  - the submit says "Send Request" ("Sending Request..." while it sends).
- **Membership success** (shown only after the server's 200): the check, "Request Sent" (focused), "Thank you. Priyanshi will be in touch within 24 hours to set up your membership.", then, while `WHATSAPP_ENABLED`, a `ui.primary` link "Continue on WhatsApp" (glyph, new tab) whose prefill is `membershipPrefill(name)`: the name as typed (trimmed, spaces collapsed) and the plan, never the email or phone. Then a `ui.secondary` "Close". Side by side from 640px, stacked and full width on phones. Every other interest keeps the "Message Sent" view unchanged.

### FAQ ("Questions, answered")
- Between Pricing and "Your first class is free" (`#faq`). The same transparent hairline list as Pricing: each row is an `h3` holding a `<button>` (question in Italiana 24px, `text-h4`, and a 44px circle with a chevron that turns 180° when open), `press-soft`, `hover:bg-glass`.
- The answer opens below its question (16px body, `ink-soft`, max 64ch, the measure exception in §3). It isn't a `region` landmark: with up to 10 open they would crowd the landmarks; its id stays for `aria-controls`. Several can be open at once; none is open at first. The button has `aria-expanded`, and `aria-controls` while its answer is shown.
- Answers are facts only (`src/constants/faq.ts`) and never mention WhatsApp, Zoom or props. Students bring their own mat, which the "What should I bring or wear?" answer says.

### WhatsApp button
- Shown only while `WHATSAPP_ENABLED` (off in production until the real number is set).
- **Button:** a 56px circle in WhatsApp green (`--color-whatsapp` #25D366, brand colour used only here) with the white glyph (`--color-on-whatsapp`), a soft ink-tinted shadow, `press`. It is a direct link: one tap opens `wa.me/<number>` in a new tab with the first message typed in (no pop-up in between, as owner requested 2026-10-19). Bottom right: 24px in from the edges from 640px; on phones 20px from the right and 88px plus the safe area from the bottom, so it clears the sticky bar by 16px. `z-40`, below the header menu (`z-45`) and modals (`z-50`). Name: "Chat with Priyanshi on WhatsApp". With more contrast it gets a 2px ink outline. The green is a recognised brand mark, not a palette colour: don't reuse it elsewhere.
- **Hidden** while any modal sheet (the class finder included) or the mobile menu is open, while How it works or Contact is on screen (each has its own WhatsApp link, so two never show together), and while offline (the link can't work, and it keeps the offline pill clear).

- **Contact:** a secondary "Chat on WhatsApp" pill beside "Contact Priyanshi". **How it works:** a text link "Book a free 15-minute call" with the WhatsApp glyph (its own prefill, `CALL_PREFILL`, asking for a call). **Booking confirmation:** a quiet text link "Questions? Chat on WhatsApp" under "Return to Studio".

### Admin Members tab
- The signed-in dashboard has a `role="tablist"` ("Dashboard sections") under the top bar: "Overview" (the default, its content unchanged) and "Members", in the segment pill style (selected `bg-ink text-on-ink`). `aria-selected`, roving `tabIndex`, Left/Right/Home/End move and select, and the selected tab has `aria-controls`. Only the selected panel is mounted (`role="tabpanel"`, labelled by its tab, `tabIndex={0}`); the title, Refresh and Logout stay outside the panels, so the dialog is still named "Priyanshi's Studio Overview".
- Members: the `h3` "Membership requests" with "New, then Contacted, then Active with a start date.", then a filter group ("All", "New (n)", "Contacted (n)", "Active (n)", `aria-pressed`; a change goes back to page 1). Each request is a card like Recent Messages (`data-testid="member-request"`, `bg-surface-alt rounded-[16px] p-4 sm:p-5`): a top row with the name (an `h4`, `break-words`) and the status pill (`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]`; New `bg-surface text-ink`, Contacted `border border-line-strong text-ink-soft`, Active `bg-success text-on-ink` (a filled chip, about 5.3:1); a visually hidden "Status: " before the label), then the mailto and tel links. `gap-3` below them: "Format: …" (`text-ink`, "Not given" when empty), "Preferred times: …", "<plan> · AED 2,999 a month", "Requested <d MMM yyyy>" (Dubai) and, when Active, "Start date: <d MMM yyyy>".
- Under that, a small form: a "Status" select with only the current status and its allowed next steps, a "Start date" date input while Active is chosen or set (defaulting to the saved date or today in Dubai), and a `ui.secondary` "Save" ("Saving..."), disabled until something changes. It updates only from the server's reply (never optimistically) and then refetches the list and counts (only the newest list request may update the screen). After the refetch, focus moves to the saved card's name (`tabIndex={-1}`), or to the "Membership requests" heading if the card has left the filtered list, and a polite `role="status"` reads "Saved: <name> is now <Status>.". A 400 or 409 shows in that card (`ui.error`, `role="alert"`); a 401 signs out. The top-bar Refresh also refetches Members while that tab is shown.
- "Page X of Y" (`aria-live="polite"`) with Previous and Next (disabled at the ends), "Loading requests..." (`role="status"`), "No membership requests yet." and "No requests with this status.". On phones the filter is a 2×2 grid, and the select and Save are full width. No tables and no email inputs here (the Overview tests count those).

### Class finder ("Find your class")
- A `ModalSheet` (`closeLabel` "Close class finder"): three questions, one per step, then a result. Eyebrow "Question 1 of 3" … "Your suggestion" above the `ui.title` "Find your class" (the same on every step; on the result it is visually hidden, `sr-only`, so the eyebrow leads straight into the class name and the dialog keeps its name). The dialog is `aria-describedby` the eyebrow and the first question (ModalSheet's optional `describedBy`), so Q1 is read out on open. Answers and the result reset when the sheet closes, so a reopen never flashes the last result.
- Each question is an `h3` (`text-h4`) over a `role="group"` of full-width answer buttons: `press-soft`, `min-h-12`, `rounded-[12px]`, `bg-surface-alt` (hover `border-line-strong`); the earlier choice is `aria-pressed` and `bg-ink text-on-ink`. A tap moves on at once (no timer), and focus moves to the new heading (`tabIndex={-1}`, described by the eyebrow; no ring on a heading, a quiet `line-strong` underline with `focus-visible` instead). Under Q2 and Q3 a quiet "Back" text button. The inline text buttons ("Back", "Start again", the "Also a good fit" class) keep a 44px hit area with `-my-3`, so they add no layout height.
- The result: the class name (`text-h3`, focused on arrival), a one-line reason, the class length only ("60 min", none for Aerial), the format note (private: "Just you and Priyanshi. She arranges the details with you."), then "Your first class is free." (bookable class in a group format only) or "Not on the timetable. Send a message and Priyanshi will find a time with you." (contact-only). Pregnancy and back care add a gentle `ui.notice`. "Also a good fit:" and a text button swap the main and alternative classes (no alternative for pregnancy). Actions: one `ui.primary` whose label says exactly what it does ("Book this class" only for the 4 bookable classes in a group format), the `ui.secondary` "Ask Priyanshi on WhatsApp" while WhatsApp is enabled, and a quiet "Start again". The two buttons always stack (`flex flex-col gap-3`), each `w-full`, at every width.
- Copy and the mapping live in `src/constants/class-finder.ts`. Never medical, clearance or "safe" wording; "free" never shows on a private or contact-only result.

### Schedule
- A segmented week switcher (This Week / Next Week / Week 3) and a refresh icon button. One glass card per day (a `<button>`, `rounded-[18px]`); the selected card is `bg-ink text-on-ink`. Friday is a dashed "Rest Day" card.
- Full and past cards fade the surface only (no glass, `border-dashed border-line`); their text keeps the normal tokens, never `opacity`.
- A glass detail panel for the selected session: one meta line ("60 min · Beginner · In person or online") and the primary "Book This Class (N Left)" button. Then one "good to know" line ("Bring your own mat. Online? Priyanshi sends you the class link.") and the secondary "Cancel / Manage Reservation" button.

### Pricing
- A hairline list (`border-line`), transparent so the mandala shows through: 4 rows, each a `<button>` that opens booking with that plan (name in Italiana 28px, one short line, the price, an arrow icon). One line below: "Pay in person at your session, or online with the details Priyanshi sends after you book. Free cancellation up to 6 hours before class."
- **The membership card** sits beside the list from `lg` (`grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start`) and below it on smaller screens; the payment line stays under both. The card (`data-testid="membership-card"`): `bg-glass backdrop-blur-[8px] rounded-[18px] border border-line-strong p-5 sm:p-6`, `gap-5`. Inside: the `h3` "Monthly membership" (`text-h3`), "AED 2,999" (`text-base font-semibold tabular-nums text-ink`) then " a month" (`text-sm text-ink-soft`), a list of the three perks with a lucide `Check` (`size-4`, `accent-text`: the section's one accent) in 16px `ink-soft`, and the `ui.primary` "Join the membership" with the arrow (full width on phones). The button comes after the list, outside every `li`, so `#pricing li button` still starts with the first plan row. No tags, no "Most popular" and no per-class price. The copy lives only in `src/constants/membership.ts`.

### Footer
- Transparent with a hairline top border: wordmark, address, Instagram, the quiet buttons "Manage booking" and "Studio admin", and the copyright line (14px). The policy lives in Pricing, not here. No dark bands anywhere on the page.

### Teacher block ("Hi, I'm Priyanshi.")
- Two columns on desktop (photo | text), stacked on mobile. The photo is the real Burj Khalifa forearm stand (`real/burj-forearm-stand-1`, 480/800/1200), 4:5, `rounded-[18px]`.
- The heading is H2, then the one-line aim, then a first-person credentials paragraph (about 35 words, 40 at most, facts from the private fact sheet only). It doesn't repeat the trust numbers, and the former studio is described, never named. On phones the photo's `sizes` is capped at `min(100vw, 400px)`.
- Trust numbers: a 2×2 `<dl>` under a hairline. Each cell shows the value (Italiana 28px, `text-h3`) above its label (14px, `ink-soft`); in the DOM the `dt` label comes first and `flex-col-reverse` puts the value on top. "7 years / Teaching since 2019", "300 hours / Yoga Alliance registered training", "Bachelor's / In Yogic Science", "Up to 500 / People led on International Yoga Day".

### Testimonials ("What students say")
- Three verified reviews (`src/constants/testimonials.ts`), quoted exactly, as glass cards (`bg-glass`, `rounded-[18px]`, `p-5`): the quote in 16px `ink`, then the caption "Verified ClassPass review · <class> class" in quiet sentence case (`text-sm leading-[1.5] text-ink-soft`), not the uppercase label style, so "ClassPass" reads as spelled.
- Phones: a native scroll-snap track (cards `min(85%, 340px)`), no arrows and no auto-advance. From `lg`: three columns. No links and no venue names.
- The track is a `<ul role="list">` with an `aria-label`. It is a keyboard tab stop (`tabIndex={0}`) only while it overflows (`useOverflowsX`, a ResizeObserver), so desktop has no empty tab stop. The Instagram track works the same way.

### Quote
- Centred, Italiana. Priyanshi's chosen line, "Yogas citta vritti nirodhah." (`text-quote`, max 24ch), its meaning below in 16px `ink-soft`, and a label-style caption "Patanjali · Yoga Sutras 1.2" (`ui.eyebrow`). No quotation-mark graphics.

### How it works
- Three numbered steps in an `<ol>` (one column on phones, three from 640px), each under a hairline: the number in Italiana `text-h3` `accent-text` (the section's one accent), the step title in `text-h4`, one line of body. Steps: "Book your free first class", "Hear from Priyanshi", "Practise".
- "Practise safely": a compact note, not a card: an `h3` (`text-h4`) and three 14px bullets. It never suggests that Priyanshi gives medical clearance.
- While `WHATSAPP_ENABLED`: one line "Not sure where to start?" and the text link "Book a free 15-minute call" (WhatsApp glyph, underline, no press scale). Its accessible name never matches the floating button's.

### Instagram ("See Priyanshi in action")
- After the FAQ, before "Your first class is free". Five real Burj Khalifa photos (`real/<slug>-480.webp`, lazy, with width and height so nothing shifts), 4:5, `rounded-[18px]`. Phones and small tablets: a native snap track (tiles `min(44%, 200px)`); from `md` (768px): five columns.
- One secondary pill "Follow @yogapriyanshi" (Instagram icon) to the profile. No WhatsApp link, no embed and no third-party script.

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
1. Hero: "Connect with your body." / "Yoga with Priyanshi. Your first class is on us." / [Book a free class], with the line "Not sure? Take the 30-second quiz" under it (an underlined text link, 16px like the subtitle, no pill or press, `wf-after` after the button; owner request 2026-10-25).
2. Choose your practice: the carousel of 11 classes, with the same "Not sure? Take the 30-second quiz" line on its own row between the heading row and the track (never in the arrow row).
3. Hi, I'm Priyanshi.: photo, the one-line aim, a short credentials paragraph and four trust numbers.
4. What students say: three verified reviews.
5. Quote: "Yogas citta vritti nirodhah." (Patanjali, Yoga Sutras 1.2).
6. How it works: three steps, the "Practise safely" note and the free 15-minute call link.
7. Schedule: this week's classes with spots left (existing live schedule, restyled).
8. Pricing: free first class, single, 10-pack, 20-pack (compact; pay in person, or online with Priyanshi's details), and the monthly membership card beside them ("Join the membership").
9. Questions, answered: the FAQ, 10 questions that open in place.
10. See Priyanshi in action: five Instagram photos and a Follow link.
11. Your first class is free: "Classes every day except Friday · in person or online" / [Pick a time]
12. Contact: the address plus a "Contact Priyanshi" button that opens the form in a pop-up. Footer.

About, How it works and the FAQ carry more than one line of text on purpose (approved with Batch 1, 2026-10-19): they answer the questions a first-time student asks before booking.

---

## 6. Depth & elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | none | Sections, text |
| Glass | `bg-glass` + `backdrop-blur-[8px]` | Carousel cards, schedule cards and panel, over the mandala |
| Bar material | `material-bar`: `bg-bg/85` (header) or `bg-bg/90` (sticky bar) + `backdrop-blur-[20px] backdrop-saturate-[1.8]` + `shadow-glass-edge` | The scrolled header and the sticky book bar |
| Raised | `shadow-raised` (ink at 8%, `0 8px 30px`) | Modals, the offline pill (the WhatsApp button uses its own soft shadow) |

- **`shadow-glass-edge`** is a 1px inset top line of `surface` at 55%: light catching the edge of the glass. It isn't a depth shadow.
- **Scroll edges, not hairlines:** where content slides under a bar, a 16px `scroll-edge` gradient of the bar's colour softens it, instead of a border or a drop shadow.
- **No glass on glass:** glass and bars sit over the page, never over each other; modal surfaces are solid `surface`.
- **Accessibility overrides** live in one unlayered block at the end of `index.css` (no `!important`):
  - `prefers-reduced-transparency: reduce`: glass becomes solid `surface`, bars become solid `bg` with a `line` edge, the scrim drops its blur, scroll edges hide.
  - `prefers-contrast: more`: the same solid fills, with a 1px `ink` edge on bars and glass.

**No other shadows.** Borders are hairlines (`border-line`) and used rarely.

---

## 7. Animation & interaction

**Motion philosophy:** slow, soft and few. One signature (the mandala), gentle reveals, small lifts on hover.
**Physics:** anything a finger can move uses springs (motion `type: 'spring'` with `bounce` + `duration`), which start from the current value, carry velocity and can be interrupted. Critically damped (`bounce: 0`) is the default; a slight bounce (`0.15`) only follows a gesture that carried momentum (a sheet snap-back, a thrown carousel). CSS-owned transitions (hover, the header material) use `--ease-spring`, a critically damped spring as a `linear()` easing.
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
- Each section goes from `opacity .15 → 1` over 900ms (eased `cubic-bezier(.2,.7,.2,1)`) and `translateY(18px → 0)` on a critically damped spring (`visualDuration .8`), when 15% of it is visible.
- **Never start fully hidden.** The page must read correctly before any JavaScript or animation runs.

### Hero word fade (approved 2026-10-12)
- The hero headline appears word by word: each word rises 8px out of an 8px blur over 1.1s, staggered 180ms. The line and button follow (the hero has no eyebrow, removed 2026-10-17). It takes about 2s in total, plays once on load, and is pure CSS (`.word-fade` in `index.css`).
- This is the one exception to "never start fully hidden": it runs without JavaScript and ends within about 2s. With reduced motion everything shows at once.

### Hover, press & focus
- Cards lift 4px over 500ms (`ease-spring`).
- Press: pills and icon buttons scale to 0.97, wide rows and tiles to 0.99, class cards to 0.98, over 100ms on `ease-spring` (§4).
- Buttons take 200ms colour transitions.
- Icon buttons change border, and their Animate UI icon animates once.
- Focus rings are always visible (§4).

### Modals
- From 640px they fade in with a 12px rise and scale 0.98 → 1 on a critically damped spring (`bounce 0`, `duration .35`), and leave the same way.
- On mobile, the bottom sheet slides up on a critically damped spring (`bounce 0`, `duration .35`) and leaves downwards along the same path: an open or close from a button carries no momentum, so it never overshoots (an overshoot lifts the sheet off the bottom edge). Drag to dismiss (§4) uses `bounce 0, duration .3` with the release velocity to leave; only the snap-back after a released drag uses `bounce .15, duration .3`.
- The backdrop fades over 300ms and follows the sheet while it's dragged.
- Header menu: opacity plus scale 0.98 → 1, `bounce 0`, `duration .35`. Sticky bar and offline pill: `bounce 0`, `duration .35`, entering and leaving along the same path.
- WhatsApp button: appears and leaves with opacity and scale 0.9 → 1 on a critically damped spring (`bounce 0`, `duration .3`); with reduced motion it only fades (200ms).
- FAQ answers: height 0 → `auto` with opacity, `bounce 0`, `duration .35`, closing along the same path; the chevron turns over 300ms on `ease-spring`.

### Reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  /* Lenis switches off its smoothing automatically; MotionConfig reducedMotion="user" disables transforms */
  .reveal { opacity: 1 !important; transform: none !important; } /* the one allowed !important: accessibility override */
  .card-lift:hover { transform: none; }
}
```
With reduced motion on, the mandala is drawn once, fully bloomed and still. The phone sheet cross-fades in and out instead of sliding; it can still be dragged, but its snap-back is instant and a dismiss closes at once. Carousel glides jump straight to the snap point. The WhatsApp pop-up and button only cross-fade (200ms), class finder steps change at once (they otherwise cross-fade, opacity only, `bounce 0`, `duration .3`), FAQ answers open and close at once (`duration: 0`) and the chevron turns without a transition. The press scale (0.97 / 0.99 / 0.98) stays: it's a tiny change in size with no movement across the screen, so it isn't a vestibular trigger, and it confirms the touch.

### Ambient loops (audit 2026-10-17)
The mandala (scroll-linked, not looping), the Buddha loader (4s breathe, 10s ring; only while loading) and the hero word fade (plays once, about 2s) all stop under reduced motion. None is a full-viewport moving background or a slow loop on the page, so all three are compliant.

---

## 8. Do's and don'ts

**Do:**
- Use tokens for every colour, size and spacing value.
- Keep one heading, one line and one action per section.
- Use Priyanshi's real photos and videos, compressed (WebP or AVIF; videos under 20 MB, muted, `playsinline`).
- Keep all booking, cancel, contact and admin behaviour and test ids. All e2e tests (112 today) must stay green.
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
