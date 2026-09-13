-- Persist orchestrator approval-gate state so the TTL supervisor (APS-4) can
-- re-notify / escalate deterministically across app restarts. Replaces the
-- in-memory pendingApproval Set in the scheduler with a durable row per
-- (run, task) approval request.
--
-- Timestamp convention: requested_at / expires_at / responded_at are stored in
-- SQLite datetime('now') format (UTC, second precision), NOT JS ISO strings.
-- This matches telegram-notifications.queries.ts and lets the supervisor query
-- `expires_at < datetime('now')` directly in SQL.

CREATE TABLE orchestrator_approvals (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  requested_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT NOT NULL,
  responded_at   TEXT,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(run_id, task_id)
);

CREATE INDEX idx_orchestrator_approvals_status ON orchestrator_approvals(status);
