-- Migration 056: Multi-run concurrency groundwork (P1).
--
-- Three changes:
--   1. Add 'queued' as a valid orchestrator_runs.status. Multi-run needs a
--      state for "created but not yet started because another run is active".
--      SQLite cannot ALTER a CHECK constraint, so the table is rebuilt via the
--      new-table → copy → drop → rename pattern (same as 053).
--   2. Add orchestrator_runs.agent_lifetime_cap (INTEGER, default 50) — a
--      per-run lifetime cap on agents spawned, independent of the rate-limiter
--      window size and concurrencyCap.
--   3. Rebuild orchestrator_approvals with a CHECK on status, and add indexes
--      to support run-agnostic agent→run correlation (P2).
--
-- Each table rebuild is wrapped in its own BEGIN/COMMIT. The migration runner
-- runs with foreign_keys = OFF, which otherwise leaves a crash-unsafe DROP
-- TABLE window; the transaction closes that window so a mid-migration crash
-- rolls back atomically instead of leaving a half-dropped table.

BEGIN;

CREATE TABLE orchestrator_runs_new (
  id                 TEXT PRIMARY KEY,
  sprint_name        TEXT NOT NULL,
  project_id         TEXT,
  repo_id            TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'idle'
                     CHECK(status IN ('idle','queued','running','paused','completed','failed','cancelled')),
  concurrency_cap    INTEGER NOT NULL DEFAULT 3,
  telegram_notify    INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  started_at         TEXT,
  completed_at       TEXT,
  single_task_id     TEXT,
  started_by         TEXT,
  trigger_source     TEXT CHECK(trigger_source IS NULL OR trigger_source IN ('manual','date-watcher','sprint-watcher','single-task')),
  task_ids_json      TEXT,
  agents_spawned     INTEGER NOT NULL DEFAULT 0,
  agent_lifetime_cap INTEGER NOT NULL DEFAULT 50,
  FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

INSERT INTO orchestrator_runs_new
  SELECT id, sprint_name, project_id, repo_id, status, concurrency_cap,
         telegram_notify, created_at, updated_at, started_at, completed_at,
         single_task_id, started_by, trigger_source, task_ids_json,
         agents_spawned, 50
  FROM orchestrator_runs;

DROP TABLE orchestrator_runs;
ALTER TABLE orchestrator_runs_new RENAME TO orchestrator_runs;

CREATE INDEX idx_orchestrator_runs_status ON orchestrator_runs(status);
CREATE INDEX idx_orchestrator_runs_repo ON orchestrator_runs(repo_id);
CREATE INDEX idx_orchestrator_runs_repo_status ON orchestrator_runs(repo_id, status);

COMMIT;

BEGIN;

CREATE TABLE orchestrator_approvals_new (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','approved','denied','expired')),
  requested_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT NOT NULL,
  responded_at   TEXT,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(run_id, task_id)
);

INSERT INTO orchestrator_approvals_new
  SELECT id, run_id, task_id, status, requested_at, expires_at, responded_at, reminder_count
  FROM orchestrator_approvals;

DROP TABLE orchestrator_approvals;
ALTER TABLE orchestrator_approvals_new RENAME TO orchestrator_approvals;

CREATE INDEX idx_orchestrator_approvals_status ON orchestrator_approvals(status);

COMMIT;

BEGIN;
CREATE INDEX idx_orch_task_log_agent ON orchestrator_task_log(agent_id);
COMMIT;
