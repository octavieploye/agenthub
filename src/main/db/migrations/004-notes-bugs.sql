-- Create bugs table (referenced by existing code but never created)
CREATE TABLE IF NOT EXISTS bugs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  error_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bugs_repo_id ON bugs(repo_id);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
CREATE INDEX IF NOT EXISTS idx_bugs_resolved ON bugs(resolved_at);

-- Create notes table for scratch/repo/global notes
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('scratch', 'repo', 'global')),
  agent_id TEXT,
  repo_path TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_agent ON notes(agent_id);
CREATE INDEX IF NOT EXISTS idx_notes_repo ON notes(repo_path);
