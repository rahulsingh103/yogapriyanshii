# Database

**Status (2026-10-10):** wired up. The API reads and writes **Turso** (libSQL/SQLite), database `yogapriyanshi-live`, in production. Development uses a local file (`.data/dev.db`) and the tests use a throwaway file (`.data/e2e.db`, wiped on every run). Live credentials are in the env vars `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (see [SECURITY.md](SECURITY.md)). All database code is in `backend/`.

## Rules

- **Parameterized queries only:** `db.execute({ sql: 'SELECT … FROM bookings WHERE token = ?', args: [token] })`. Never build SQL by joining strings with values.
- **One booking = one transaction** (`withWriteTx` in `backend/db.ts`): check the session, claim the trial class, take the seat, record the order and insert the booking all together, or nothing (PRD §9). Seats are taken with a conditional `UPDATE … SET booked_count = booked_count + 1 WHERE booked_count < capacity`, and a `CHECK (booked_count <= capacity)` backs it up, so two people racing for the last seat can't both win.
- `SQLITE_BUSY` is retried 3 times, then the API answers 503. Local file databases also run their write transactions one at a time inside the process.
- Every list query has a `LIMIT` (max 60).
- Schema changes go through numbered migration files: `db/migrations/001_init.sql`, `002_seed.sql`, … Applied versions are recorded in `schema_migrations`. Never edit the live schema by hand. Migrations are additive.
- Times are stored in UTC (ISO 8601 strings) and displayed in Asia/Dubai (UTC+4, no daylight saving).
- Emails are stored normalized (trimmed, lowercase).

## Migrations

| Command | Target |
|---|---|
| `npm run db:migrate` | the local dev file (`LOCAL_DB_URL`, default `file:.data/dev.db`) |
| `npm run db:migrate:live` | the live Turso DB. **Human-run only**, as a release step. |

- Local `file:` databases migrate themselves when the server starts. Turso never auto-migrates.
- Each migration file runs as one atomic batch, and re-running is safe.

## Schema (`db/migrations/001_init.sql`, plus `003_contact_phone.sql`, `004_membership_requests.sql`, `005_replace_wheel_timetable.sql` and `006_student_accounts.sql`)

| Table | Key columns | Notes |
|---|---|---|
| `classes` | `id` PK, name, level, duration_min, description, style, sort_order | 6 rows, seeded: Hatha, Barre, Chakra, Vinyasa, Yin, and Wheel, which is retired (kept so old sessions and bookings still JOIN). `style` is legacy: read `class_id`, never `style` (see 005 below). |
| `schedule_template` | `id` PK, class_id → classes, weekday (0 = Sun), start_time (`HH:MM` Dubai), capacity | The recurring weekly plan, seeded. UNIQUE(weekday, start_time). |
| `sessions` | `id` PK (`sess-<class>-<utc ms>`), class_id, start_utc, capacity, booked_count, status | Created 56 days ahead from the template (`INSERT OR IGNORE`, at most every 10 minutes). UNIQUE(class_id, start_utc); `CHECK(booked_count <= capacity)`. |
| `customers` | `id` PK, email UNIQUE, full_name, used_free_class (0/1: the trial class is claimed), created_at | The first name given for an email stands: a later booking with the same email doesn't rename the customer. |
| `orders` | `id` PK, customer_id, plan_key, amount_aed, payment_method, payment_status, credits_total, credits_left, expires_at, created_at, paid_at | `payment_status` is **set by the server only**: `pending` or `pending_at_studio` today; `paid` only after a verified payment (Phase 2). |
| `bookings` | `id` PK, token UNIQUE, customer_id, session_id, order_id, plan_key, mode, status, credit_status, booked_at, cancelled_at | Partial unique index on (customer_id, session_id) `WHERE status = 'confirmed'`. The token is `YP-` + 16 Crockford base32 characters. |
| `contact_messages` | `id` PK, name, email, phone, interest, message, created_at | `phone` is optional (NULL when empty), added by `003_contact_phone.sql`. |
| `membership_requests` | `message_id` PK → contact_messages, plan_key, plan_label, price_aed, format, status, start_date, created_at, updated_at | One row per "Monthly membership" contact message, written in the same transaction. The plan's label and price are a snapshot (today `monthly12`, "12-class monthly membership", 2999). `format` is NULL, `in_person` or `online`; `status` is `new`, `contacted` or `active`; `start_date` is a real `YYYY-MM-DD`, set exactly when Active (`CHECK ((status = 'active') = (start_date IS NOT NULL))`). Personal data stays in `contact_messages`. Indexed on (created_at) and (status, created_at). |
| `settings` | `key` PK, value | `notify_email` (where alerts go), `studio_email` (reply-to for students, shown when a rebook is refused), `drive_link` |
| `admin_users` | `id` PK, email, failed_attempts, locked_until | One row. The password hash is **not** here: it's the `ADMIN_PASSWORD_HASH` env var. |
| `admin_sessions` | `token_hash` PK (SHA-256), admin_id, created_at, expires_at | 2-hour sessions. Deleted on logout. |
| `accounts` | `id` PK, email UNIQUE (normalized), created_at, unsubscribe_token UNIQUE, offers_opt_in (0/1), offers_consent_at, offers_consent_version, offers_opted_out_at | One per verified student. Separate from `customers`: no name, and no link to bookings. Created only when a code is verified. |
| `account_sessions` | `token_hash` PK (SHA-256), account_id → accounts, created_at, expires_at | 30-day sessions. Deleted on log-out; expired rows are purged. Indexed on (expires_at). |
| `login_codes` | `email` PK, code_hash (HMAC-SHA-256 over email and code, keyed with `ACCOUNT_SECRET`), attempts, pending_offers (0/1), created_at, expires_at | One live code per email. Deleted when used; expired rows are purged. Indexed on (expires_at). |
| `rate_limits` | `key` PK (HMAC, never a raw email or IP), count, expires_at | Fixed-window counters, in the database because Vercel runs several instances. Indexed on (expires_at). |
| `offers` | `id` PK, subject, body, status (`sending`, `done`), created_at, finished_at | A partial UNIQUE index on status `WHERE status = 'sending'` allows one send at a time. The admin list shows the last 10. |
| `offer_recipients` | (offer_id, account_id) PK, status (`pending`, `sending`, `sent`, `failed`, `skipped`), claimed_at, sent_at | The recipients, taken when the offer is created. The composite key means one row per person per offer. Indexed on (offer_id, status) and (status, sent_at). |

`003_contact_phone.sql` adds the optional `contact_messages.phone` column. It's additive, so code from before it keeps working against a migrated database. Release order: run `db:migrate:live` first, then deploy.

`004_membership_requests.sql` adds the `membership_requests` table and its two indexes (`IF NOT EXISTS`, so a re-run does nothing). It's additive: code from before 004 never reads or writes the table, and that code rejects the "Monthly membership" interest, so there's nothing to backfill. `plan_key` has no CHECK on purpose (plans may change; the server allowlist decides). The start-date CHECK is `start_date IS NULL OR COALESCE(date(start_date) = start_date, 0)`: SQLite's `date()` gives NULL for text that isn't a date and a NULL CHECK would pass, so the COALESCE turns it into a failure ('2026-02-30' and 'abc' are refused).
- **Release order:** 003 is already live, so only 004 is pending. Check with `turso db shell yogapriyanshi-live "SELECT version FROM schema_migrations"`, run `PATH="$HOME/.local/node22/bin:$PATH" npm run db:migrate:live` from `website/` (human-run, Node 22), check `.schema membership_requests`, then deploy. If the code deploys first, membership requests fail with the friendly 500 (never a fake success); other messages are unaffected.
- **Rollback:** revert the code and leave the table; dropping it is a manual, human-only step.
- **Members queries:** the list joins `contact_messages`, filters with `WHERE (? IS NULL OR m.status = ?)`, orders by `created_at DESC, message_id DESC` and pages with `LIMIT 20 OFFSET ?` (page 1 to 1000), plus one `GROUP BY status` for the counts. A status change is one transaction: read the row, compare with the status the admin saw (409 if different), check the step, then `UPDATE … WHERE message_id = ? AND status = ?` (409 if no row changed). Leaving Active clears `start_date`.

`005_replace_wheel_timetable.sql` takes Wheel off the timetable: it adds the `vinyasa` and `yin` classes, deletes the Thursday 18:00 Wheel template row, and adds Vinyasa (Thursday 18:00, 60 min, capacity 12) and Yin (Friday 07:00, 75 min, capacity 12). The Wheel class row and all Wheel sessions and bookings stay.
- **Not additive:** the `DELETE` is a data change and an explicit exception to the additive rule. It uses plain `INSERT`, not `OR IGNORE`, so the batch fails and nothing changes on a slot or id conflict. The template check before migrating covers other differences.
- **`classes.style` is legacy:** SQLite can't alter its CHECK (`hatha`, `barre`, `wheel`, `chakra`), and rebuilding `classes` isn't worth the risk with foreign keys pointing at it. New rows store the placeholder `'wheel'`, and the code stops reading the column: the API sets `style` from `class_id`. **Never write `WHERE style = …`: `'wheel'` there matches Vinyasa and Yin too.** The placeholder is `'wheel'` and not `'hatha'` so that old code can only confuse the old Wheel card, never the Hatha one.
- **Retired class in queries:** `RETIRED_CLASS_ID` in `backend/schedule.ts` is left out of the template, the schedule and `/api/classes`; the admin list shows it only while `booked_count > 0`; `createBooking` answers 404 for it, before any trial claim or seat is touched. Cancel and lookup don't filter, so existing bookings keep working.
- **Release order (human-run, from `website/`, on the commit that contains 005):** migrate first, then deploy straight away.
  1. Read-only checks: `turso db shell yogapriyanshi-live "SELECT version FROM schema_migrations"` (if 004 is still pending, this run applies it too); `turso db shell yogapriyanshi-live "SELECT weekday, start_time, class_id, capacity FROM schedule_template ORDER BY weekday"` must show the 6 seeded rows, otherwise stop; `turso db shell yogapriyanshi-live "SELECT start_utc, booked_count FROM sessions WHERE class_id = 'wheel' AND start_utc > strftime('%Y-%m-%dT%H:%M:%fZ','now') AND booked_count > 0 ORDER BY start_utc LIMIT 60"`.
  2. `PATH="$HOME/.local/node22/bin:$PATH" npm run db:migrate:live`, then re-run the template query: 7 rows, with Thursday `vinyasa`, Friday `yin` and no `wheel`.
  3. Merge to `main` so Vercel deploys.
  4. Check the live site: Thursday and Friday have classes, and `/classes/wheel` gives a 308. Repeat the booked-Wheel query after the deploy, and settle what happens to those bookings against that result.
- **If the code deploys first:** Thursday and Friday show as empty "No class" days while the copy says "every day", and the Vinyasa and Yin cards fall back to the soonest other class, visibly named. Safe, but misleading, so avoid it.
- **Rollback:** revert the code and leave the rows. The old code works against them: Vinyasa and Yin book correctly, and the old Wheel card preselects a new class, visibly named. Restoring the Wheel slot needs a new, human-approved migration.

`006_student_accounts.sql` adds the six account and offer tables above and their indexes (`IF NOT EXISTS`, so a re-run does nothing). It's additive: nothing older reads them, and booking doesn't use them.
- **Release order (human-run):** set `ACCOUNT_SECRET` on Vercel Production, check which migrations are pending, run `db:migrate:live`, then deploy. **`db:migrate:live` applies every pending file**, which may include 004 and the non-additive 005, so read their release notes above first if they're still pending. If the code deploys first, account and offer routes answer a friendly 503 and booking is unaffected.
- **Rollback:** revert the code and leave the tables; dropping them is a manual, human-only step.
- **Queries:** a code is consumed with `DELETE … WHERE email = ? AND code_hash = ? RETURNING`, so concurrent checks have one winner. Each `request-code` deletes at most 100 expired rows from each of `rate_limits`, `login_codes` and `account_sessions`. Creating an offer copies the opted-in accounts into `offer_recipients` in one `INSERT … SELECT` (nothing is returned to the browser); the admin list has `LIMIT 10`.
- **Offers consent versions** (`accounts.offers_consent_version`). A new wording needs a new row here and in `OFFERS_CONSENT` (`backend/validate.ts`):

| Version | Wording |
|---|---|
| `2026-11-07` | Email me monthly and holiday offers from Priyanshi. I can unsubscribe at any time. |

- **Deleting an account (manual, human-run, by email):** there is no self-serve deletion. Against the right database, in one transaction, in this order:
  1. `DELETE FROM offer_recipients WHERE account_id IN (SELECT id FROM accounts WHERE email = ?)`
  2. `DELETE FROM account_sessions WHERE account_id IN (SELECT id FROM accounts WHERE email = ?)`
  3. `DELETE FROM login_codes WHERE email = ?`
  4. `DELETE FROM accounts WHERE email = ?`

  Bookings and contact messages are separate records and aren't touched by this.

`002_seed.sql` adds reference data only: the classes, the weekly template, the default settings and the admin row. There are no sample customers, bookings or messages.

**Relationships:** a customer has many orders and many bookings. A session has many bookings. A booking optionally belongs to an order (free classes booked before the AED 90 trial have none).

## Business rules in the data

- **Trial class (AED 90):** claimed with `UPDATE customers SET used_free_class = 1 WHERE id = ? AND used_free_class = 0`. Cancelling it 6+ hours ahead sets it back to 0; a late cancel keeps it used.
- **How a trial is stored:** the booking keeps `plan_key = 'free'`, the trial's internal name, because the CHECK lists can't change without rebuilding the tables. `orders.plan_key` doesn't allow `free`, so its order row says `plan_key = 'single'`, `amount_aed = 90`, credits 1/0, no expiry. Any report on trials must join `bookings`, since the order alone looks like a single class.
- **Bookings from before the trial:** `plan_key = 'free' AND order_id IS NULL` marks a free class booked before 2026-11-05. The API keeps showing them as AED 0, `paymentStatus: free`, `paymentMethod: complimentary`. If this code is ever reverted, trials booked under it show AED 0 too, with their order rows intact.
- **Before the first deploy with the trial:** run `SELECT COUNT(*) FROM bookings WHERE plan_key='free' AND order_id IS NOT NULL` read-only on live and expect 0.
- **`pending_at_studio` covers online too:** every new order stores it, in person or online. The email and the booking screen choose their wording from the booking's `mode`.
- **Rebooking a cancelled session:** if the customer has a cancelled booking for that session, a new booking is refused (400, `code: session_rebook_blocked`).
- **Packs (known limitation):** paid packs don't yet redeem credits on later bookings. Every paid booking creates its own order, so a 10-pack's `credits_left` is recorded but never spent by a second booking. Redeeming pack credits comes with payments in Phase 2.
- **Cancellation:** one transaction. It marks the booking cancelled only if it's still confirmed, releases the seat, and either refunds (6+ hours: the trial class back, or `credits_left + 1` on the order) or burns the credit.
