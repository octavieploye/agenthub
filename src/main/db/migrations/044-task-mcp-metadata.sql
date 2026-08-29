-- Migration 044: MCP metadata fields for kanban server
-- Adds 8 columns to tasks table for MCP metadata support
-- All columns are nullable (no NOT NULL constraint)
-- No foreign key constraints

ALTER TABLE tasks ADD COLUMN target_files_json TEXT;
ALTER TABLE tasks ADD COLUMN skills_json TEXT;
ALTER TABLE tasks ADD COLUMN guardrail_json TEXT;
ALTER TABLE tasks ADD COLUMN risk_factors_json TEXT;
ALTER TABLE tasks ADD COLUMN estimated_tokens INTEGER;
ALTER TABLE tasks ADD COLUMN recommended_model TEXT;
ALTER TABLE tasks ADD COLUMN risk_score REAL;
ALTER TABLE tasks ADD COLUMN created_by TEXT;
