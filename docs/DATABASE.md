# Database

**Status (2026-10-10):** wired up. The API reads and writes **Turso** (libSQL/SQLite), database `yogapriyanshi-live`, in production. Development uses a local file (`.data/dev.db`) and the tests use a throwaway file (`.data/e2e.db`, wiped on every run). Live credentials are in the env vars `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (see [SECURITY.md](SECURITY.md)). All database code is in `backend/`.

## Rules

- **Parameterized queries only:** `db.execute({ sql: 'SELECT … FROM bookings WHERE token = ?', args: [token] })`. Never build SQL by joining strings with values.
- **One booking = one transaction** (`withWriteTx` in `backend/db.ts`): check the session, claim the free class, take the seat, record the order and insert the booking all together, or nothing (PRD §9). Seats are taken with a conditional `UPDATE … SET booked_count = booked_count + 1 WHERE booked_count < capacity`, and a `CHECK (booked_count <= capacity)` backs it up, so two people racing for the last seat can't both win.
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

## Schema (`db/migrations/001_init.sql`)

| Table | Key columns | Notes |
|---|---|---|
| `classes` | `id` PK, name, level, duration_min, description, style, sort_order | 4 rows (Hatha, Barre, Wheel, Chakra), seeded |
| `schedule_template` | `id` PK, class_id → classes, weekday (0 = Sun), start_time (`HH:MM` Dubai), capacity | The recurring weekly plan, seeded. UNIQUE(weekday, start_time). |
| `sessions` | `id` PK (`sess-<class>-<utc ms>`), class_id, start_utc, capacity, booked_count, status | Created 56 days ahead from the template (`INSERT OR IGNORE`, at most every 10 minutes). UNIQUE(class_id, start_utc); `CHECK(booked_count <= capacity)`. |
| `customers` | `id` PK, email UNIQUE, full_name, used_free_class (0/1), created_at | The first name given for an email stands: a later booking with the same email doesn't rename the customer. |
| `orders` | `id` PK, customer_id, plan_key, amount_aed, payment_method, payment_status, credits_total, credits_left, expires_at, created_at, paid_at | `payment_status` is **set by the server only**: `pending` or `pending_at_studio` today; `paid` only after a verified payment (Phase 2). |
| `bookings` | `id` PK, token UNIQUE, customer_id, session_id, order_id, plan_key, mode, status, credit_status, booked_at, cancelled_at | Partial unique index on (customer_id, session_id) `WHERE status = 'confirmed'`. The token is `YP-` + 16 Crockford base32 characters. |
| `contact_messages` | `id` PK, name, email, interest, message, created_at | |
| `settings` | `key` PK, value | `notify_email` (where alerts go), `studio_email` (reply-to for students, shown when a rebook is refused), `drive_link` |
| `admin_users` | `id` PK, email, failed_attempts, locked_until | One row. The password hash is **not** here: it's the `ADMIN_PASSWORD_HASH` env var. |
| `admin_sessions` | `token_hash` PK (SHA-256), admin_id, created_at, expires_at | 2-hour sessions. Deleted on logout. |

`002_seed.sql` adds reference data only: the classes, the weekly template, the default settings and the admin row. There are no sample customers, bookings or messages.

**Relationships:** a customer has many orders and many bookings. A session has many bookings. A booking optionally belongs to an order (free classes have none).

## Business rules in the data

- **Free class:** claimed with `UPDATE customers SET used_free_class = 1 WHERE id = ? AND used_free_class = 0`. Cancelling it 6+ hours ahead sets it back to 0; a late cancel keeps it used.
- **Rebooking a cancelled session:** if the customer has a cancelled booking for that session, a new booking is refused (400, `code: session_rebook_blocked`).
- **Packs (known limitation):** paid packs don't yet redeem credits on later bookings. Every paid booking creates its own order, so a 10-pack's `credits_left` is recorded but never spent by a second booking. Redeeming pack credits comes with payments in Phase 2.
- **Cancellation:** one transaction. It marks the booking cancelled only if it's still confirmed, releases the seat, and either refunds (6+ hours: the free class back, or `credits_left + 1` on the order) or burns the credit.
