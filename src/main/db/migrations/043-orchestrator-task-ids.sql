-- Migration 043: Orchestrator run task IDs (sprint-scoped selection)
-- Persists the explicit task ID list for a run so batch dispatch is scoped
-- to a specific set of tasks rather than the whole repo.

ALTER TABLE orchestrator_runs ADD COLUMN task_ids_json TEXT;
