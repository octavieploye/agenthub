-- Migration 007 may have been applied with empty content before the containers
-- table SQL was finalized, leaving the DB at version 8 without the table.
-- This migration ensures the containers table always exists.
CREATE TABLE IF NOT EXISTS containers (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL UNIQUE,
  container_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity TEXT NOT NULL DEFAULT (datetime('now')),
  config_json TEXT NOT NULL DEFAULT '{}'
);
