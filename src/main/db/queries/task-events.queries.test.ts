import { it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { runMigrations } from '../migration-runner'
import {
  insertTaskEvent,
  getUnsyncedEvents,
  markEventSynced,
  markEventRejected,
  getEventsByTask
} from './task-events.queries'
import { insertTask } from './tasks.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => {
  db.close()
})

it('insertTaskEvent stores and returns event', () => {
  const task = insertTask(db, { repoId: 'r1', title: 'Task', status: 'backlog' })
  const event = insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload: { taskTitle: 'Task', repoId: 'r1' }
  })
  expect(event.id).toBeTruthy()
  expect(event.syncedToAnamnesis).toBe(0)
  expect(event.eventType).toBe('CARD_TRANSITION')
  expect(event.toStatus).toBe('today')
})

it('getUnsyncedEvents returns only unsynced rows', () => {
  const task = insertTask(db, { repoId: 'r1', title: 'Task', status: 'backlog' })
  const e1 = insertTaskEvent(db, { taskId: task.id, eventType: 'CARD_TRANSITION', fromStatus: 'backlog', toStatus: 'today', agentId: null, payload: {} })
  insertTaskEvent(db, { taskId: task.id, eventType: 'CARD_TRANSITION', fromStatus: 'today', toStatus: 'in_progress', agentId: null, payload: {} })
  markEventSynced(db, e1.id)
  const unsynced = getUnsyncedEvents(db)
  expect(unsynced).toHaveLength(1)
  expect(unsynced[0].toStatus).toBe('in_progress')
})

it('getEventsByTask returns all events for a task in order', () => {
  const task = insertTask(db, { repoId: 'r1', title: 'Task', status: 'backlog' })
  insertTaskEvent(db, { taskId: task.id, eventType: 'CARD_TRANSITION', fromStatus: 'backlog', toStatus: 'today', agentId: null, payload: {} })
  insertTaskEvent(db, { taskId: task.id, eventType: 'CARD_COMPLETED', fromStatus: 'in_progress', toStatus: 'completed', agentId: 'agent-1', payload: {} })
  const events = getEventsByTask(db, task.id)
  expect(events).toHaveLength(2)
  expect(events[0].toStatus).toBe('today')
  expect(events[1].eventType).toBe('CARD_COMPLETED')
})

// ── Z-P0-2: permanently rejected events stay in the table but leave the outbox ──

interface RejectionRow {
  rejected_at: string | null
  rejection_status: number | null
  synced_to_anamnesis: number
}

function rejectionRow(id: string): RejectionRow {
  return db
    .prepare('SELECT rejected_at, rejection_status, synced_to_anamnesis FROM task_events WHERE id = ?')
    .get(id) as RejectionRow
}

it('Z-P0-2: markEventRejected stores rejected_at and the HTTP status and leaves synced_to_anamnesis at 0', () => {
  const task = insertTask(db, { repoId: 'r1', title: 'Task', status: 'backlog' })
  const event = insertTaskEvent(db, { taskId: task.id, eventType: 'CARD_TRANSITION', fromStatus: 'backlog', toStatus: 'today', agentId: null, payload: {} })

  markEventRejected(db, event.id, 422)

  const row = rejectionRow(event.id)
  expect(row.rejected_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  expect(row.rejection_status).toBe(422)
  expect(row.synced_to_anamnesis).toBe(0)
})

it('Z-P0-2: markEventRejected stores a NULL status for a corrupt payload', () => {
  const event = insertTaskEvent(db, { taskId: null, eventType: 'BRAIN_ENTRY_PUBLISHED', fromStatus: null, toStatus: 'active', agentId: null, payload: {} })

  markEventRejected(db, event.id, null)

  const row = rejectionRow(event.id)
  expect(row.rejected_at).toBeTruthy()
  expect(row.rejection_status).toBeNull()
})

it('Z-P0-2: getUnsyncedEvents excludes rejected rows and keeps them in the table', () => {
  const task = insertTask(db, { repoId: 'r1', title: 'Task', status: 'backlog' })
  const rejected = insertTaskEvent(db, { taskId: task.id, eventType: 'CARD_TRANSITION', fromStatus: 'backlog', toStatus: 'today', agentId: null, payload: {} })
  insertTaskEvent(db, { taskId: task.id, eventType: 'CARD_TRANSITION', fromStatus: 'today', toStatus: 'in_progress', agentId: null, payload: {} })

  markEventRejected(db, rejected.id, 422)

  const unsynced = getUnsyncedEvents(db)
  expect(unsynced).toHaveLength(1)
  expect(unsynced[0].toStatus).toBe('in_progress')
  expect(getEventsByTask(db, task.id)).toHaveLength(2)
})

it('Z-P0-2: a new event is neither rejected nor given a rejection status', () => {
  const event = insertTaskEvent(db, { taskId: null, eventType: 'BRAIN_ENTRY_PUBLISHED', fromStatus: null, toStatus: 'active', agentId: null, payload: {} })

  expect(rejectionRow(event.id)).toEqual({ rejected_at: null, rejection_status: null, synced_to_anamnesis: 0 })
})

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')
const LEGACY_COLUMNS =
  'id, task_id, event_type, from_status, to_status, agent_id, payload_json, created_at, synced_to_anamnesis, enriched_from_anamnesis'

/** Build a database at schema version 57 by applying every migration up to and including 057. */
function openDbAtVersion57(): Database.Database {
  const legacy = new Database(':memory:')
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    if (parseInt(file, 10) > 57) continue
    legacy.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'))
  }
  legacy.pragma('user_version = 57')
  return legacy
}

it('Z-P0-2: migration 058 applies on a version-57 database and leaves existing rows untouched', () => {
  const legacy = openDbAtVersion57()
  try {
    const insert = legacy.prepare(
      `INSERT INTO task_events (${LEGACY_COLUMNS}) VALUES (?, NULL, ?, NULL, 'active', NULL, ?, ?, ?, 0)`
    )
    insert.run('e-synced', 'BRAIN_ENTRY_PUBLISHED', '{"entry_id":"b1"}', '2026-10-01T10:00:00.000Z', 1)
    insert.run('e-unsynced', 'BRAIN_ENTRY_PUBLISHED', '{"entry_id":"b2"}', '2026-10-02T10:00:00.000Z', 0)
    const selectLegacy = `SELECT ${LEGACY_COLUMNS} FROM task_events ORDER BY id`
    const before = legacy.prepare(selectLegacy).all()
    expect(before).toHaveLength(2)

    runMigrations(legacy, MIGRATIONS_DIR)

    expect(legacy.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(58)
    expect(legacy.prepare(selectLegacy).all()).toEqual(before)
    const added = legacy.prepare('SELECT rejected_at, rejection_status FROM task_events').all()
    expect(added).toEqual([
      { rejected_at: null, rejection_status: null },
      { rejected_at: null, rejection_status: null }
    ])
    expect(getUnsyncedEvents(legacy).map((e) => e.id)).toEqual(['e-unsynced'])
  } finally {
    legacy.close()
  }
})
