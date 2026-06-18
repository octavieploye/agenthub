-- Migration 014: Kanban board support
-- Adds position, sbar_id, sprint_name, epic_name to tasks table

ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN sbar_id TEXT REFERENCES sbar_handoffs(id);
ALTER TABLE tasks ADD COLUMN sprint_name TEXT;
ALTER TABLE tasks ADD COLUMN epic_name TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(status, position ASC);
