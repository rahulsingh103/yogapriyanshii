# Architecture & Data

How every part connects. Last updated 2026-11-07.

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
| Auth | Admin only: one password, checked against the scrypt hash in `ADMIN_PASSWORD_HASH`, then a random session token (2 h) stored server-side as SHA-256. A booking token (`YP-` + 16 characters) authorises lookup and cancel. Students can have an optional account: a 6-digit email code, then a 30-day session cookie ([SECURITY.md](SECURITY.md) rule 16). Booking never needs one. |
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

- The UI talks to the backend **only** through `src/services/api.ts`, or its lazy half `src/services/account-api.ts` (the account sheet, the unsubscribe page and the Offers tab), which keeps those calls out of the homepage bundle.
- `backend/` never imports from `src/`: every API route loads through `api/index.ts`, so a bundling failure there could take booking down. `PRODUCTION_SITE_URL` in `backend/config.ts` duplicates `SITE_URL` in `src/lib/page-meta.ts`, and spec 16 checks they match.
- Business rules (prices, capacity, payment status, the trial-class rule) live **on the server**. The client never decides them. See [SECURITY.md](SECURITY.md).
- Database access sits in one module, using parameterized queries only.
- Schema changes go through versioned migration files.

## 06 Directory structure

```
website/
├── src/                 React app
│   ├── components/      one file per section or modal; ModalSheet is the shared modal shell
│   ├── hooks/           useScrollToSection (Lenis), useRoute (use-route.ts: pathname, Back/Forward, navigate), Animate UI hooks
│   ├── lib/             cn(), the shared token class strings (ui.ts), gestures, the FAQPage JSON-LD builder (faq-schema.ts),
│   │                    routing: route.ts (resolveRoute), page-meta.ts (the head SEO block), route-html.ts (applyRoute),
│   │                    articles: article-md.ts (the pure parser), article-meta.ts (their head metadata), article-files.ts (node only: reads the published files)
│   ├── content/         articles.ts (lazy glob of the published guides) and articles/ (published .md files; .gitkeep today)
│   ├── services/        api.ts and account-api.ts (its lazy half): the only places that call /api
│   ├── types/           shared TS types
│   └── constants/       asset paths, classes, the FAQ (faq.ts), the reviews (testimonials.ts), the class finder
│                        (class-finder.ts: questions, mapping table, copy, prefill; class-finder-health.ts: the optional details' copy, cleaning and message;
│                        finder-notices.ts: the two notices shared with the class pages; all pure, relative imports only),
│                        the WhatsApp and Instagram settings (contact.ts: number, prefills incl. CALL_PREFILL, INSTAGRAM_URL),
│                        and the monthly membership copy (membership.ts: card, form copy, membershipPrefill(); pure)
│                        and the class pages' copy (class-pages.ts: who it's for, about, details, photos, what to bring; pure)
├── backend/             the API, shared by both entry points
│   ├── app.ts           createApp(): body limit, routes, error handler
│   ├── config.ts        the only reader of env; picks the mode and targets
│   ├── db.ts            lazy client, write transactions with SQLITE_BUSY retry
│   ├── migrate.ts       applies db/migrations in order
│   ├── schedule.ts      creates sessions 56 days ahead; the /api/schedule shape
│   ├── bookings.ts      book, look up, cancel; prices; the 24-hour cancel rule (src/constants/cancel-policy.ts)
│   ├── contact.ts       stores messages (optional phone), alerts the studio; a "Monthly membership" message also
│   │                    stores its membership request in the same transaction
│   ├── membership.ts    the membership plan, the Members list (20 a page) and status changes (one step, 409 if stale)
│   ├── admin.ts         login and lockout, sessions, stats, settings
│   ├── settings.ts      notify_email, studio_email, drive_link
│   ├── accounts.ts      request code, verify, session, update, log out, the CSRF guard, sessionCookie()
│   ├── rate-limit.ts    fixed-window counters in the database, with hashed keys; clientIp()
│   ├── offers.ts        the Offers tab: overview, create, send-batch; unsubscribe; batch, pacing and daily cap
│   ├── email.ts         templates and delivery (Resend / outbox / log)
│   ├── tokens.ts        booking and admin tokens
│   ├── validate.ts      input allowlists and limits
│   └── routes.ts        the HTTP routes
├── db/migrations/       001_init.sql, 002_seed.sql, 003_contact_phone.sql, 004_membership_requests.sql, 005_replace_wheel_timetable.sql, 006_student_accounts.sql
├── scripts/             migrate.ts, hash-password.ts
├── api/index.ts         Vercel entry: mounts createApp()
├── server.ts            dev/test entry: createApp() + Vite (applyRoute on every page) or the built files
├── e2e/                 Playwright tests (fixtures/article.md: synthetic lorem for the article view)
├── public/media/        site photos and videos: images/practice (class cards), images/real (real photos of
│                        Priyanshi: the About photo and the Instagram tiles)
├── docs/                these 8 docs
└── AGENTS.md            rules for AI coding agents
```

