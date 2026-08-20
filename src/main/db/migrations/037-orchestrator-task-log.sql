-- Orchestrator task log — tracks each task through dev→review→security→commit→push phases
CREATE TABLE IF NOT EXISTS orchestrator_task_log (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL,
  task_id           TEXT NOT NULL,
  phase             TEXT NOT NULL
                    CHECK(phase IN ('dev','review','security','commit','push')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','active','done','failed','skipped')),
  agent_id          TEXT,
  model_used        TEXT,
  provider_used     TEXT,
  summary_json      TEXT,
  issues_json       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  started_at        TEXT,
  completed_at      TEXT,
  FOREIGN KEY (run_id) REFERENCES orchestrator_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orch_task_log_run ON orchestrator_task_log(run_id);
CREATE INDEX IF NOT EXISTS idx_orch_task_log_task ON orchestrator_task_log(task_id);
CREATE INDEX IF NOT EXISTS idx_orch_task_log_phase ON orchestrator_task_log(phase);
