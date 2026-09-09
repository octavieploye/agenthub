import type Database from 'better-sqlite3'
import type {
  SelfAwarenessManifestQuota,
  SelfAwarenessManifestSafeguards,
} from '../../../shared/types/mcp-server.types'

function safeJsonParseArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? parsed
      : []
  } catch {
    return []
  }
}

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function isOrchestratorEnabled(db: Database.Database): boolean {
  return getSetting(db, 'orchestrator.enabled') === 'true'
}

export function getQuota(db: Database.Database): SelfAwarenessManifestQuota {
  const capRaw = getSetting(db, 'quota.sessionCap')
  const sessionCap = capRaw ? Number(capRaw) : NaN
  return {
    tokensThisSession: 0,
    sessionCap: Number.isFinite(sessionCap) && sessionCap > 0 ? sessionCap : 100_000,
  }
}

export function getSafeguards(db: Database.Database): SelfAwarenessManifestSafeguards {
  const enabled = isOrchestratorEnabled(db)
  const protectedPaths = safeJsonParseArray(getSetting(db, 'guardrails.protectedPaths'))
  const supervisedCategories = safeJsonParseArray(getSetting(db, 'guardrails.supervisedCategories'))

  return {
    killSwitchActive: !enabled,
    protectedPaths,
    supervisedCategories,
    requiresConfirmation: true,
  }
}
