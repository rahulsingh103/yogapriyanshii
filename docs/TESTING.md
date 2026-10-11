# Testing

## How to run

Run these from inside `website/`. Node 22 is required.

```
PATH="$HOME/.local/node22/bin:$PATH" npm run lint       # TypeScript check
PATH="$HOME/.local/node22/bin:$PATH" npm run test:e2e   # Playwright: starts server.ts on port 3100
PATH="$HOME/.local/node22/bin:$PATH" npm audit --omit=dev
```

- Screenshots go to `test-results/`, and the HTML report to `playwright-report/`.
- The test server runs with `APP_ENV=test`. It uses its own database file, `.data/e2e.db`, which is deleted when the server starts, and it **never** loads `.env`. A remote database URL is refused.
- Emails are captured in an in-memory outbox instead of being sent. Test-only routes (`GET /api/test/outbox`, `POST /api/test/outbox/clear`, `POST /api/test/email-fail`, `POST /api/test/session-soon`) exist only in test mode, never on Vercel.
- The admin password for tests is `TEST_ADMIN_PASSWORD` in `e2e/test-admin.ts`. `playwright.config.ts` hashes it into `ADMIN_PASSWORD_HASH` for the test server.
- Tests run one at a time (`workers: 1`) against one server, in file order. `05` locks the admin portal at its end, so later specs don't sign in.

## What's covered: 33 Playwright tests (`e2e/`)

| File | Covers |
|---|---|
| `01-landing` | Every section renders, images load, header nav, sticky Book bar, "Book This Style", pricing opens booking with the right plan, schedule tabs and "Book This Class" |
| `02-booking` | Free-class happy path and validation (token format `YP-` + 16 characters); one free class per email; paid single (pay at studio); 10-pack by card and bank transfer show "Payment pending"; back button keeps choices; API rules for capacity, double-booking (no token in the error), validation, and server-set prices and payment status |
| `03-manage-booking` | Look up and cancel with 6h+ notice refunds the credit; unknown token shows an error |
| `04-contact` | The message reaches the admin inbox and alerts the studio (reply-to the student); the honeypot silently discards; missing and bad fields are rejected |
| `05-admin` | Login, metrics, settings, logout; real stats (zero revenue, 6 zero-filled months); settings validation; booking alerts go to the saved notify address; logout ends the session; the API rejects requests without a token; lockout after 5 failures |
| `06-mobile` | No horizontal scroll and the menu works; mobile free booking end to end |
| `07-backend-rules` | 56 schedule days with 8 Friday rest days; the last-seat race; captured confirmation and alert emails; an email failure doesn't block booking, cancel or contact; removed routes give 404; 413 for big bodies; guessed and malformed tokens get the same 404; token normalisation; an early free-class cancel gives it back but the same session can't be rebooked (UI offers other sessions); a late free-class cancel keeps it used |

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
