-- Migration 031: Expand brain_entries type constraint for auto-discovery
-- Add strategy, marketing, how-to, reference, learning types
-- SQLite doesn't support ALTER CHECK, so recreate the table

CREATE TABLE brain_entries_new (
  id              TEXT PRIMARY KEY,
  repo_id         TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
  pointer_path    TEXT NOT NULL UNIQUE,
  artifact_path   TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN (
    'brainstorm','spec','plan','sprint',
    'strategy','marketing','how-to','reference','learning'
  )),
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK(status IN ('draft','active','parked','implemented')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_to_anamnesis INTEGER NOT NULL DEFAULT 0,
  note            TEXT
);

INSERT INTO brain_entries_new
  SELECT id, repo_id, project_id, pointer_path, artifact_path, type, subject,
         status, created_at, updated_at, synced_to_anamnesis, note
  FROM brain_entries;

DROP TABLE brain_entries;
ALTER TABLE brain_entries_new RENAME TO brain_entries;

CREATE INDEX idx_brain_entries_repo    ON brain_entries(repo_id);
CREATE INDEX idx_brain_entries_project ON brain_entries(project_id);
CREATE INDEX idx_brain_entries_status  ON brain_entries(status);
CREATE INDEX idx_brain_entries_type    ON brain_entries(type);
