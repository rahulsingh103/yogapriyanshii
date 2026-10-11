# Security

These are the security policies for this codebase. This repo is **public**, so known open issues are tracked privately, outside the repo, and are never written here.

## Rules every change must follow

1. **Auth on every non-public route.** Public routes (classes, schedule, booking, contact) are rate-limited. Booking tokens are long and random.
2. **All decisions are made on the server.** Login, permissions, price, payment status, capacity and the free-class rule are never trusted from the browser.
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

## Environment variables

All of these are read only by `backend/config.ts`. On Vercel, set them for **Production only**: previews get no database and no email.

| Name | Used for |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Database (production, and `npm run db:migrate:live`) |
| `RESEND_API_KEY` | Sending email (production) |
| `EMAIL_FROM` | The sender address. Default `Priyanshi · YogaPriyanshi <priyanshi@yogapriyanshi.com>`; it must be on the Resend-verified domain. |
| `ADMIN_PASSWORD_HASH` | Admin login: `scrypt$<salt>$<hash>` from `npm run -s hash-password` (reads the password from stdin). Admin sign-in answers 503 until it's set. |
| `APP_ENV` | `test` only, for Playwright. It forces a local `file:` database and captured email, and it is refused on Vercel. |
| `LOCAL_DB_URL`, `DB_TARGET`, `EMAIL_TRANSPORT` | Development and test only (local database file, opting into Turso or Resend locally) |
| `ALLOW_LIVE` | Off Vercel only. `NODE_ENV=production` uses the live Turso database and Resend only when `ALLOW_LIVE=1` is also set; otherwise the server runs like development (local file, logged email). Never set it on Vercel; Vercel Production doesn't need it. |

The test server never loads the local env file, so tests can't reach the live database or send real email.

## Key rotation

- Rotate **immediately** if a key is ever exposed.
- Otherwise rotate every 3 months: Resend, Turso and the admin password.

## The 20-item checklist

The graph's code reviewer checks every change against these 20 items: SQL injection, XSS, CSRF, uploads, object-level access, rate limits, session secrets, server-side secrets, password hashing, MFA, CORS, token storage, server-side permissions, RLS, webhook signatures, SSRF, source maps, default credentials, logs, and dependencies.
