-- Allow repos to be hidden from the spawn dialog without deleting them
-- (foreign key constraints prevent actual deletion when agents reference the repo)
ALTER TABLE repos ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
