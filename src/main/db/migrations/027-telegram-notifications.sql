CREATE TABLE IF NOT EXISTS telegram_notifications (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  repo TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegram_notifications_status ON telegram_notifications(status);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_agent ON telegram_notifications(agent_id);
