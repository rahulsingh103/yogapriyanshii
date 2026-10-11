# Design System

**Status:** v0, documenting the site **as built** (2026-10-10). In design-phase step 2 (`design/DESIGN-PHASE.md`), the `web-design` skill rewrites this file into the full spec, and you approve it before any UI code changes. After that, this file is the design law for every agent.

## 01 Direction

Calm, grounded, warm, editorial, a boutique wellness brand. Lots of whitespace, slow motion, nothing loud. (From PRD §4.)

## 02 Colour

Defined in `src/index.css` `@theme`:

| Token | Hex | Role | Uses in code |
|---|---|---|---|
| `ink` | `#0f0e0b` | Text, dark sections | 455 |
| `cream` | `#faf8f3` | Page background | 177 |
| `sand` | `#c4b48a` | Accent, primary buttons | 118 |
| `parchment` | `#f2ede4` | Alternate section background | 38 |
| `sand-hover` | `#b3a277` | Button hover | 11 |

**Problem:**
- Components hard-code these hex values instead of using the tokens. That's **820 occurrences**, plus 14 one-off colours (`#262420`, `#171512`, …).
- Four alternative themes override the colours with `!important`.

**Target:** tokens only, one theme.

## 03 Typography

- **Headings:** Playfair Display (serif, often italic).
- **Body and UI:** DM Sans. Both load from Google Fonts in `index.html`.
- **Labels:** small uppercase, letter-spaced eyebrow labels.

**Problem:** there's no type scale. Sizes 9–11px are used in 94 places, which is too small. **Target:** a defined scale, with a 14px minimum for body copy and 12px for labels.

## 04 Spacing

Tailwind's 4px scale. The most used steps are 1, 2, 3, 4, 6 and 8 (4–32px). **Target:** a documented section rhythm (e.g. 96px desktop / 64px mobile between sections).

## 05 Radius

Mostly `rounded-xs` (sharp, editorial) and `rounded-full` for pills and avatars. Keep this square-ish look unless the redesign changes it on purpose.

## 06 Components

**Buttons:**
- Primary: rectangular, sand fill, small uppercase letter-spaced text.
- Secondary: outlined.

**Cards:** class cards, pricing cards, schedule day cards.

**Modals:**
- Booking, a 3-step stepper.
- Cancel.
- Admin.

**Other:** the sticky Book bar on mobile, and the header with a mobile menu.

## 07 States

Every data view needs a loading, an empty and a friendly error state; never a blank screen or a raw error (PRD §9). The schedule has all three today.

## 08 Responsive

Mobile-first, since most traffic is phones. The breakpoints to check are 375 / 768 / 1280px. The schedule grid becomes stacked day cards on mobile. No horizontal scroll (tested in `e2e/06-mobile.spec.ts`).

## 09 Accessibility

- Text contrast of at least 4.5:1.
- Labelled inputs and alt text on images.
- Visible focus and keyboard-usable modals.
- Respect `prefers-reduced-motion`.

## Motion

Slow and soft: 300–700ms, ease-out, one hero moment. The toolkit and rules are in `design/DESIGN-PHASE.md` §1: Lenis, Animate UI, and Aceternity/Magic UI.
