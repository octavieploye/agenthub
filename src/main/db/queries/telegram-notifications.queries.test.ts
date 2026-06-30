import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  insertNotification,
  markSent,
  markFailed,
  markExpired,
  getQueued,
  getByAgent,
  getStats,
  isDuplicate,
} from './telegram-notifications.queries'
import type { TelegramNotificationPayload } from '../../../shared/types/telegram.types'

function applyMigration(db: Database.Database): void {
  const sql = readFileSync(
    join(__dirname, '..', 'migrations', '027-telegram-notifications.sql'),
    'utf-8'
  )
  db.exec(sql)
}

function makePayload(overrides?: Partial<TelegramNotificationPayload>): TelegramNotificationPayload {
  return {
    type: 'agent_message',
    agentId: 'agent-1',
    agentName: 'TestAgent',
    repo: 'test-repo',
    summary: 'test summary',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('telegram-notifications queries', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    applyMigration(db)
  })

  afterEach(() => {
    db.close()
  })

  it('inserts a notification and retrieves it by agent', () => {
    const payload = makePayload()
    insertNotification(db, payload)
    const rows = getByAgent(db, 'agent-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].agent_id).toBe('agent-1')
    expect(rows[0].status).toBe('queued')
    expect(rows[0].type).toBe('agent_message')
    expect(JSON.parse(rows[0].payload_json)).toEqual(payload)
  })

  it('markSent updates status and sets sent_at', () => {
    const payload = makePayload()
    insertNotification(db, payload)
    const row = getByAgent(db, 'agent-1')[0]
    markSent(db, row.id)
    const updated = getByAgent(db, 'agent-1')[0]
    expect(updated.status).toBe('sent')
    expect(updated.sent_at).not.toBeNull()
  })

  it('markFailed increments attempts and sets last_error', () => {
    const payload = makePayload()
    insertNotification(db, payload)
    const row = getByAgent(db, 'agent-1')[0]
    markFailed(db, row.id, 'socket timeout')
    const updated = getByAgent(db, 'agent-1')[0]
    expect(updated.status).toBe('queued')
    expect(updated.attempts).toBe(1)
    expect(updated.last_error).toBe('socket timeout')
  })

  it('markExpired sets status to expired', () => {
    const payload = makePayload()
    insertNotification(db, payload)
    const row = getByAgent(db, 'agent-1')[0]
    markExpired(db, row.id)
    const updated = getByAgent(db, 'agent-1')[0]
    expect(updated.status).toBe('expired')
  })

  it('getQueued returns only retryable rows', () => {
    const payload = makePayload()
    insertNotification(db, payload)

    // Second one already sent — should not appear
    const payload2 = makePayload({ agentId: 'agent-2' })
    insertNotification(db, payload2)
    const row2 = getByAgent(db, 'agent-2')[0]
    markSent(db, row2.id)

    const queued = getQueued(db)
    expect(queued).toHaveLength(1)
    expect(queued[0].agent_id).toBe('agent-1')
  })

  it('getQueued excludes rows with 5+ attempts', () => {
    const payload = makePayload()
    insertNotification(db, payload)
    const row = getByAgent(db, 'agent-1')[0]
    for (let i = 0; i < 5; i++) {
      markFailed(db, row.id, `fail ${i}`)
    }
    const queued = getQueued(db)
    expect(queued).toHaveLength(0)
  })

  it('getStats returns correct counts', () => {
    insertNotification(db, makePayload())
    insertNotification(db, makePayload({ type: 'completed' }))
    const rows = getByAgent(db, 'agent-1')
    markSent(db, rows[0].id)
    markFailed(db, rows[1].id, 'err')
    // markFailed keeps status as queued, so: 0 sent (wait, we marked first as sent)
    // Actually: first is sent, second is queued (failed but still retryable)
    const stats = getStats(db, 'agent-1')
    expect(stats.sent).toBe(1)
    expect(stats.queued).toBe(1)
    expect(stats.failed).toBe(0)
  })

  it('isDuplicate returns true for same agent+type within 5s', () => {
    insertNotification(db, makePayload())
    expect(isDuplicate(db, 'agent-1', 'agent_message')).toBe(true)
  })

  it('isDuplicate returns false for different type', () => {
    insertNotification(db, makePayload())
    expect(isDuplicate(db, 'agent-1', 'completed')).toBe(false)
  })

  it('getByAgent respects limit and orders newest first', () => {
    for (let i = 0; i < 5; i++) {
      insertNotification(db, makePayload({ type: `agent_message` }))
    }
    const rows = getByAgent(db, 'agent-1', 3)
    expect(rows).toHaveLength(3)
    // newest first
    expect(new Date(rows[0].created_at).getTime())
      .toBeGreaterThanOrEqual(new Date(rows[1].created_at).getTime())
  })
})
