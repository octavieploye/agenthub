-- Migration 005: Add per-agent color column
ALTER TABLE agents ADD COLUMN color TEXT NOT NULL DEFAULT '#3B82F6';
