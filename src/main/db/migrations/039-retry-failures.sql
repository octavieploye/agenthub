CREATE TABLE IF NOT EXISTS retry_failures (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT,
  diagnostics TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_retry_failures_task ON retry_failures(task_id);
CREATE INDEX IF NOT EXISTS idx_retry_failures_ack ON retry_failures(acknowledged_at);
