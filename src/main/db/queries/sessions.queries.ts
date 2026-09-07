import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'

export type CloseReason = 'clean' | 'crash' | 'unknown'

export interface SessionRow {
  id: string
  started_at: string
  ended_at: string | null
  last_heartbeat_at: string | null
  close_reason: CloseReason
}

export function createSession(db: Database.Database): string {
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO sessions (id, started_at, last_heartbeat_at) VALUES (?, ?, ?)'
  ).run(id, now, now)
  log.info('Session created', { id })
  return id
}

export function updateSessionHeartbeat(db: Database.Database, sessionId: string): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE sessions SET last_heartbeat_at = ? WHERE id = ?').run(now, sessionId)
}

export function closeSession(db: Database.Database, sessionId: string, reason: CloseReason = 'clean'): void {
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE sessions SET ended_at = ?, close_reason = ? WHERE id = ?'
  ).run(now, reason, sessionId)
  log.info('Session closed', { sessionId, reason })
}

const STALE_HEARTBEAT_MS = 60_000

export function detectPreviousSessionState(
  db: Database.Database
): { id: string; closeReason: CloseReason } | null {
  const row = db.prepare(
    'SELECT id, ended_at, last_heartbeat_at, close_reason FROM sessions ORDER BY started_at DESC LIMIT 1'
  ).get() as Pick<SessionRow, 'id' | 'ended_at' | 'last_heartbeat_at' | 'close_reason'> | undefined

  if (!row) return null

  // Already resolved (e.g. clean close or previously detected crash)
  if (row.close_reason !== 'unknown') {
    return { id: row.id, closeReason: row.close_reason }
  }

  let closeReason: CloseReason

  if (row.ended_at) {
    closeReason = 'clean'
  } else if (row.last_heartbeat_at) {
    const heartbeatAge = Date.now() - new Date(row.last_heartbeat_at).getTime()
    closeReason = heartbeatAge > STALE_HEARTBEAT_MS ? 'crash' : 'unknown'
  } else {
    closeReason = 'unknown'
  }

  db.prepare('UPDATE sessions SET close_reason = ? WHERE id = ?').run(closeReason, row.id)
  log.info('Previous session state detected', { id: row.id, closeReason })
  return { id: row.id, closeReason }
}

export function getSessionById(db: Database.Database, sessionId: string): SessionRow | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined
  return row ?? null
}

export function getRecentSessions(db: Database.Database, hours: number): SessionRow[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  return db.prepare(
    'SELECT * FROM sessions WHERE started_at > ? ORDER BY started_at DESC'
  ).all(cutoff) as SessionRow[]
}
