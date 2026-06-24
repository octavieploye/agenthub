-- Migration 020: Add ON DELETE CASCADE to task_events.task_id
-- SQLite cannot ALTER constraints, so we recreate the table.

CREATE TABLE task_events_new (
  id                        TEXT PRIMARY KEY,
  task_id                   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type                TEXT NOT NULL,
  from_status               TEXT,
  to_status                 TEXT NOT NULL,
  agent_id                  TEXT,
  payload_json              TEXT NOT NULL,
  created_at                TEXT NOT NULL,
  synced_to_anamnesis       INTEGER DEFAULT 0,
  enriched_from_anamnesis   INTEGER DEFAULT 0
);

INSERT INTO task_events_new SELECT * FROM task_events;

DROP TABLE task_events;

ALTER TABLE task_events_new RENAME TO task_events;

CREATE INDEX IF NOT EXISTS idx_task_events_unsynced ON task_events(synced_to_anamnesis) WHERE synced_to_anamnesis = 0;
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, created_at DESC);
