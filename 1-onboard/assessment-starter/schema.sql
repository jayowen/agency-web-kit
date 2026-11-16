-- Brand Assessment Tool: D1 schema
-- One database per client instance. Never shared.

DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS respondents;

CREATE TABLE respondents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT,
  tenure        TEXT,
  tags          TEXT NOT NULL DEFAULT '',   -- comma separated: voice,vote,veto
  admin_note    TEXT NOT NULL DEFAULT '',
  submitted_at  TEXT NOT NULL,
  user_agent    TEXT
);

CREATE UNIQUE INDEX idx_respondents_email ON respondents (lower(email));

CREATE TABLE answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  respondent_id TEXT NOT NULL REFERENCES respondents(id) ON DELETE CASCADE,
  question_key  TEXT NOT NULL,
  value_json    TEXT NOT NULL
);

CREATE INDEX idx_answers_respondent ON answers (respondent_id);
CREATE INDEX idx_answers_key ON answers (question_key);
