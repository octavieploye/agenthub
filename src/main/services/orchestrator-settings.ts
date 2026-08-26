import type Database from 'better-sqlite3'

export const ORCHESTRATOR_ENABLED_KEY = 'orchestrator.enabled'

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
