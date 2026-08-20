-- Orchestrator runs — tracks sprint execution sessions
CREATE TABLE IF NOT EXISTS orchestrator_runs (
  id                TEXT PRIMARY KEY,
  sprint_name       TEXT NOT NULL,
  project_id        TEXT,
  repo_id           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'idle'
                    CHECK(status IN ('idle','running','paused','completed','failed')),
  concurrency_cap   INTEGER NOT NULL DEFAULT 3,
  telegram_notify   INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  started_at        TEXT,
  completed_at      TEXT,
  FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_status ON orchestrator_runs(status);
CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_repo ON orchestrator_runs(repo_id);
