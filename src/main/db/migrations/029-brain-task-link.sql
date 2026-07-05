-- Migration 029: Link tasks to brain entries
-- This adds a foreign key from tasks to brain_entries for tracking

ALTER TABLE tasks ADD COLUMN brain_entry_id TEXT REFERENCES brain_entries(id) ON DELETE SET NULL;

-- Create index for performance on brain entry lookups
CREATE INDEX idx_tasks_brain_entry ON tasks(brain_entry_id);