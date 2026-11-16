# Security

These are the security policies for this codebase. This repo is **public**, so known open issues are tracked privately, outside the repo, and are never written here.

## Rules every change must follow

1. **Auth on every non-public route.** Public routes (classes, schedule, booking, contact) are rate-limited. Booking tokens are long and random.
2. **All decisions are made on the server.** Login, permissions, price, payment status, capacity and the trial-class rule are never trusted from the browser.
3. **Parameterized SQL only.** Any SQL built by joining strings is a blocking review failure.
4. **Paginate every list.** No endpoint returns an unbounded list.
5. **No secrets in the repo.** Keys come from environment variables only:
   - Vercel Environment Variables for the live site.
   - A git-ignored env file locally.
   - `.env*` is in `.gitignore`; only `.env.example`, with placeholders, is committed.
6. **No raw errors to users.** The client never calls `console.error(err)` with raw errors. API responses carry human messages only. Server logs contain no personal data or secrets.
7. **Passwords:** hash with bcrypt/scrypt/argon2, never plain SHA-256. No default credentials anywhere in the code or the UI.
8. **Tokens:** the admin session is kept in an httpOnly, Secure, SameSite cookie, not `localStorage`. Use CSRF protection if cookies are used.
9. **Payments:** use only a hosted checkout (Stripe Checkout). The site never sees card numbers. Webhooks are signature-verified and idempotent.
10. **Input:** validate type, length and format on the server. Keep the body size limit small (about 100 KB). There are no file uploads unless they're validated (type, size) and stored outside the app.
11. **Headers:** Content-Security-Policy, X-Frame-Options/frame-ancestors, Referrer-Policy and HSTS, via `vercel.json`.
12. **Dependencies:** run `npm audit` before every release. No source maps on live.
13. **SSRF:** the server never fetches a user-supplied URL.
14. **Quiz details:** the class finder's optional age, height and health answers exist only in the open sheet's component state and in the wa.me link the student opens. They never reach a request to our server, storage, logs, analytics, history state or a URL on our domain, and never feed the suggestion or any other logic. The free text is never parsed. Copy tells the student before typing and at the result that opening the message shares the text with WhatsApp and that the browser may keep the link. The preview is `translate="no"`, so page translation doesn't send it to a cloud service. The link keeps `rel="noopener noreferrer"`. `e2e/12-class-finder.spec.ts` has a canary test for this; keep it passing.
15. **Unpublished content:** article drafts live outside the repo (`content-drafts/`, in the workspace) and are never committed, built, quoted in tests, docs or screenshots, or put in commit messages; only the local drafts lint (spec 14) reads them, and its assertions print no text. The build never reads the drafts folder (it reads only `src/content/articles/`, and fails on any file there that isn't `status: published` with a date and `reviewedBy`, or that still has an unverified source, "(link to verify)" or "URL to confirm"), and spec 14 proves it with a canary draft: the canary, `__drafts`, `content-drafts`, `yp-drafts` and the draft banner must appear nowhere in the build output. Previews exist only on the dev server started with `SHOW_DRAFTS=1`: `GET /__drafts/:slug` accepts only `^[a-z0-9-]{1,60}$`, answers loopback requests only, resolves the file inside `DRAFTS_DIR` (default `../content-drafts/articles`) with a prefix check and `realpath`, refuses symlinks, and sends `X-Robots-Tag: noindex` and `Cache-Control: no-store`; the client renders `/drafts/<slug>` only in dev and only when the server added `<meta name="yp-drafts" content="on">`. Test fixtures are synthetic lorem text (`e2e/fixtures/article.md`, served only with `APP_ENV=test`). Article links are https only, and article text is rendered as text, never as HTML. Unknown paths (including `/guides` while nothing is published, `/drafts/*` and `/__drafts/*`) answer 404.
16. **Student accounts:** the session is a random 256-bit token in a cookie (`HttpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` in production, 30 days), stored only as a SHA-256 hash and deleted on log-out. Writes need a JSON content type (else 415) and an `Origin` matching the host (else 403). Login codes come from `crypto.randomInt`, last 10 minutes, are single use and allow 5 attempts, claimed before comparing; they're stored as HMAC-SHA-256 over the email and code, keyed with `ACCOUNT_SECRET`, and compared with `timingSafeEqual`. The reply to a code request never reveals whether an email has an account, and every failed check gets the same message. Account requests have per-email and per-IP limits and a daily cap on account emails, counted in the database under HMAC keys, so no raw email or IP is stored in them. Client IP is the socket off Vercel and `x-vercel-forwarded-for` on it; an IPv6 address is counted by its /64. Requests turned away by a limit do no clean-up work, and the log-in branch for an unknown email does a matching database write, so its timing is close to the others. Hitting the daily cap logs `account_email_cap_hit` with no personal data. Email never goes out inside a write transaction. Logs carry no email, code or token, and an email's log id is random. Unsubscribe links carry a stored random 256-bit token: opening one changes nothing, the POST needs no login or `Origin` because mail apps send it one-click, and it never shows the address. Test helpers for all of this exist only behind `testRoutes`.

## Environment variables

All of these are read only by `backend/config.ts`. On Vercel, set them for **Production only**: previews get no database and no email.

| Name | Used for |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Database (production, and `npm run db:migrate:live`) |
| `RESEND_API_KEY` | Sending email (production) |
| `EMAIL_FROM` | The sender address. Default `Priyanshi · YogaPriyanshi <priyanshi@yogapriyanshi.com>`; it must be on the Resend-verified domain. |
| `EMAIL_FROM_OFFERS` | The sender for offer emails only. Default `Priyanshi · YogaPriyanshi <offers@news.yogapriyanshi.com>`, on its own Resend-verified subdomain (2026-11-15), so spam marks on offers never affect booking and login emails. |
| `ADMIN_PASSWORD_HASH` | Admin login: `scrypt$<salt>$<hash>` from `npm run -s hash-password` (reads the password from stdin). Admin sign-in answers 503 until it's set. |
| `ACCOUNT_SECRET` | Keys the login-code and rate-limit hashes. Production only, at least 32 characters (use 32 random bytes as hex); a value under 32 characters counts as not set, and account routes answer a friendly 503 until it's set. Development and test use a random value per boot. |
| `APP_ENV` | `test` only, for Playwright. It forces a local `file:` database and captured email, and it is refused on Vercel. |
| `LOCAL_DB_URL`, `DB_TARGET`, `EMAIL_TRANSPORT` | Development and test only (local database file, opting into Turso or Resend locally) |
| `ALLOW_LIVE` | Off Vercel only. `NODE_ENV=production` uses the live Turso database and Resend only when `ALLOW_LIVE=1` is also set; otherwise the server runs like development (local file, logged email). Never set it on Vercel; Vercel Production doesn't need it. |

The test server never loads the local env file, so tests can't reach the live database or send real email.

## Key rotation

- Rotate **immediately** if a key is ever exposed.
- Otherwise rotate every 3 months: Resend, Turso and the admin password.
- Rotating `ACCOUNT_SECRET` only ends codes in flight and resets the rate-limit counters. Sessions and unsubscribe links keep working, because neither depends on it.

## The 20-item checklist

The graph's code reviewer checks every change against these 20 items: SQL injection, XSS, CSRF, uploads, object-level access, rate limits, session secrets, server-side secrets, password hashing, MFA, CORS, token storage, server-side permissions, RLS, webhook signatures, SSRF, source maps, default credentials, logs, and dependencies.
