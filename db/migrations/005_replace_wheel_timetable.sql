-- 005: Wheel leaves the timetable; Vinyasa takes its Thursday slot and Yin fills Friday (owner, 2026-11-04).
-- classes.style is legacy: the code reads class_id. 'wheel' here is only a value the CHECK allows.
INSERT INTO classes (id, name, level, duration_min, description, style, sort_order) VALUES
  ('vinyasa', 'Vinyasa Yoga', 'Some experience', 60, 'A breath-led flow from pose to pose. Each movement follows the breath, so the class builds strength and focus as it moves along.', 'wheel', 5),
  ('yin', 'Yin Yoga', 'All levels', 75, 'Long, quiet holds, mostly seated or lying down, that give your body time to slow down and let go. A calm, still practice.', 'wheel', 6);

DELETE FROM schedule_template WHERE weekday = 4 AND start_time = '18:00' AND class_id = 'wheel';

INSERT INTO schedule_template (weekday, start_time, class_id, capacity) VALUES
  (4, '18:00', 'vinyasa', 12),
  (5, '07:00', 'yin', 12);