- **Build-time HTML:** `vite.config.ts` has one small plugin, `faq-structured-data`, that injects the FAQPage JSON-LD (built from `src/constants/faq.ts` by `src/lib/faq-schema.ts`) into `<head>`, so it's in the first HTML response in dev and in the build. Those two files stay pure: relative imports only, no `@/` alias and no `import.meta.env`. So do the modules the `route-pages` plugin reads: `src/lib/route.ts`, `src/lib/page-meta.ts`, `src/lib/route-html.ts`, `src/lib/article-md.ts` and `src/constants/class-pages.ts` (and what they import: `classes.ts`, `finder-notices.ts`, `testimonials.ts`).
- **Pages and routing (Batch 4a):** one React app, one shell. `src/lib/route.ts` maps a pathname to home, a class (`/classes/<slug>`, slugs from `classes.ts`, matched exactly, trailing slash fine) a published guide (`/guides/<slug>`, and `/guides` once one exists), a dev-only draft preview (`/drafts/<slug>`), or notFound. `App.tsx` renders the home `<main>` unchanged, or a lazy `ClassPage` / `NotFound` chunk inside the same header, footer, WhatsApp button and modals. In-app links use `history.pushState` (`src/hooks/use-route.ts`): before leaving home it saves `{ y, cardSlug }` in the home entry, and the page entry carries `{ yp: 'class', from: 'home' }`, so "All classes" can go Back and Back restores the card (Lenis jump to `#classes`, the track scrolled to the card, focus on its "Learn more"). `scrollRestoration` becomes `manual` on the first in-app navigation only. The `cardSlug` read back from `history.state` is checked against the known slugs before it is used in a selector. Going home from a page that unmounts (a header or footer link, the 404's links, "All classes" after a direct load) jumps to the section and then focuses its heading (the hero's h1 without a section) with `preventScroll`. Those handlers call `stopPropagation()` as well as `preventDefault()`, so Lenis's window-level anchor handling never starts its own smooth scroll.
- **Prerender (option D):** the same pure transform, `applyRoute(html, route)` in `src/lib/route-html.ts`, runs in two places. In the build, the `route-pages` plugin in `vite.config.ts` (`apply: 'build'`, `generateBundle` with `order: 'post'`) takes the finished home HTML and emits `classes/<slug>/index.html` (10), `404.html`, `sitemap.xml` and `robots.txt` (allow all, `Disallow: /api/`, the sitemap URL); each page gets a `modulepreload` for its lazy chunk. It fails the build if the `<!-- seo:start -->` / `<!-- seo:end -->` markers in `index.html` aren't there exactly once, if the FAQ JSON-LD is missing from home, or if `HOME_META` (`page-meta.ts`) no longer mirrors the marked block. In dev and tests, the `server.ts` catch-all runs `vite.transformIndexHtml('/', …)` then `applyRoute` on the URL's pathname, and answers 404 for notFound. `applyRoute` swaps the marked head block (title, description, canonical, og:url, Twitter title and description; the 404 drops canonical and og:url and adds robots noindex), removes the FAQ JSON-LD off home, makes `./` asset paths root-relative and fills `<div id="root">` with escaped static content that React replaces on load. Home is returned untouched, so its HTML differs from before only by the two marker comments. The client keeps the head in step with `setDocumentHead()`. The preloader fades on home at once, elsewhere only once the lazy page has mounted.
- **Articles ("Guides", Batch 4b, live 2026-11-15 with four guides):** each published article is a Markdown file in `src/content/articles/` (four published 2026-11-15). `src/lib/article-md.ts` (pure) parses its front matter (title, description, status, reviewedBy, published, and optionally `action: ask` with an `interest` from `backend/validate.ts` CONTACT_INTERESTS) and a small subset (`##` headings, paragraphs, `- ` bullets with an optional leading label, https-only links; `## Sources` is marked) into plain blocks, never HTML. Its errors name a line number, never the line's text. The head metadata for these pages (`GUIDES_META`, `articleMeta`, `DRAFT_META`) is in `src/lib/article-meta.ts`, and the owner's on-request line in `src/constants/on-request.ts` (shared with the class pages), so neither is in the homepage bundle. The client loads them lazily through `src/content/articles.ts` (`import.meta.glob('./articles/*.md', { query: '?raw' })`; only the slug list, `PUBLISHED_ARTICLES`, is in the homepage bundle) and renders them in the lazy `ArticlePage` and `GuidesIndex` chunks. The build reads the same folder through the node-only `src/lib/article-files.ts`, fails on any file that isn't `status: published` with a date and `reviewedBy`, or that still contains "(link to verify)" or "URL to confirm", and emits `guides/<slug>/index.html`, `guides/index.html` and their sitemap entries; the dev server reads it per request and the production branch of `server.ts` serves the prebuilt files (exact slugs, else the 404). With nothing published, `/guides` is a 404, the footer has no Guides link and no `guides/` folder is built. Vercel needs a preview check (and probably a `/guides/:slug` rewrite) before the first article goes live.
- **Draft previews (dev only):** drafts live outside the repo in `content-drafts/articles/`. With `SHOW_DRAFTS=1` the dev server adds `<meta name="yp-drafts" content="on">` and `GET /__drafts/:slug` (loopback only, slug allowlist, inside `DRAFTS_DIR` by prefix and `realpath`, no symlinks, `noindex`, `no-store`); `/drafts/<slug>` returns 200 only when the file exists. The client's `DraftPreview` (lazy, behind `import.meta.env.DEV`) fetches it and renders the article view under a "Draft, not published. Not yet reviewed by Priyanshi." banner with a fixed noindex head. With `APP_ENV=test`, `/__test/article` does the same with the synthetic fixture `e2e/fixtures/article.md`. Neither exists in a build; spec 14's canary build proves it.
- **Serving built pages:** `server.ts` in production serves `dist` with `express.static(dist, { redirect: false, index: 'index.html' })` (serve-static rejects `index: true`); a `/classes/<slug>` path must be one of the prerendered slugs (else `404.html` with 404), every other unknown path gets `404.html` with 404. On Vercel, static files are served before rewrites and a missing path gets `404.html` with a 404; `vercel.json` is unchanged in 4a. **Check on a Vercel preview before release:** 200 with the right h1 and canonical for `/`, `/classes/hatha` and `/classes/hatha/`; 404 status and the 404 body for `/classes/Hatha`, `/classes/nope` and `/nope`; `/api/health` and one `/api` POST against preview or test data only; `/og-image.jpg`, `/sitemap.xml` and `/robots.txt` with the right content types; `/unsubscribe` and `/unsubscribe/` give 200 with robots noindex; `GET /api/offers/unsubscribe?token=` gives a 302 to the page with its query intact; a same-origin `POST /api/account/request-code` passes the Origin check behind the rewrite (it answers 503 on a preview, which has no database, never 403).
- **Student accounts:** `useAccount` (`src/hooks/use-account.ts`) reads a non-secret `localStorage` hint, `yp_has_session`. With no hint the header shows Log in and Sign up at once and makes no request. With a hint it keeps those slots empty until `GET /api/account/me` answers, for at most 4 seconds (a later answer still swaps Account in); a null answer clears the hint, and any failure shows the buttons and keeps the hint so the next load checks again. `AccountModal`, `UnsubscribePage`, `AdminDashboard` (with `AdminMembers`) and `AdminOffers` are lazy chunks, loaded on the first tap. Opening the account view fetches `/me` again. Links in emails use `siteUrl` from `backend/config.ts`, which only test mode overrides (with `PORT`), so preview links stay on localhost.
- **Sending offers:** the browser drives short calls to `POST /api/admin/offers/:id/send-batch`: at most 10 sends or 4 seconds a call, sends 1 second apart, calls 1 second apart. Each recipient is claimed in its own write transaction, then sent outside it, then marked. Concurrent calls can't claim the same row, and a row left "sending" for 30 seconds becomes "failed" and is never sent again.
- **Retired class (Wheel):** `RETIRED_CLASS_ID` in `backend/schedule.ts` keeps it out of the template, the schedule, `/api/classes` and new bookings (404), while existing bookings still look up and cancel through its row. The API sets each session's `style` from `class_id`, because `classes.style` is legacy ([DATABASE.md](DATABASE.md), 005). `vercel.json` redirects `/classes/wheel` and `/classes/wheel/` to `/classes/spine-healing`; there is no such redirect locally, where the path is a 404.
- **Instagram:** the section shows our own copies of her photos and links to the profile (`INSTAGRAM_URL`); no embed, API or third-party script.
- **WhatsApp:** links go straight to `https://wa.me/<number>?text=…`; nothing passes through the backend. `WHATSAPP_ENABLED` in `src/constants/contact.ts` is the one switch for the floating button, the Contact link, the How it works call link ("Book a free 15-minute call", `CALL_PREFILL`), the class finder's "Ask Priyanshi on WhatsApp", or "Send this on WhatsApp" once details are added (its prefill comes from `classFinderPrefill()` in `class-finder.ts`: fixed labels for the answers and the suggested class; the component wraps it with `whatsappUrl()`), the membership success link "Continue on WhatsApp" (`membershipPrefill()` in `membership.ts`) and the booking-confirmation link. Prefills never carry personal data, with two explicit exceptions. The membership prefill includes the name the person just typed (owner-approved, Batch 3), and it's only sent if they tap the link; it never includes their email or phone. The class finder's optional age, height and health notes are added after its fixed prefill by `classFinderMessage()` in `class-finder-health.ts` (owner decision 2026-11-05). They exist only in the open sheet's state and in that link, and the student is told opening it shares the text with WhatsApp and that the browser may keep the link. Rule 14 in SECURITY.md. It's false in production builds until the real number replaces the placeholder, and the placeholder is compiled out of the bundle.

