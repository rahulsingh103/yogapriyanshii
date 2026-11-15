-- Student accounts: email one-time codes, sessions, opt-in offers. Additive: nothing older reads these
-- tables, and accounts stay separate from customers (reading and booking need no account).
-- rate_limits keys are HMACs, never a raw email or IP.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  offers_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (offers_opt_in IN (0, 1)),
  offers_consent_at TEXT,
  offers_consent_version TEXT,
  offers_opted_out_at TEXT
);
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessions_expires_idx ON account_sessions (expires_at);
CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  pending_offers INTEGER NOT NULL DEFAULT 0 CHECK (pending_offers IN (0, 1)),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_codes_expires_idx ON login_codes (expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limits (expires_at);
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'done')),
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_sending_idx ON offers (status) WHERE status = 'sending';
CREATE TABLE IF NOT EXISTS offer_recipients (
  offer_id TEXT NOT NULL REFERENCES offers(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  claimed_at TEXT,
  sent_at TEXT,
  PRIMARY KEY (offer_id, account_id)
);
CREATE INDEX IF NOT EXISTS offer_recipients_offer_status_idx ON offer_recipients (offer_id, status);
CREATE INDEX IF NOT EXISTS offer_recipients_status_sent_idx ON offer_recipients (status, sent_at);
