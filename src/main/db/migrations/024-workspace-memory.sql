-- Migration 024: workspace_memory — project context (Layer 0) + pinned learnings (Layer 2)
-- Layer 1 (session summaries) is built on demand from task_events + sbar_handoffs — no table needed.

ALTER TABLE projects ADD COLUMN context_doc TEXT;
ALTER TABLE projects ADD COLUMN context_doc_updated_at TEXT;

CREATE TABLE IF NOT EXISTS workspace_memory (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content               TEXT NOT NULL,
  source_id             TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  pinned_at             TEXT NOT NULL DEFAULT (datetime('now')),
  anamnesis_id          TEXT,
  synced_to_anamnesis   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_workspace_memory_project
  ON workspace_memory(project_id, pinned_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_memory_unsynced
  ON workspace_memory(synced_to_anamnesis) WHERE synced_to_anamnesis = 0;
