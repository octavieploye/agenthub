-- Migration 019: Add optional path column to projects
-- path is used by dispatch modal (Mode B) to resolve cwd for spawned agents
ALTER TABLE projects ADD COLUMN path TEXT;
