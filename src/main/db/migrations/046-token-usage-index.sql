-- Migration 046: Add skill_id index to token_usage for adaptive ceiling queries
CREATE INDEX IF NOT EXISTS idx_token_usage_skill ON token_usage(skill_id);
