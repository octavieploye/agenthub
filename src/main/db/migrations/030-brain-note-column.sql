-- Migration 030: Add note column to brain_entries table
-- This migration adds support for annotations on brain entries

ALTER TABLE brain_entries ADD COLUMN note TEXT;

-- Create index for note column to support searching/filtering
CREATE INDEX IF NOT EXISTS idx_brain_entries_note ON brain_entries(note);