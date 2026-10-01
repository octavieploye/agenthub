-- Migration 057: Make task_events.task_id nullable.
--
-- The task_events outbox now also carries BRAIN_ENTRY_PUBLISHED events, which
-- describe a brain entry, not a task. Those rows have task_id = NULL; the FK to
-- tasks (with ON DELETE CASCADE from 023) still applies to every non-NULL id.
-- SQLite cannot drop a NOT NULL constraint, so the table is rebuilt via the
-- new-table → copy → drop → rename pattern, wrapped in a transaction (see 056).

BEGIN;

CREATE TABLE task_events_new (
  id                        TEXT PRIMARY KEY,
  task_id                   TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  event_type                TEXT NOT NULL,
  from_status               TEXT,
  to_status                 TEXT NOT NULL,
  agent_id                  TEXT,
  payload_json              TEXT NOT NULL,
  created_at                TEXT NOT NULL,
  synced_to_anamnesis       INTEGER DEFAULT 0,
  enriched_from_anamnesis   INTEGER DEFAULT 0
);

INSERT INTO task_events_new
  SELECT id, task_id, event_type, from_status, to_status, agent_id,
         payload_json, created_at, synced_to_anamnesis, enriched_from_anamnesis
  FROM task_events;

DROP TABLE task_events;
ALTER TABLE task_events_new RENAME TO task_events;

CREATE INDEX IF NOT EXISTS idx_task_events_unsynced ON task_events(synced_to_anamnesis) WHERE synced_to_anamnesis = 0;
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, created_at DESC);

COMMIT;
