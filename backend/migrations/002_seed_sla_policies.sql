-- Default SLA policy matrix (resolution target in hours)
INSERT INTO sla_policies (category, priority, resolution_hours) VALUES
  ('IT', 'critical', 4),   ('IT', 'high', 8),   ('IT', 'medium', 24),  ('IT', 'low', 72),
  ('HR', 'critical', 8),   ('HR', 'high', 24),  ('HR', 'medium', 48),  ('HR', 'low', 96),
  ('Facility', 'critical', 4), ('Facility', 'high', 12), ('Facility', 'medium', 48), ('Facility', 'low', 120)
ON CONFLICT (category, priority) DO NOTHING;
