-- Migration 010: Add last_used_at column to repos table
ALTER TABLE repos ADD COLUMN last_used_at TEXT;
