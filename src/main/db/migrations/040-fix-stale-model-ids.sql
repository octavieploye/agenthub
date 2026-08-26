-- Fix stale Anthropic model IDs (retired by Anthropic, replaced with claude-*-4-6 format)
UPDATE agents SET model = 'claude-sonnet-4-6' WHERE model = 'claude-sonnet-4-20250514';
UPDATE agents SET model = 'claude-opus-4-6' WHERE model = 'claude-opus-4-20250514';
