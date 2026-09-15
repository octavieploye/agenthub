-- Add a per-task "complex" flag. Complex tasks are the commit/push boundaries
-- in the orchestrator git-ops flow: the Telegram sidecar only renders commit
-- controls on a `format: completed` message when the underlying task is
-- flagged complex. Non-complex tasks complete without offering commit buttons.

ALTER TABLE tasks ADD COLUMN complex INTEGER NOT NULL DEFAULT 0;
