-- Migration 042: Orchestrator audit trail (started_by + trigger_source)

ALTER TABLE orchestrator_runs ADD COLUMN started_by TEXT;
ALTER TABLE orchestrator_runs ADD COLUMN trigger_source TEXT CHECK(trigger_source IS NULL OR trigger_source IN ('manual','date-watcher','sprint-watcher','single-task'));
