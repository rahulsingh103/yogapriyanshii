-- 001: initial schema. Times are ISO 8601 UTC strings; emails are stored trimmed and lowercase.

CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  description TEXT NOT NULL,
  style TEXT NOT NULL CHECK (style IN ('hatha', 'barre', 'wheel', 'chakra')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE schedule_template (
  id INTEGER PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  UNIQUE (weekday, start_time)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  start_utc TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  CHECK (booked_count <= capacity),
  UNIQUE (class_id, start_utc)
);
CREATE INDEX sessions_start_idx ON sessions (start_utc);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  used_free_class INTEGER NOT NULL DEFAULT 0 CHECK (used_free_class IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX customers_created_idx ON customers (created_at);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  plan_key TEXT NOT NULL CHECK (plan_key IN ('single', 'pack10', 'pack20')),
  amount_aed INTEGER NOT NULL CHECK (amount_aed >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'studio', 'bank_transfer')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'pending_at_studio', 'paid', 'refunded')),
  credits_total INTEGER NOT NULL,
  credits_left INTEGER NOT NULL CHECK (credits_left >= 0),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX orders_status_paid_idx ON orders (payment_status, paid_at);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  order_id TEXT REFERENCES orders(id),
  plan_key TEXT NOT NULL CHECK (plan_key IN ('free', 'single', 'pack10', 'pack20')),
  mode TEXT NOT NULL CHECK (mode IN ('in_person', 'online')),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  credit_status TEXT NOT NULL CHECK (credit_status IN ('used', 'refunded', 'burned')),
  booked_at TEXT NOT NULL,
  cancelled_at TEXT
);
CREATE UNIQUE INDEX bookings_one_confirmed_per_session
  ON bookings (customer_id, session_id) WHERE status = 'confirmed';
CREATE INDEX bookings_session_idx ON bookings (session_id);
CREATE INDEX bookings_booked_at_idx ON bookings (booked_at);

CREATE TABLE contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  interest TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX contact_messages_created_idx ON contact_messages (created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- The password hash lives in the ADMIN_PASSWORD_HASH env var, not here.
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admin_users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX admin_sessions_expires_idx ON admin_sessions (expires_at);
