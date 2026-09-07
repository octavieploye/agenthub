-- Link agents to their app session for recovery grouping
ALTER TABLE agents ADD COLUMN session_id TEXT REFERENCES sessions(id);
