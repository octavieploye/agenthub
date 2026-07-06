-- Migration 032: Add computed status columns to brain_entries
-- computed_status is auto-derived by the scanner (separate from manual `status`)
ALTER TABLE brain_entries ADD COLUMN computed_status TEXT NOT NULL DEFAULT 'remaining'
  CHECK(computed_status IN ('remaining','in_progress','done'));
ALTER TABLE brain_entries ADD COLUMN checklist_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE brain_entries ADD COLUMN checklist_done  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE brain_entries ADD COLUMN git_signal      INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_brain_entries_computed_status ON brain_entries(computed_status);
