-- Migration 016: Project-scoped Kanban
-- Adds projects table, project_repos junction, and project_id/section_target_date to tasks and bugs

-- projects: groups repos under a named project
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- project_repos: junction — a project has many repos, a repo can belong to multiple projects
CREATE TABLE IF NOT EXISTS project_repos (
  project_id  TEXT NOT NULL REFERENCES projects(id),
  repo_id     TEXT NOT NULL REFERENCES repos(id),
  PRIMARY KEY (project_id, repo_id)
);

-- add project_id to tasks (nullable — tasks can exist without a project)
ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id);

-- add project_id to bugs (nullable)
ALTER TABLE bugs ADD COLUMN project_id TEXT REFERENCES projects(id);

-- add section_target_date to tasks (nullable, ISO 8601)
-- when epic_name is set AND section_target_date is set, UI renders as milestone
ALTER TABLE tasks ADD COLUMN section_target_date TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_bugs_project_id ON bugs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_repos_repo ON project_repos(repo_id);
