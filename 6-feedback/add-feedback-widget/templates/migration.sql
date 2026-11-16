-- In-app feedback feature — idempotent migration.
-- Safe to re-run. Apply to dev first, then prod.
--
-- Single-tenant apps: delete the organization_id column line and the
-- idx_feedback_organization_id index below.
-- No impersonation: you may drop impersonator_user_id / was_impersonating.

CREATE TABLE IF NOT EXISTS feedback (
  id                    SERIAL PRIMARY KEY,
  organization_id       INTEGER REFERENCES organizations(id),
  user_id               TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitter_name        TEXT,
  submitter_email       TEXT,
  type                  TEXT NOT NULL,
  comment               TEXT NOT NULL,
  url                   TEXT,
  user_agent            TEXT,
  screen_width          INTEGER,
  screen_height         INTEGER,
  viewport_width        INTEGER,
  viewport_height       INTEGER,
  screenshot            TEXT,
  impersonator_user_id  TEXT,
  was_impersonating     BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'new',
  created_at            TIMESTAMP NOT NULL DEFAULT now(),
  updated_at            TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status          ON feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at      ON feedback (created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_organization_id ON feedback (organization_id);

-- OPTIONAL audit-log table (only if actions.ts keeps the logAction() calls and
-- you don't already have an equivalent table):
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            SERIAL PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  details       JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
