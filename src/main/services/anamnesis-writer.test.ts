import { it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import { insertRepo } from '../db/queries/repos.queries'
import { AnamnesisWriter } from './anamnesis-writer'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../db/migrations')
})

afterEach(() => {
  db.close()
})

function seedRepo(): string {
  const repo = insertRepo(db, { name: 'test-repo', path: '/tmp/test-repo' })
  return repo.id
}

it('flush marks events synced when Anamnesis responds 200', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
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
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
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
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
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
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
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
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
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
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
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

it('circuit opens after 3 failures and schedules recovery timer', async () => {
  vi.useFakeTimers()
  try {
    const repoId = seedRepo()
    const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
    insertTaskEvent(db, {
      taskId: task.id,
      eventType: 'CARD_TRANSITION',
      fromStatus: 'backlog',
      toStatus: 'today',
      agentId: null,
      payload: {}
    })

    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection failed'))
    const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

    await writer.flush()
    await writer.flush()
    await writer.flush()

    expect(fetchMock).toHaveBeenCalledTimes(3)

    fetchMock.mockResolvedValueOnce({ ok: true })

    await vi.advanceTimersByTimeAsync(60_000 + 1)

    expect(fetchMock).toHaveBeenCalledTimes(4)

    const { getUnsyncedEvents } = await import('../db/queries/task-events.queries')
    expect(getUnsyncedEvents(db)).toHaveLength(0)
  } finally {
    vi.useRealTimers()
  }
})

it('onEventInserted returns early when circuit is open', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload: {}
  })

  const fetchMock = vi.fn().mockRejectedValue(new Error('Connection failed'))
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()
  await writer.flush()
  await writer.flush()

  expect(fetchMock).toHaveBeenCalledTimes(3)

  writer.onEventInserted()

  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it('flush sends at most BATCH_SIZE (10) events per call', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
  for (let i = 0; i < 25; i++) {
    insertTaskEvent(db, {
      taskId: task.id,
      eventType: 'CARD_COMPLETED',
      fromStatus: 'in_progress',
      toStatus: 'completed',
      agentId: 'agent-1',
      payload: { taskTitle: `Task ${i}`, repoId }
    })
  }

  const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: 'http://localhost:9300',
    fetch: fetchMock
  })

  await writer.flush()
  expect(fetchMock).toHaveBeenCalledTimes(10)
})

it('flush schedules a second flush when more events remain', async () => {
  vi.useFakeTimers()
  try {
    const repoId = seedRepo()
    const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
    for (let i = 0; i < 15; i++) {
      insertTaskEvent(db, {
        taskId: task.id,
        eventType: 'CARD_COMPLETED',
        fromStatus: 'in_progress',
        toStatus: 'completed',
        agentId: 'agent-1',
        payload: { taskTitle: `Task ${i}`, repoId }
      })
    }

    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    const writer = new AnamnesisWriter(db, {
      anamnesisUrl: 'http://localhost:9300',
      fetch: fetchMock
    })

    await writer.flush()
    expect(fetchMock).toHaveBeenCalledTimes(10)

    // run the scheduled follow-up flush
    await vi.runAllTimersAsync()
    expect(fetchMock).toHaveBeenCalledTimes(15)
  } finally {
    vi.useRealTimers()
  }
})
