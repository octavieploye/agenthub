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

it('flush POSTs to /memory/episodic for CARD_TRANSITION events with correct Anamnesis payload', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload: { taskTitle: 'Test Task', repoId }
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:9300/memory/episodic')
  expect(opts.method).toBe('POST')
  expect(opts.headers['X-Optimaeus-Caller']).toBe('hephaestus')

  const body = JSON.parse(opts.body)
  expect(body.source_entity).toBe('hephaestus')
  expect(body.sovereignty_tier).toBe(1)
  expect(body.content.event_type).toBe('card_transition')
  expect(body.content.task_id).toBe(task.id)
  expect(body.content.from_status).toBe('backlog')
  expect(body.content.to_status).toBe('today')
  expect(body.content.taskTitle).toBe('Test Task')
})

it('flush POSTs to /memory/procedural for CARD_COMPLETED events with correct Anamnesis payload', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_COMPLETED',
    fromStatus: 'in_progress',
    toStatus: 'completed',
    agentId: 'agent-1',
    payload: { taskTitle: 'Completed Task', repoId }
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:9300/memory/procedural')

  const body = JSON.parse(opts.body)
  expect(body.source_entity).toBe('hephaestus')
  expect(body.pattern_type).toBe('build_sequence')
  expect(body.domain).toBe('task_completion')
  expect(body.content.event_type).toBe('card_completed')
  expect(body.content.task_id).toBe(task.id)
  expect(body.content.agent_id).toBe('agent-1')
  expect(body.confirmed_at).toBeDefined()
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

// ---------------------------------------------------------------------------
// R7-C-1: Orchestrator event payload tests
// ---------------------------------------------------------------------------

it('flush POSTs EpisodicWrite for ORCHESTRATOR_TASK_STARTED with correct fields', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'Auth module', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'ORCHESTRATOR_TASK_STARTED',
    fromStatus: 'backlog',
    toStatus: 'in_progress',
    agentId: 'agent-dev-1',
    payload: { phase: 'dev', model_selected: 'claude-sonnet-4-5-20250514' }
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:9300/memory/episodic')
  const body = JSON.parse(opts.body)
  expect(body.source_entity).toBe('hephaestus')
  expect(body.sovereignty_tier).toBe(1)
  expect(body.content.event_type).toBe('orchestrator_task_started')
  expect(body.content.phase).toBe('dev')
  expect(body.content.model_selected).toBe('claude-sonnet-4-5-20250514')
})

it('flush POSTs ProceduralWrite for ORCHESTRATOR_TASK_REVIEWED with code_review pattern', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'Auth module', status: 'in_progress' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'ORCHESTRATOR_TASK_REVIEWED',
    fromStatus: 'in_progress',
    toStatus: 'in_progress',
    agentId: 'agent-review-1',
    payload: { issues: [{ severity: 'medium', description: 'Missing null guard' }] }
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:9300/memory/procedural')
  const body = JSON.parse(opts.body)
  expect(body.pattern_type).toBe('code_review')
  expect(body.domain).toBe('quality_assurance')
  expect(body.content.issues).toBeDefined()
})

it('flush POSTs ProceduralWrite for ORCHESTRATOR_TASK_SECURED with security_scan pattern', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'Auth module', status: 'in_progress' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'ORCHESTRATOR_TASK_SECURED',
    fromStatus: 'in_progress',
    toStatus: 'in_progress',
    agentId: 'agent-sec-1',
    payload: { findings: [], scan_type: 'sec-devops' }
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.pattern_type).toBe('security_scan')
  expect(body.domain).toBe('security_audit')
})

it('flush POSTs ProceduralWrite for ORCHESTRATOR_TASK_COMMITTED with orchestrator_execution pattern', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'Auth module', status: 'in_progress' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'ORCHESTRATOR_TASK_COMMITTED',
    fromStatus: 'in_progress',
    toStatus: 'tested',
    agentId: null,
    payload: { taskId: task.id, taskTitle: 'Auth module', phases: [], issues: [], debtFlags: [] }
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.pattern_type).toBe('orchestrator_execution')
  expect(body.domain).toBe('sprint_execution')
})

it('flush POSTs EpisodicWrite for ORCHESTRATOR_SPRINT_COMPLETED', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'Sprint task', status: 'in_progress' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'ORCHESTRATOR_SPRINT_COMPLETED',
    fromStatus: 'in_progress',
    toStatus: 'completed',
    agentId: null,
    payload: { sprintName: 'R7-A', totalTasks: 10, completedTasks: 10 }
  })

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  const [url] = fetchMock.mock.calls[0]
  expect(url).toBe('http://localhost:9300/memory/episodic')
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.sovereignty_tier).toBe(1)
  expect(body.content.event_type).toBe('orchestrator_sprint_completed')
  expect(body.content.sprintName).toBe('R7-A')
})

it('all orchestrator event types are mapped in ENDPOINT_MAP', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })

  const orchestratorEvents = [
    'ORCHESTRATOR_TASK_STARTED',
    'ORCHESTRATOR_TASK_REVIEWED',
    'ORCHESTRATOR_TASK_SECURED',
    'ORCHESTRATOR_TASK_COMMITTED',
    'ORCHESTRATOR_SPRINT_COMPLETED',
  ] as const

  for (const eventType of orchestratorEvents) {
    insertTaskEvent(db, {
      taskId: task.id,
      eventType,
      fromStatus: 'in_progress',
      toStatus: 'in_progress',
      agentId: null,
      payload: {}
    })
  }

  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: 'http://localhost:9300', fetch: fetchMock })

  await writer.flush()

  // All 5 orchestrator events should have been sent (no errors)
  expect(fetchMock).toHaveBeenCalledTimes(5)
})
