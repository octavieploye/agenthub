-- Migration 058: Mark task_events that Anamnesis rejected for good.
--
-- A permanently rejected outbox event (HTTP 400/413/422, or a payload_json that
-- cannot be parsed) is never sent again but stays in the table. rejected_at is
-- the ISO 8601 time of the rejection; rejection_status is the HTTP status, NULL
-- for a corrupt payload. Additive only: two nullable columns, no table rebuild,
-- existing rows keep NULL in both. synced_to_anamnesis stays 0 for these rows.

BEGIN;

ALTER TABLE task_events ADD COLUMN rejected_at TEXT;
ALTER TABLE task_events ADD COLUMN rejection_status INTEGER;

COMMIT;
