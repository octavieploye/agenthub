import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import {
  createSession,
  updateSessionHeartbeat,
  closeSession,
  detectPreviousSessionState,
  getSessionById,
  getRecentSessions
} from './sessions.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => { db.close() })

describe('sessions.queries', () => {
  describe('createSession', () => {
    it('creates a session and returns its id', () => {
      const id = createSession(db)
      expect(id).toBeTruthy()
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.close_reason).toBe('unknown')
      expect(row.started_at).toBeTruthy()
      expect(row.last_heartbeat_at).toBeTruthy()
      expect(row.ended_at).toBeNull()
    })
  })

  describe('updateSessionHeartbeat', () => {
    it('updates last_heartbeat_at', () => {
      const id = createSession(db)
      const before = db.prepare('SELECT last_heartbeat_at FROM sessions WHERE id = ?').get(id) as { last_heartbeat_at: string }

      // Small delay to ensure timestamp difference
      updateSessionHeartbeat(db, id)
      const after = db.prepare('SELECT last_heartbeat_at FROM sessions WHERE id = ?').get(id) as { last_heartbeat_at: string }
      expect(after.last_heartbeat_at).toBeTruthy()
      // Both should be valid ISO dates
      expect(new Date(before.last_heartbeat_at).getTime()).toBeLessThanOrEqual(new Date(after.last_heartbeat_at).getTime())
    })
  })

  describe('closeSession', () => {
    it('stamps ended_at and sets close_reason to clean', () => {
      const id = createSession(db)
      closeSession(db, id, 'clean')
      const row = db.prepare('SELECT ended_at, close_reason FROM sessions WHERE id = ?').get(id) as {
        ended_at: string
        close_reason: string
      }
      expect(row.ended_at).toBeTruthy()
      expect(row.close_reason).toBe('clean')
    })
  })

  describe('detectPreviousSessionState', () => {
    it('returns null when no sessions exist', () => {
      expect(detectPreviousSessionState(db)).toBeNull()
    })

    it('detects a cleanly closed session', () => {
      const id = createSession(db)
      closeSession(db, id, 'clean')
      const result = detectPreviousSessionState(db)
      expect(result).toEqual({ id, closeReason: 'clean' })
    })

    it('detects a crashed session (stale heartbeat, no ended_at)', () => {
      const id = createSession(db)
      // Simulate a stale heartbeat by writing a timestamp 2 minutes ago
      const staleTime = new Date(Date.now() - 120_000).toISOString()
      db.prepare('UPDATE sessions SET last_heartbeat_at = ?, close_reason = ? WHERE id = ?')
        .run(staleTime, 'unknown', id)

      const result = detectPreviousSessionState(db)
      expect(result).toEqual({ id, closeReason: 'crash' })

      // Verify the DB was updated
      const row = db.prepare('SELECT close_reason FROM sessions WHERE id = ?').get(id) as { close_reason: string }
      expect(row.close_reason).toBe('crash')
    })

    it('detects unknown when no heartbeat and no ended_at', () => {
      const id = createSession(db)
      // Remove heartbeat to simulate killed-before-first-heartbeat
      db.prepare('UPDATE sessions SET last_heartbeat_at = NULL, close_reason = ? WHERE id = ?')
        .run('unknown', id)

      const result = detectPreviousSessionState(db)
      expect(result).toEqual({ id, closeReason: 'unknown' })
    })

    it('returns already-resolved state without re-detecting', () => {
      const id = createSession(db)
      closeSession(db, id, 'clean')
      // Call twice — should return same result without re-evaluating
      const r1 = detectPreviousSessionState(db)
      const r2 = detectPreviousSessionState(db)
      expect(r1).toEqual(r2)
    })
  })

  describe('getSessionById', () => {
    it('returns session row when found', () => {
      const id = createSession(db)
      const row = getSessionById(db, id)
      expect(row).not.toBeNull()
      expect(row!.id).toBe(id)
    })

    it('returns null when not found', () => {
      expect(getSessionById(db, 'nonexistent')).toBeNull()
    })
  })

  describe('getRecentSessions', () => {
    it('returns sessions within the time window', () => {
      createSession(db)
      createSession(db)
      const sessions = getRecentSessions(db, 24)
      expect(sessions.length).toBe(2)
    })

    it('excludes sessions older than the window', () => {
      const id = createSession(db)
      // Backdate to 48h ago
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      db.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(old, id)

      const sessions = getRecentSessions(db, 24)
      expect(sessions.length).toBe(0)
    })
  })
})
