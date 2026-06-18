import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { insertTaskEvent, getUnsyncedEvents, markEventSynced, getEventsByTask } from './task-events.queries'
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
