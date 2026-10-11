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
- Tests run one at a time (`workers: 1`) against one server, in file order. `05` locks the admin portal at its end, so later specs don't sign in.

## What's covered: 48 Playwright tests (`e2e/`)

| File | Covers |
|---|---|
| `01-landing` (5) | Every section renders, images load, header nav, a bookable carousel card preselects its style, the pricing rows open booking with the right plan, schedule tabs and "Book This Class" |
| `02-booking` (6) | Free-class happy path and validation (token format `YP-` + 16 characters, read by `data-testid="booking-token"`); one free class per email; paid single and packs reserved to pay at the studio; back button keeps choices; API rules for capacity, double-booking (no token in the error), validation, and server-set prices and payment status |
| `03-manage-booking` (2) | Opened from the footer's "Manage booking": look up and cancel with 6h+ notice refunds the credit; unknown token shows an error |
| `04-contact` (6) | "Contact Priyanshi" opens the pop-up (`getByRole('dialog')`); the message reaches the admin inbox and alerts the studio (reply-to the student) with no phone line when none is given; a bad phone is refused with a clear message, a given phone reaches the alert and shows in admin as a `tel:` link; phone and interest API validation (incl. the 4 new classes); the honeypot silently discards; missing and bad fields are rejected |
| `05-admin` (5) | Opened from the footer's "Studio admin": login, metrics, settings, logout; real stats (zero revenue, 6 zero-filled months); settings validation; booking alerts go to the saved notify address; logout ends the session; the API rejects requests without a token; lockout after 5 failures |
| `06-mobile` (4) | No horizontal scroll and the menu works; mobile free booking end to end; the sticky Book bar; the booking reference fits at 375px |
| `07-backend-rules` (10) | 56 schedule days with 8 Friday rest days; the last-seat race; captured confirmation and alert emails; an email failure doesn't block booking, cancel or contact; removed routes give 404; 413 for big bodies; guessed and malformed tokens get the same 404; token normalisation; an early free-class cancel gives it back but the same session can't be rebooked (UI offers other sessions); a late free-class cancel keeps it used |
| `08-redesign` (10) | The carousel's 8 classes, arrows and keyboard track; Hatha preselects the soonest Hatha session; Yin Yoga opens the contact pop-up with Yin preset; a nav link lands the section just below the header (no font wait: fonts are preloaded with metric-matched fallbacks); reduced motion draws the static mandala; the mobile menu (Escape, links, focus trap, inert page, closes at 900px+); Escape closes the booking sheet and returns focus; the 375px bottom sheet has no overflow |

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
