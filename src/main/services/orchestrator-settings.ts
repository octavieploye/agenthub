import type Database from 'better-sqlite3'

export const ORCHESTRATOR_ENABLED_KEY = 'orchestrator.enabled'

export const APPROVAL_WINDOW_MINUTES_KEY = 'orchestrator.approvalWindowMinutes'

/**
 * Returns true only when the persisted `orchestrator.enabled` setting is
 * explicitly set to the string 'true'. Defaults to false (orchestrator
 * neutralised) when the key is absent or holds any other value.
 */
export function isOrchestratorEnabled(db: Database.Database): boolean {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(ORCHESTRATOR_ENABLED_KEY) as
    | { value: string }
    | undefined
  return row?.value === 'true'
}

/**
 * Returns the approval expiry window in minutes. Reads the persisted
 * `orchestrator.approvalWindowMinutes` setting; parses it to a positive
 * integer. Falls back to 30 when the key is absent or the value is not a
 * positive integer. Never throws.
 */
export function getApprovalWindowMinutes(db: Database.Database): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(APPROVAL_WINDOW_MINUTES_KEY) as
    | { value: string }
    | undefined
  if (!row?.value) return 30
  const parsed = Number.parseInt(row.value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 30
  return parsed
}
