-- Membership requests from "Join the membership": one row per contact message with interest
-- "Monthly membership". Additive: code from before 004 never reads or writes this table.
-- plan_key has no CHECK on purpose: plans may change, the server allowlist decides.
-- Each row snapshots the plan's label and price; personal data stays in contact_messages.
-- date(x) is NULL for text that isn't a date, and a NULL CHECK passes, hence the COALESCE.
CREATE TABLE IF NOT EXISTS membership_requests (
  message_id TEXT PRIMARY KEY REFERENCES contact_messages(id),
  plan_key TEXT NOT NULL,
  plan_label TEXT NOT NULL,
  price_aed INTEGER NOT NULL CHECK (price_aed >= 0),
  format TEXT CHECK (format IS NULL OR format IN ('in_person', 'online')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'active')),
  start_date TEXT CHECK (start_date IS NULL OR COALESCE(date(start_date) = start_date, 0)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((status = 'active') = (start_date IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS membership_requests_created_idx ON membership_requests (created_at);
CREATE INDEX IF NOT EXISTS membership_requests_status_created_idx ON membership_requests (status, created_at);
