-- Add encrypted anamnesis auth secret to settings table
ALTER TABLE settings ADD COLUMN anamnesis_auth_secret BLOB;
