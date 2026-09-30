// @vitest-environment node
// C-T1 (RED): contract for helpers/task-status-events.ts (implemented in C-T3).
//
// Contract under test:
//   emitTaskStatusEvent(db, { taskId, fromStatus, toStatus, agentId?, eventType?, payload? }): TaskEvent | null
//   - eventType defaults to 'CARD_TRANSITION'; ORCHESTRATOR_* and SPRINT_INTAKE are accepted as-is
//   - payload always carries taskTitle + repoId, merged with the caller's payload
//   - CARD_TRANSITION with fromStatus === toStatus is a no-op (returns null, no row)
//   - unknown task id returns null (no throw, no FK failure)
//   - every event type it inserts is delivered by AnamnesisWriter through ENDPOINT_MAP
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { getDb, closeDb, resetDb } from '../../db/connection'
import { insertRepo } from '../../db/queries/repos.queries'
import { insertTask } from '../../db/queries/tasks.queries'
import { getEventsByTask, getUnsyncedEvents } from '../../db/queries/task-events.queries'
import { AnamnesisWriter } from '../anamnesis-writer'
import { emitTaskStatusEvent } from './task-status-events'
import type { TaskEventType } from '../../../shared/types/task.types'

// Expected routing, mirrors anamnesis-writer.ts ENDPOINT_MAP (:8-19)
const EXPECTED_ENDPOINT: Array<[TaskEventType, string]> = [
  ['CARD_TRANSITION', '/memory/episodic'],
  ['SPRINT_INTAKE', '/memory/episodic'],
  ['ORCHESTRATOR_TASK_STARTED', '/memory/episodic'],
  ['ORCHESTRATOR_TASK_REVIEWED', '/memory/procedural'],
  ['ORCHESTRATOR_TASK_SECURED', '/memory/procedural'],
  ['ORCHESTRATOR_TASK_COMMITTED', '/memory/procedural'],
  ['ORCHESTRATOR_SPRINT_COMPLETED', '/memory/episodic'],
]

describe('emitTaskStatusEvent', () => {
  let db: Database.Database
  let repoId: string
  let taskId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    repoId = insertRepo(db, { name: 'repo-a', path: '/tmp/repo-a' }).id
    taskId = insertTask(db, { repoId, title: 'Wire status events', status: 'today' }).id
  })

  afterEach(() => {
    closeDb()
  })

  it('records a CARD_TRANSITION with from/to, agent and task context', () => {
    const event = emitTaskStatusEvent(db, {
      taskId,
      fromStatus: 'today',
      toStatus: 'in_progress',
      agentId: null,
      payload: { source: 'orchestrator' },
    })

    expect(event).not.toBeNull()
    const rows = getEventsByTask(db, taskId)
    expect(rows).toHaveLength(1)
    expect(rows[0].eventType).toBe('CARD_TRANSITION')
    expect(rows[0].fromStatus).toBe('today')
    expect(rows[0].toStatus).toBe('in_progress')
    expect(rows[0].syncedToAnamnesis).toBe(0)
    expect(JSON.parse(rows[0].payloadJson)).toMatchObject({
      taskTitle: 'Wire status events',
      repoId,
      source: 'orchestrator',
    })
  })

  it('is a no-op when from and to status are equal', () => {
    const event = emitTaskStatusEvent(db, { taskId, fromStatus: 'in_progress', toStatus: 'in_progress' })

    expect(event).toBeNull()
    expect(getEventsByTask(db, taskId)).toHaveLength(0)
  })

  it('returns null without throwing for an unknown task id', () => {
    expect(emitTaskStatusEvent(db, { taskId: 'missing', fromStatus: 'today', toStatus: 'in_progress' })).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM task_events').get()).toEqual({ n: 0 })
  })

  it.each(EXPECTED_ENDPOINT)('inserts %s with that exact event type', (eventType) => {
    const event = emitTaskStatusEvent(db, {
      taskId,
      eventType,
      fromStatus: 'today',
      toStatus: eventType === 'CARD_TRANSITION' ? 'in_progress' : 'today',
    })

    expect(event).not.toBeNull()
    expect(getEventsByTask(db, taskId).map((e) => e.eventType)).toEqual([eventType])
  })
})

describe('AnamnesisWriter delivery of helper-emitted events', () => {
  let db: Database.Database
  let taskId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    const repoId = insertRepo(db, { name: 'repo-a', path: '/tmp/repo-a' }).id
    taskId = insertTask(db, { repoId, title: 'Deliver me', status: 'today' }).id
  })

  afterEach(() => {
    closeDb()
  })

  it('maps every ORCHESTRATOR_*/SPRINT_INTAKE/CARD_TRANSITION event through ENDPOINT_MAP and marks it synced', async () => {
    for (const [eventType] of EXPECTED_ENDPOINT) {
      emitTaskStatusEvent(db, {
        taskId,
        eventType,
        fromStatus: 'today',
        toStatus: eventType === 'CARD_TRANSITION' ? 'in_progress' : 'today',
      })
    }
    expect(getUnsyncedEvents(db)).toHaveLength(EXPECTED_ENDPOINT.length)

    // External HTTP boundary only: Anamnesis is faked, the writer + DB are real.
    const posts: Array<{ path: string; eventType: string }> = []
    const fakeFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname === '/projects') {
        return new Response(JSON.stringify({ id: 'proj-uuid' }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body)) as { content: { event_type: string } }
      posts.push({ path: url.pathname, eventType: body.content.event_type })
      return new Response(JSON.stringify({ id: 'mem-1' }), { status: 200 })
    })
    const writer = new AnamnesisWriter(db, {
      anamnesisUrl: 'http://anamnesis.test',
      fetch: fakeFetch as unknown as typeof globalThis.fetch,
      authSecret: 'test-secret',
    })

    await writer.flush()

    for (const [eventType, path] of EXPECTED_ENDPOINT) {
      const hit = posts.find((p) => p.eventType === eventType.toLowerCase())
      expect(hit, `no POST for ${eventType}`).toBeDefined()
      expect(hit?.path).toBe(path)
    }
    expect(getUnsyncedEvents(db)).toHaveLength(0)
  })
})
