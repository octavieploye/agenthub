import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TelegramQueueProcessor } from './telegram-queue-processor'
import type { TelegramNotificationPayload } from '../../shared/types/telegram.types'
import { getQueued } from '../db/queries/telegram-notifications.queries'

function applyMigration(db: Database.Database): void {
  const sql = readFileSync(
    join(__dirname, '..', 'db', 'migrations', '027-telegram-notifications.sql'),
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

describe('TelegramQueueProcessor', () => {
  let db: Database.Database
  let notifySpy: ReturnType<typeof vi.fn>
  let processor: TelegramQueueProcessor

  beforeEach(() => {
    db = new Database(':memory:')
    applyMigration(db)
    notifySpy = vi.fn()
    processor = new TelegramQueueProcessor({
      db,
      notify: notifySpy,
      logInfo: vi.fn(),
      logError: vi.fn(),
    })
  })

  afterEach(() => {
    processor.stop()
    db.close()
  })

  it('enqueue writes to DB and calls notify immediately', () => {
    notifySpy.mockImplementation(() => {}) // success (no throw)
    const payload = makePayload()
    processor.enqueue(payload)
    expect(notifySpy).toHaveBeenCalledWith(payload)
    // row should be marked sent
    const queued = getQueued(db)
    expect(queued).toHaveLength(0)
  })

  it('enqueue marks row as queued when notify throws', () => {
    notifySpy.mockImplementation(() => { throw new Error('sidecar dead') })
    const payload = makePayload()
    processor.enqueue(payload)
    const queued = getQueued(db)
    expect(queued).toHaveLength(1)
    expect(queued[0].last_error).toBe('sidecar dead')
  })

  it('deduplicates same agent+type within 5 seconds', () => {
    notifySpy.mockImplementation(() => {})
    const payload = makePayload()
    processor.enqueue(payload)
    processor.enqueue(payload) // duplicate
    expect(notifySpy).toHaveBeenCalledTimes(1)
  })

  it('does not deduplicate different types', () => {
    notifySpy.mockImplementation(() => {})
    processor.enqueue(makePayload({ type: 'agent_message' }))
    processor.enqueue(makePayload({ type: 'completed' }))
    expect(notifySpy).toHaveBeenCalledTimes(2)
  })

  it('getStats returns correct counts', () => {
    notifySpy.mockImplementation(() => {})
    processor.enqueue(makePayload())
    notifySpy.mockImplementation(() => { throw new Error('fail') })
    processor.enqueue(makePayload({ type: 'completed' }))
    const stats = processor.getStats('agent-1')
    expect(stats.sent).toBe(1)
    expect(stats.queued).toBe(1)
  })

  it('getNotifications returns rows for agent', () => {
    notifySpy.mockImplementation(() => {})
    processor.enqueue(makePayload())
    const rows = processor.getNotifications('agent-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].agent_id).toBe('agent-1')
  })
})
