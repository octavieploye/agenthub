CREATE TABLE IF NOT EXISTS telegram_allowlist (
  id TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL UNIQUE,
  chat_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  added_at TEXT NOT NULL,
  added_by TEXT NOT NULL DEFAULT 'first_run'
);

CREATE TABLE IF NOT EXISTS telegram_notification_prefs (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  notify_completed INTEGER NOT NULL DEFAULT 1,
  notify_failed INTEGER NOT NULL DEFAULT 1,
  notify_awaiting_approval INTEGER NOT NULL DEFAULT 1,
  notify_needs_input INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
