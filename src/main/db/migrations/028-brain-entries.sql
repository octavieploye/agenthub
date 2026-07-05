-- Migration 028: Create brain_entries table
-- This table tracks brainstorm, spec, plan, and sprint artifacts across repos

CREATE TABLE brain_entries (
  id              TEXT PRIMARY KEY,
  repo_id         TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
  pointer_path    TEXT NOT NULL UNIQUE,   -- absolute path to docs/brain/*.md
  artifact_path   TEXT NOT NULL,          -- absolute path to actual artifact doc
  type            TEXT NOT NULL CHECK(type IN ('brainstorm','spec','plan','sprint')),
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK(status IN ('draft','active','parked','implemented')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_to_anamnesis INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX idx_brain_entries_repo    ON brain_entries(repo_id);
CREATE INDEX idx_brain_entries_project ON brain_entries(project_id);
CREATE INDEX idx_brain_entries_status  ON brain_entries(status);
CREATE INDEX idx_brain_entries_type    ON brain_entries(type);