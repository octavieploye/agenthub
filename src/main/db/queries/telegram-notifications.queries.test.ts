// @vitest-environment node
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
  routeTelegramNotification,
  buildOrchestratorLifecyclePayload,
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

  it.each([
    ['task_launched', 'completed', '🚀 Task launched'],
    ['task_completed', 'completed', '✅ Task completed'],
    ['task_failed', 'failed', '❌ Task failed'],
    ['run_completed', 'completed', '🏁 Run completed'],
    ['run_failed', 'failed', '🚨 Run failed'],
    ['run_cancelled', 'completed', '⛔ Run cancelled'],
    ['run_heartbeat', 'completed', '💓 Heartbeat'],
  ] as const)('routes %s to a phone-friendly %s payload', (eventType, payloadType, label) => {
    const routed = routeTelegramNotification('Lifecycle details', eventType)

    expect(routed.type).toBe(payloadType)
    expect(routed.summary).toBe(`${label}\nLifecycle details`)
  })

  it('keeps routed lifecycle summaries within the payload limit', () => {
    const routed = routeTelegramNotification('x'.repeat(300), 'task_launched')

    expect(routed.summary).toHaveLength(200)
  })

  it('keeps run_heartbeat summaries within the payload limit', () => {
    const routed = routeTelegramNotification('x'.repeat(300), 'run_heartbeat')

    expect(routed.summary).toHaveLength(200)
  })
})

// ---------------------------------------------------------------------------
// buildOrchestratorLifecyclePayload — commit-boundary commitable logic (R9)
// ---------------------------------------------------------------------------

describe('buildOrchestratorLifecyclePayload', () => {
  const baseOpts = {
    msgKey: 'orchestrator:task_completed:my-task',
    agentName: 'Orchestrator',
    repoName: 'my-repo',
    repoPath: '/home/user/my-repo' as string | undefined,
    commitAgentId: 'agent-abc' as string | undefined,
    colorIndex: undefined as number | undefined,
  }

  it('complex task_completed with repoPath → commitable=true and commitAgentId set', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'My Task\nSprint: my-sprint',
      type: 'task_completed',
      isComplexTask: true,
    })
    expect(payload.commitable).toBe(true)
    expect(payload.commitAgentId).toBe('agent-abc')
    expect(payload.repoPath).toBe('/home/user/my-repo')
    expect(payload.type).toBe('completed')
  })

  it('non-complex task_completed → commitable=false, commitAgentId=undefined', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'Simple Task\nSprint: my-sprint',
      type: 'task_completed',
      isComplexTask: false,
    })
    expect(payload.commitable).toBe(false)
    expect(payload.commitAgentId).toBeUndefined()
  })

  it('run_completed with repoPath → commitable=true regardless of isComplexTask', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'my-sprint\n2 completed · 0 failed',
      type: 'run_completed',
      isComplexTask: false,
    })
    expect(payload.commitable).toBe(true)
    expect(payload.commitAgentId).toBe('agent-abc')
  })

  it('complex task_completed without repoPath → commitable=false', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'My Task\nSprint: my-sprint',
      type: 'task_completed',
      repoPath: undefined,
      isComplexTask: true,
    })
    expect(payload.commitable).toBe(false)
    expect(payload.commitAgentId).toBeUndefined()
  })

  it('task_launched → commitable=false even for complex tasks', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'My Task\nSprint: my-sprint',
      type: 'task_launched',
      isComplexTask: true,
    })
    expect(payload.commitable).toBe(false)
    expect(payload.commitAgentId).toBeUndefined()
  })

  it('run_failed → commitable=false', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'my-sprint\n0 completed · 1 failed',
      type: 'run_failed',
      isComplexTask: false,
    })
    expect(payload.commitable).toBe(false)
    expect(payload.commitAgentId).toBeUndefined()
  })

  it('run_cancelled with repoPath → commitable=false, no commit button', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'my-sprint\ncancelled — no dispatchable task was left',
      type: 'run_cancelled',
      isComplexTask: true,
    })
    expect(payload.type).toBe('completed')
    expect(payload.summary).toBe('⛔ Run cancelled\nmy-sprint\ncancelled — no dispatchable task was left')
    expect(payload.commitable).toBe(false)
    expect(payload.commitAgentId).toBeUndefined()
  })

  it('applies routeTelegramNotification label to summary', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      summary: 'My Task',
      type: 'task_completed',
      isComplexTask: true,
    })
    expect(payload.summary).toContain('✅ Task completed')
    expect(payload.summary).toContain('My Task')
  })

  it('msgKey is used as agentId (dedup key, not the real agent)', () => {
    const payload = buildOrchestratorLifecyclePayload({
      ...baseOpts,
      msgKey: 'orchestrator:task_completed:special-key',
      summary: 'My Task',
      type: 'task_completed',
      isComplexTask: true,
    })
    expect(payload.agentId).toBe('orchestrator:task_completed:special-key')
    // commitAgentId is the real agent, distinct from agentId
    expect(payload.commitAgentId).toBe('agent-abc')
  })
})
