# Architecture & Data

How every part connects. Last updated 2026-10-10.

## 01 System overview

```
Browser (React SPA) ──fetch /api/*──► backend/ createApp() (Express) ──► Turso (libSQL)
  src/                                  live:  api/index.ts  (Vercel function)
                                        local: server.ts     (dev + tests)  ──► Email (Resend)
```

- **One backend.** All API code lives in `backend/`. `api/index.ts` (Vercel) and `server.ts` (dev and Playwright) are thin wrappers that both mount `createApp()`, so the live site runs exactly the code the tests exercise.
- **Where data and email go depends on the mode** (`backend/config.ts`, the only reader of env vars):

| Mode | When | Database | Email |
|---|---|---|---|
| test | `APP_ENV=test` (Playwright) | `file:.data/e2e.db`, wiped on start. Anything but a `file:` URL is refused. | Captured in memory (the test outbox), never sent |
| development | `npm run dev` | `file:.data/dev.db` (auto-migrated), or Turso if `DB_TARGET=turso` | Logged only, unless `EMAIL_TRANSPORT=resend` |
| production | Vercel Production, or off Vercel with `NODE_ENV=production` **and** `ALLOW_LIVE=1` | Turso (`TURSO_*`) | Resend (`RESEND_API_KEY`, sender `EMAIL_FROM`) |
| preview | Vercel Preview | none: data routes answer 503 | none |

- Off Vercel, `NODE_ENV=production` on its own runs in development mode (local file, logged email). Production mode off Vercel needs the explicit opt-in `ALLOW_LIVE=1`. In development, live services are reachable only through the explicit `DB_TARGET=turso` / `EMAIL_TRANSPORT=resend` opt-ins. On Vercel Production nothing changes.
- If production is missing its database settings, data routes answer 503 with a friendly message rather than pretending to work.

## 02 Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, `motion`, `lucide-react` |
| Backend | Node 22, Express 4, TypeScript (run with `tsx`) |
| Database | Turso (libSQL/SQLite), database `yogapriyanshi-live`, via `@libsql/client/web` (HTTP, no native code). Local files use `@libsql/client`. |
| Email | Resend, plain text, sending as `EMAIL_FROM` (default `Priyanshi · YogaPriyanshi <priyanshi@yogapriyanshi.com>`) |
| Auth | Admin only: one password, checked against the scrypt hash in `ADMIN_PASSWORD_HASH`, then a random session token (2 h) stored server-side as SHA-256. Students have no accounts; a booking token (`YP-` + 16 characters) authorises lookup and cancel. |
| Hosting | Vercel (project `yogapriyanshii`), with `main` as the live branch. DNS on Cloudflare. |
| Tests | Playwright (`e2e/`) |

## 03 Request lifecycle

1. **UI:** a component calls `src/services/api.ts`.
2. **HTTP:** `fetch('/api/...')`. On Vercel, `vercel.json` rewrites `/api/*` to `api/index.ts`.
3. **Route handler** (`backend/routes.ts`): validates input (`backend/validate.ts`) and calls the rule modules (`bookings.ts`, `contact.ts`, `admin.ts`, `schedule.ts`).
4. **Data:** parameterized queries; every booking or cancellation is one write transaction (`withWriteTx` in `backend/db.ts`).
5. **Email:** after the commit, awaited with a 5 s timeout. It never changes the response.
6. **Response:** JSON; errors come back as `{ error: "human message" }` (sometimes with a `code`). Bodies over 100 KB get 413. Unexpected errors get a generic 500 with no stack trace.

## 04 Data model

The full schema is in [DATABASE.md](DATABASE.md). The core entities are Class, Session, Customer, Booking, ContactMessage, Settings and Admin. The TypeScript types are in `src/types/index.ts`.

## 05 Dependency rules

- The UI talks to the backend **only** through `src/services/api.ts`.
- Business rules (prices, capacity, payment status, the free-class rule) live **on the server**. The client never decides them. See [SECURITY.md](SECURITY.md).
- Database access sits in one module, using parameterized queries only.
- Schema changes go through versioned migration files.

## 06 Directory structure

```
website/
├── src/                 React app
│   ├── components/      one file per section or modal
│   ├── services/api.ts  the only place that calls /api
│   ├── types/           shared TS types
│   └── constants/       asset paths
├── backend/             the API, shared by both entry points
│   ├── app.ts           createApp(): body limit, routes, error handler
│   ├── config.ts        the only reader of env; picks the mode and targets
│   ├── db.ts            lazy client, write transactions with SQLITE_BUSY retry
│   ├── migrate.ts       applies db/migrations in order
│   ├── schedule.ts      creates sessions 56 days ahead; the /api/schedule shape
│   ├── bookings.ts      book, look up, cancel; prices; the 6-hour rule
│   ├── contact.ts       stores messages, alerts the studio
│   ├── admin.ts         login and lockout, sessions, stats, settings
│   ├── settings.ts      notify_email, studio_email, drive_link
│   ├── email.ts         templates and delivery (Resend / outbox / log)
│   ├── tokens.ts        booking and admin tokens
│   ├── validate.ts      input allowlists and limits
│   └── routes.ts        the HTTP routes
├── db/migrations/       001_init.sql, 002_seed.sql, …
├── scripts/             migrate.ts, hash-password.ts
├── api/index.ts         Vercel entry: mounts createApp()
├── server.ts            dev/test entry: createApp() + Vite or static files
├── e2e/                 Playwright tests
├── public/media/        site photos and videos
├── docs/                these 8 docs
└── AGENTS.md            rules for AI coding agents
```

## 07 Failure handling

| Scenario | Handling |
|---|---|
| API timeout or down | `api.ts` throws an `ApiError` with a human message and the UI shows it. **Nothing is faked locally**: no local bookings, schedules, logins or stats. |
| Database not configured (preview) | 503 with a friendly message |
| Database busy | Write transactions retry `SQLITE_BUSY` 3 times, then 503 |
| Invalid input | 400 with a clear message shown inline |
| Class full or duplicate booking | 400 with a specific message (never the existing booking token) |
| Body too large | 413 |
| Email send fails | Never blocks or rolls back anything. Logged as `email_failed type=… id=…`, with no personal data. The booking screen says the email couldn't be sent. |
