-- Migration 038: Task scheduling fields + single-task orchestrator support

ALTER TABLE tasks ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN model_override TEXT;
ALTER TABLE tasks ADD COLUMN provider_override TEXT CHECK(provider_override IS NULL OR provider_override IN ('anthropic','ollama-local','ollama-cloud'));
ALTER TABLE tasks ADD COLUMN date_trigger_fired_at TEXT;

ALTER TABLE orchestrator_runs ADD COLUMN single_task_id TEXT;
