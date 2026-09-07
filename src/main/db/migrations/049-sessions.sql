-- App session tracking for crash detection and recovery grouping
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  last_heartbeat_at TEXT,
  close_reason TEXT NOT NULL DEFAULT 'unknown'
);
