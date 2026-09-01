-- Migration 045: Token usage tracking table
-- Tracks estimated and actual token consumption per task/skill for budget enforcement

CREATE TABLE IF NOT EXISTS token_usage (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  skill_id TEXT,
  date TEXT NOT NULL,
  estimated_tokens INTEGER,
  actual_tokens INTEGER,
  model TEXT,
  provider TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(date);
