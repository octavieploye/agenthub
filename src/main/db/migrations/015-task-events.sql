-- Migration 015: task_events table — Kanban-to-Anamnesis event buffer

CREATE TABLE IF NOT EXISTS task_events (
  id                        TEXT PRIMARY KEY,
  task_id                   TEXT NOT NULL REFERENCES tasks(id),
  event_type                TEXT NOT NULL,
  from_status               TEXT,
  to_status                 TEXT NOT NULL,
  agent_id                  TEXT,
  payload_json              TEXT NOT NULL,
  created_at                TEXT NOT NULL,
  synced_to_anamnesis       INTEGER DEFAULT 0,
  enriched_from_anamnesis   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_task_events_unsynced ON task_events(synced_to_anamnesis) WHERE synced_to_anamnesis = 0;
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, created_at DESC);
