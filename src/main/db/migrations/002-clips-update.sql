-- Add description and default_repo_id to clips table, rename repo_id

ALTER TABLE clips ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE clips RENAME COLUMN repo_id TO default_repo_id;
