import type Database from 'better-sqlite3'

export const ORCHESTRATOR_ENABLED_KEY = 'orchestrator.enabled'

export const APPROVAL_WINDOW_MINUTES_KEY = 'orchestrator.approvalWindowMinutes'

export const MAX_CONCURRENT_RUNS_KEY = 'orchestrator.maxConcurrentRuns'

/** DB key for the heartbeat cadence in milliseconds. Default: 300 000 (5 min). */
export const HEARTBEAT_INTERVAL_MS_KEY = 'orchestrator.heartbeatIntervalMs'

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

/**
 * Returns the maximum number of orchestrator runs that may be active
 * simultaneously. Reads the persisted `orchestrator.maxConcurrentRuns`
 * setting; parses it to a positive integer. Falls back to 1 (sequential
 * mode) when the key is absent or the value is not a positive integer.
 * Never throws.
 */
export function getMaxConcurrentRuns(db: Database.Database): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(MAX_CONCURRENT_RUNS_KEY) as
    | { value: string }
    | undefined
  if (!row?.value) return 1
  const parsed = Number.parseInt(row.value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

/**
 * Returns the heartbeat cadence in milliseconds. Reads the persisted
 * `orchestrator.heartbeatIntervalMs` setting; parses it to a positive integer.
 * Falls back to 300 000 (5 minutes) when the key is absent or invalid.
 * Never throws.
 *
 * Configure via: INSERT OR REPLACE INTO settings VALUES ('orchestrator.heartbeatIntervalMs', '120000');
 * A ping delivery failure never fails or pauses the run.
 */
export function getHeartbeatIntervalMs(db: Database.Database): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(HEARTBEAT_INTERVAL_MS_KEY) as
    | { value: string }
    | undefined
  if (!row?.value) return 300_000
  const parsed = Number.parseInt(row.value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 300_000
  return parsed
}
