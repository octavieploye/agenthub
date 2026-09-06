-- Migration 047: Add files_changed_json to orchestrator_task_log
-- Stores the list of files reported by Path B-2 agents via the report_files_changed MCP tool.
-- Nullable — null means no files were reported (B-1 tasks or B-2 tasks with no code changes).
-- Replaces the FILES_CHANGED: PTY text protocol (prompt injection vector).
ALTER TABLE orchestrator_task_log ADD COLUMN files_changed_json TEXT;
