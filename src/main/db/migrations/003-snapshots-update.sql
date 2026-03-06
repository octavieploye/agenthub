-- Add trigger column to snapshots table for categorizing snapshot events

ALTER TABLE snapshots ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'periodic';

-- Add SBAR handoffs table for interrupted agent recovery context
CREATE TABLE IF NOT EXISTS sbar_handoffs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  agent_name TEXT NOT NULL,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  situation TEXT NOT NULL,
  background TEXT NOT NULL,
  assessment TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sbar_handoffs_agent_id ON sbar_handoffs(agent_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at);
