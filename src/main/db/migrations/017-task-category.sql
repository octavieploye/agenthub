-- Migration 017: Add category to tasks
-- Supports: backend, frontend, database, schema, functionality

ALTER TABLE tasks ADD COLUMN category TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
