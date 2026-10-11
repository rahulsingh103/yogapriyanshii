-- 002: reference data only (the PRD classes, the weekly template, default settings, the admin row). No sample customers or bookings.

INSERT OR IGNORE INTO classes (id, name, level, duration_min, description, style, sort_order) VALUES
  ('hatha', 'Hatha Yoga', 'All levels', 60, 'The classical root of the practice — foundational postures, precise alignment, and the relationship between breath and movement. No experience necessary.', 'hatha', 1),
  ('barre', 'Barre Yoga', 'All levels', 60, 'Strength work woven with deep, intentional stretching. Small controlled movements build heat and tone, then long holds open everything back up.', 'barre', 2),
  ('wheel', 'Wheel Yoga', 'All levels', 75, 'Priyanshi''s signature class. The yoga wheel supports the spine through backbends and chest openers that feel impossible without it — then suddenly don''t.', 'wheel', 3),
  ('chakra', 'Chakra Yoga Flow', 'Beginner friendly', 60, 'A moving meditation through the body''s energy centres, pairing breath, sound, and sequence. Grounding, clearing, and deeply restorative.', 'chakra', 4);

-- weekday: 0 = Sunday … 6 = Saturday (Dubai time). Friday (5) is the rest day.
INSERT OR IGNORE INTO schedule_template (weekday, start_time, class_id, capacity) VALUES
  (1, '07:00', 'barre', 12),
  (2, '18:00', 'hatha', 12),
  (3, '07:00', 'barre', 12),
  (4, '18:00', 'wheel', 10),
  (6, '09:00', 'chakra', 15),
  (0, '10:00', 'hatha', 12);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('notify_email', 'nbsingh2050@gmail.com'),
  ('studio_email', 'nbsingh2050@gmail.com'),
  ('drive_link', '');

INSERT OR IGNORE INTO admin_users (id, email) VALUES (1, 'priyanshi@yogapriyanshi.com');
