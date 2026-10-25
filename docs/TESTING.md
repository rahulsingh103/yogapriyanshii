# Testing

## How to run

Run these from inside `website/`. Node 22 is required.

```
PATH="$HOME/.local/node22/bin:$PATH" npm run lint       # TypeScript check
PATH="$HOME/.local/node22/bin:$PATH" npm run test:e2e   # Playwright: starts server.ts on port 3100
PATH="$HOME/.local/node22/bin:$PATH" npm audit --omit=dev
```

- Screenshots go to `test-results/`, and the HTML report to `playwright-report/`. Review screenshots kept between runs go to `.data/shots/` (git-ignored), never `test-results/`.
- Run only one Playwright process at a time: runs share port 3100 and `test-results/`.
- The test server runs with `APP_ENV=test`. It uses its own database file, `.data/e2e.db`, which is deleted when the server starts, and it **never** loads `.env`. A remote database URL is refused.
- Emails are captured in an in-memory outbox instead of being sent. Test-only routes (`GET /api/test/outbox`, `POST /api/test/outbox/clear`, `POST /api/test/email-fail`, `POST /api/test/session-soon`) exist only in test mode, never on Vercel.
- The admin password for tests is `TEST_ADMIN_PASSWORD` in `e2e/test-admin.ts`. `playwright.config.ts` hashes it into `ADMIN_PASSWORD_HASH` for the test server.
- WhatsApp uses Priyanshi's real number everywhere (`src/constants/contact.ts`). The tests never open wa.me; they only check the link format (`wa.me/<digits>?text=`). If the number is ever cleared, production builds hide WhatsApp and dev/tests fall back to the placeholder `971500000000`, which must never appear in `dist/`.
- Tests run one at a time (`workers: 1`) against one server, in file order. `05` locks the admin portal at its end, so later specs don't sign in.

## What's covered: 101 Playwright tests (`e2e/`)