## 07 Failure handling

| Scenario | Handling |
|---|---|
| API timeout or down | `api.ts` throws an `ApiError` with a human message and the UI shows it. **Nothing is faked locally**: no local bookings, schedules, logins or stats. |
| Database not configured (preview) | 503 with a friendly message |
| Database busy | Write transactions retry `SQLITE_BUSY` 3 times, then 503 |
| Invalid input | 400 with a clear message shown inline |
| Class full or duplicate booking | 400 with a specific message (never the existing booking token) |
| Body too large | 413 |
| Offline | The offline pill shows and the WhatsApp button hides (its link can't work offline). |
| The class finder's chunk fails to load (it is lazy, preloaded at idle on home and article pages, except on data saver or 2G, where the tap loads it) | The sheet's open state is set only after the chunk arrives, so the page stays live and the floating WhatsApp button stays. A tap does the same one guarded reload (not when offline, and never from the idle preload); after that the button does nothing more. A render failure inside the sheet goes to a `PageErrorBoundary` with `fallback={null}`, which never adds a second `<main>`, and drops the finder so the next tap starts clean. Anything else that takes over the screen during the wait cancels the open. |
| A lazy page chunk fails to load (often a deploy replaced the files) | `PageErrorBoundary` around the lazy pages' `Suspense` does one hard reload, guarded by the `yp-chunk-reload` sessionStorage flag, so it never loops. The flag clears once a lazy page mounts (`markReady`), or on home once the finder's chunk loads; never from the finder's chunk on a lazy page, whose own chunk may still fail after it. Any other error, or a second failure, fades the preloader and shows a calm "This page didn't load" message with a link to `/`. |
| Account tables missing (code deployed before migration 006), or `ACCOUNT_SECRET` not set | Account and offer routes answer a friendly 503. The header shows Log in and Sign up, and nothing else on the site changes. |
| `/api/account/me` fails | Log in and Sign up show, and the hint stays so the next load checks again |
| An account email can't be sent | 503 with an honest message and no code step, never a pretend "check your email" |
| Daily account email cap hit | 503 with an honest message and no email in any branch. Nobody can sign up or log in until it resets (up to 24 hours). Booking email is unaffected. |
| Offer send cut off, or a recipient fails | Counted as "not delivered" and never retried. A closed tab shows "Continue sending". The daily cap pauses the send and it can continue later. |
| Email send fails (booking, cancel, contact) | Never blocks or rolls back anything. Logged as `email_failed type=… id=…`, with no personal data. The booking screen says the email couldn't be sent. |
