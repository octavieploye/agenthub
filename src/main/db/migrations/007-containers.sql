CREATE TABLE IF NOT EXISTS containers (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL UNIQUE,
  container_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity TEXT NOT NULL DEFAULT (datetime('now')),
  config_json TEXT NOT NULL DEFAULT '{}'
);
