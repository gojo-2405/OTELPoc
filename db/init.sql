CREATE TABLE IF NOT EXISTS work_items (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL UNIQUE,
  owner VARCHAR(80) NOT NULL DEFAULT 'Unassigned',
  state VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'blocked', 'complete')),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO work_items (title, owner, state, priority) VALUES
  ('Prepare observability rollout', 'Avery', 'active', 'high'),
  ('Review database connection pool', 'Mina', 'blocked', 'medium'),
  ('Publish service runbook', 'Theo', 'active', 'low')
ON CONFLICT DO NOTHING;
