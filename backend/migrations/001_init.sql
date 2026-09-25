-- Core schema for the Employee Service Request System

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'agent', 'admin')),
  department    VARCHAR(20) CHECK (department IN ('IT', 'HR', 'Facility', NULL)),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_policies (
  id                SERIAL PRIMARY KEY,
  category          VARCHAR(20) NOT NULL CHECK (category IN ('IT', 'HR', 'Facility')),
  priority          VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  resolution_hours  INTEGER NOT NULL,
  UNIQUE (category, priority)
);

CREATE TABLE IF NOT EXISTS requests (
  id                SERIAL PRIMARY KEY,
  employee_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category          VARCHAR(20) NOT NULL CHECK (category IN ('IT', 'HR', 'Facility')),
  title             VARCHAR(160) NOT NULL,
  description       TEXT NOT NULL,
  priority          VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status            VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'cancelled')),
  assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sla_due_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS request_comments (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit-friendly activity record: every meaningful state change is logged
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_employee ON requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_agent ON requests(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_logs(request_id);