| File | Covers |
|---|---|
| `01-landing` (6) | Every section renders (including testimonials, How it works, the FAQ and Instagram), images load (the far carousel cards are lazy, so the track is scrolled to its end first), the shared-link preview card (Open Graph image, title, description), header nav, a bookable carousel card preselects its style, the pricing rows open booking with the right plan, schedule tabs and "Book This Class" |
| `02-booking` (6) | Free-class happy path and validation (token format `YP-` + 16 characters, read by `data-testid="booking-token"`); one free class per email; paid single and packs reserved to pay at the studio; back button keeps choices; API rules for capacity, double-booking (no token in the error), validation, and server-set prices and payment status |
| `03-manage-booking` (2) | Opened from the footer's "Manage booking": look up and cancel with 6h+ notice refunds the credit; unknown token shows an error |
| `04-contact` (6) | "Contact Priyanshi" opens the pop-up (`getByRole('dialog')`); an empty submit marks the required fields (`aria-invalid`, described by their message) and focuses the first; the message reaches the admin inbox and alerts the studio (reply-to the student) with no phone line when none is given; a bad phone is refused with a clear message, a given phone reaches the alert and shows in admin as a `tel:` link; focus moves to "Message Sent"; phone and interest API validation (incl. the 7 new interests, Private Aerial Yoga among them); the honeypot silently discards; missing and bad fields are rejected |
| `05-admin` (5) | Opened from the footer's "Studio admin": login, metrics, settings, logout; real stats (zero revenue, 6 zero-filled months); settings validation; booking alerts go to the saved notify address; logout ends the session; the API rejects requests without a token; lockout after 5 failures |
| `06-mobile` (4) | No horizontal scroll, at the top and after scrolling the whole page, and the menu works; mobile free booking end to end; the sticky Book bar (and it steps aside while Contact is on screen); the booking reference fits at 375px |
| `07-backend-rules` (10) | 56 schedule days with 8 Friday rest days; the last-seat race; captured confirmation and alert emails; an email failure doesn't block booking, cancel or contact; removed routes give 404; 413 for big bodies; guessed and malformed tokens get the same 404; token normalisation; an early free-class cancel gives it back but the same session can't be rebooked (UI offers other sessions); a late free-class cancel keeps it used |
| `08-redesign` (13) | The carousel's 11 classes in order, arrows and keyboard track; Hatha preselects the soonest Hatha session; Yin Yoga opens the contact pop-up with Yin preset; Aerial Yoga shows "Private sessions only · on request" and opens the contact pop-up with Private Aerial Yoga; a nav link lands the section just below the header (no font wait: fonts are preloaded with metric-matched fallbacks); reduced motion draws the static mandala; the mobile menu (Escape, links, focus trap, inert page, closes at 900px+); Escape closes the booking sheet and returns focus; the 375px bottom sheet has no overflow |
| `09-apple-design` (14) | Pills and cards scale on press, and a wide pricing row presses only to 0.99 with `scale` in its transition; the phone sheet opens without its bottom edge ever rising above the viewport's; the phone sheet (real CDP touch) follows the grabber 1:1, lightens the backdrop, dismisses on a flick, springs back after a slow short drag and rubber-bands upwards; touching the content scrolls it natively and fields still work; a tap and a plain click on a card still open booking with that class; a desktop mouse drag lands on a snap point without opening a class, the arrows glide to a snap, and pulling past the start rubber-bands back; reduced motion keeps the drag with instant snap-back and dismiss; reduced transparency (CDP) and more contrast turn the bars and glass solid; a mouse press released off the track leaves no drag behind; a cancelled touch on the grabber springs back without dismissing; with 11 cards the arrows glide snap by snap to the last card (Aerial Yoga), fully inside the track |
| `10-whatsapp-faq` (9) | The FAQ: 10 questions, none open at first, several open at once, Enter toggles, `aria-expanded` / `aria-controls` (the answers aren't region landmarks), the 0.99 press; the FAQPage JSON-LD is in the served HTML, matches the visible questions and never mentions WhatsApp, Zoom, props, a promise that mats are provided, priority booking, recordings or sharing (it does say "bring your own mat"); the WhatsApp pop-up (focus moves in, Escape and the X return focus to the button, a press outside or focus leaving closes it, the wa.me link and prefill); the button hides with the booking, cancel, admin and contact modals, with the mobile menu, and offline (the offline pill shows on its own); the Contact link; the booking confirmation link names the class and time but never the token or email; reduced motion (no transform on the pop-up, answers open at full height at once); at 375px the button sits above the sticky bar, which still takes a tap, the pop-up fits on screen, and the button hides while How it works or Contact is on screen |
| `12-class-finder` (17) | The hero link sits under "Book a free class" (still the first button), quieter, with no pill or press, and opens the finder at "Question 1 of 3", described by the progress line and Q1; Escape returns focus. The carousel line sits above the track, out of the arrow row; the X returns focus. All 54 mappings (6 tests, one per goal, 9 paths each, "Start again" between): main class, alternative or none, primary label, Aerial only for private, no Wheel for back care. Pregnancy: all 9 paths give Prenatal & Postnatal, no alternative, the notice, no medical wording. WhatsApp: the exact prefill on two paths (private Aerial, online Yin), the swap updates it, no `@` or `YP-`, a name distinct from the floating button, which hides while the finder is open; the private and contact-only copy, the duration-only meta line (none for Aerial), the hidden title on the result, and a reopen that starts fresh at Q1. Book and contact routes (soonest Hatha, Chakra Flow with Online Live Stream, and the Yin, Private session, Private Aerial Yoga and Prenatal interests). Keyboard: Tab and Enter, focus on each new heading, Back keeps the answer pressed, the trap, Start again, Escape. Hand-off: one dialog, inert page, focus back to the entry link. Phone (375px, touch): flush bottom sheet with the grabber, no overflow on any step, 44px answers, a flick dismisses; reduced motion: no slide, steps change at once. Facts guard: no Zoom or former studio, "free" only on a bookable group result. Screenshots at 1280 and 375 to `.data/shots/batch2/`, each taken once the sheet's computed opacity is 1 and it is at rest (polled, no fixed waits) |
| `11-content` (9) | Section order (with the quote between Testimonials and How it works); About: the credentials paragraph (40 words at most, no repeat of the trust numbers) and the 4 trust numbers, real photo loaded; the 3 reviews quoted exactly with their captions and no links; a facts guard (no private email, Zoom, DSVV, "Mats and props" or "every pose has options" in the page, no review-site links, a clean served HTML); How it works: 3 steps, "in person in Dubai", the 3 safety bullets with no medical-clearance wording, the call link's wa.me prefill and a name distinct from the floating button; Instagram: 5 lazy photos with width/height and alt text, only the Follow link, CLS under 0.1; nothing auto-advances; the schedule, pricing and FAQ copy; no overflow at 375px |

## Gaps to close

- The Vercel entry (`api/index.ts`) shares `backend/` with the tests, but the first real check of the deployed bundle is a preview's `/api/health` and the production smoke test.
- No test for past-session booking or expired packs (PRD §10). Packs aren't redeemable yet.
- No tests yet for rate limits or cookie-based admin sessions.
- No visual or accessibility checks. Add Lighthouse via BrowserTools MCP, plus axe checks.
- Never point tests at the live database. `backend/config.ts` refuses it in test mode.

## Definition of "tested"

A change is done when:
- lint passes;
- all e2e tests pass;
- any new behaviour has a test;
- for UI changes, the 375px and 1280px screenshots have been looked at.
