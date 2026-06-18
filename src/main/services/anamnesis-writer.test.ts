import { it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import { AnamnesisWriter } from './anamnesis-writer'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
})

afterEach(() => {
  db.close()
})

it('flush marks events synced when Anamnesis responds 200', async () => {
  const task = insertTask(db, { repoId: 'r1', title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload: {}
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  expect(fetchMock).toHaveBeenCalledOnce()
  const { getUnsyncedEvents } = await import('../db/queries/task-events.queries')
  expect(getUnsyncedEvents(db)).toHaveLength(0)
})

it('flush does not throw when Anamnesis is unreachable', async () => {
  const task = insertTask(db, { repoId: 'r1', title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload: {}
  })

  const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await expect(writer.flush()).resolves.not.toThrow()
  const { getUnsyncedEvents } = await import('../db/queries/task-events.queries')
  expect(getUnsyncedEvents(db)).toHaveLength(1)
})

it('flush POSTs to /memory/episodic for CARD_TRANSITION events', async () => {
  const task = insertTask(db, { repoId: 'r1', title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload: {}
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:9300/memory/episodic')
  expect(opts.method).toBe('POST')
  expect(opts.headers['X-Optimaeus-Caller']).toBe('hephaestus')
})

it('flush POSTs to /memory/procedural for CARD_COMPLETED events', async () => {
  const task = insertTask(db, { repoId: 'r1', title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_COMPLETED',
    fromStatus: 'in_progress',
    toStatus: 'completed',
    agentId: 'agent-1',
    payload: {}
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const [url] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:9300/memory/procedural')
})

it('flush sends Authorization header when authSecret is provided', async () => {
  const task = insertTask(db, { repoId: 'r1', title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'SPRINT_INTAKE',
    fromStatus: null,
    toStatus: 'backlog',
    agentId: null,
    payload: {}
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: 'http://localhost:9300',
    fetch: fetchMock,
    authSecret: 'test-secret'
  })

  await writer.flush()

  const [, opts] = fetchMock.mock.calls[0]
  expect(opts.headers['Authorization']).toBe('Bearer test-secret')
})

it('flush skips marking synced when Anamnesis returns non-OK status', async () => {
  const task = insertTask(db, { repoId: 'r1', title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload: {}
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const { getUnsyncedEvents } = await import('../db/queries/task-events.queries')
  expect(getUnsyncedEvents(db)).toHaveLength(1)
})
