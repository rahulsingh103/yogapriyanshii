-- Optional phone number on contact messages. Additive: older code ignores the column,
-- and existing rows keep NULL.
ALTER TABLE contact_messages ADD COLUMN phone TEXT;
