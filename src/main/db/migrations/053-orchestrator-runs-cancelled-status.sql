-- SQLite cannot ALTER CHECK constraints directly. Recreate the table with the
-- corrected constraint that includes 'cancelled' as a valid status value.
-- The scheduler cancel() method sets status='cancelled' which the original
-- CHECK constraint did not allow.

CREATE TABLE orchestrator_runs_new (
  id                TEXT PRIMARY KEY,
  sprint_name       TEXT NOT NULL,
  project_id        TEXT,
  repo_id           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'idle'
                    CHECK(status IN ('idle','running','paused','completed','failed','cancelled')),
  concurrency_cap   INTEGER NOT NULL DEFAULT 3,
  telegram_notify   INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  started_at        TEXT,
  completed_at      TEXT,
  single_task_id    TEXT,
  started_by        TEXT,
  trigger_source    TEXT CHECK(trigger_source IS NULL OR trigger_source IN ('manual','date-watcher','sprint-watcher','single-task')),
  task_ids_json     TEXT,
  agents_spawned    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

INSERT INTO orchestrator_runs_new
  SELECT id, sprint_name, project_id, repo_id, status, concurrency_cap,
         telegram_notify, created_at, updated_at, started_at, completed_at,
         single_task_id, started_by, trigger_source, task_ids_json, agents_spawned
  FROM orchestrator_runs;

DROP TABLE orchestrator_runs;
ALTER TABLE orchestrator_runs_new RENAME TO orchestrator_runs;

CREATE INDEX idx_orchestrator_runs_status ON orchestrator_runs(status);
CREATE INDEX idx_orchestrator_runs_repo ON orchestrator_runs(repo_id);
