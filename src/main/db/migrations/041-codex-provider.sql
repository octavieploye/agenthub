-- Migration 041: Add 'openai-codex' to tasks.provider_override CHECK constraint
-- SQLite cannot ALTER CHECK constraints, so we rebuild the table.

-- Step 1: Create new table with updated CHECK
CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'backlog',
  agent_id TEXT REFERENCES agents(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  position INTEGER DEFAULT 0,
  sbar_id TEXT REFERENCES sbar_handoffs(id),
  sprint_name TEXT,
  epic_name TEXT,
  project_id TEXT REFERENCES projects(id),
  section_target_date TEXT,
  category TEXT,
  note TEXT,
  brain_entry_id TEXT REFERENCES brain_entries(id) ON DELETE SET NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  model_override TEXT,
  provider_override TEXT CHECK(provider_override IS NULL OR provider_override IN ('anthropic','ollama-local','ollama-cloud','openai-codex')),
  date_trigger_fired_at TEXT
);

-- Step 2: Copy data
INSERT INTO tasks_new SELECT
  id, repo_id, title, description, priority, status, agent_id, created_at, updated_at,
  position, sbar_id, sprint_name, epic_name, project_id, section_target_date,
  category, note, brain_entry_id,
  requires_approval, model_override, provider_override, date_trigger_fired_at
FROM tasks;

-- Step 3: Drop old table
DROP TABLE tasks;

-- Step 4: Rename new table
ALTER TABLE tasks_new RENAME TO tasks;

-- Recreate indexes that existed on the original table
CREATE INDEX IF NOT EXISTS idx_tasks_repo_id ON tasks(repo_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(status, position ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_brain_entry ON tasks(brain_entry_id);
