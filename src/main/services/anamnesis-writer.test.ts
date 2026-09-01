import { it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import { insertRepo } from '../db/queries/repos.queries'
import { AnamnesisWriter } from './anamnesis-writer'

let db: Database.Database

const ANAMNESIS_URL = 'http://localhost:9300'
const PROJECT_UUID = '11111111-1111-4111-8111-111111111111'

type FetchInput = string | URL | Request
type EndpointHandler = (input: FetchInput, init?: RequestInit) => Promise<Response>
type EndpointMock = Mock<EndpointHandler>

function endpointMock(): EndpointMock {
  return vi.fn<EndpointHandler>()
}

function response(ok = true, status = 200): Response {
  return { ok, status } as Response
}

function projectResponse(projectId = PROJECT_UUID): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ id: projectId })
  } as Response
}

function mockEndpoints(
  options: {
    project?: EndpointMock
    memory?: EndpointMock
  } = {}
): {
  fetchMock: EndpointMock
  projectMock: EndpointMock
  memoryMock: EndpointMock
} {
  const projectMock = options.project ?? endpointMock().mockResolvedValue(projectResponse())
  const memoryMock = options.memory ?? endpointMock().mockResolvedValue(response())
  const fetchMock = vi.fn<EndpointHandler>(async (input, init) => {
    const url = String(input)
    if (url === `${ANAMNESIS_URL}/projects`) return projectMock(input, init)
    if (url.startsWith(`${ANAMNESIS_URL}/memory/`)) return memoryMock(input, init)
    throw new Error(`Unexpected Anamnesis URL: ${url}`)
  })

  return { fetchMock, projectMock, memoryMock }
}

function callsTo(fetchMock: EndpointMock, path: string): Array<[FetchInput, RequestInit]> {
  return fetchMock.mock.calls.filter(([url]) => String(url) === `${ANAMNESIS_URL}${path}`) as Array<
    [FetchInput, RequestInit]
  >
}

function headersOf(init?: RequestInit): Record<string, string> {
  return (init?.headers ?? {}) as Record<string, string>
}

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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
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

  const projectMock = endpointMock().mockRejectedValue(new Error('ECONNREFUSED'))
  const memoryMock = endpointMock().mockRejectedValue(new Error('ECONNREFUSED'))
  const { fetchMock } = mockEndpoints({ project: projectMock, memory: memoryMock })
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await expect(writer.flush()).resolves.not.toThrow()
  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/episodic')
  expect(memoryCalls).toHaveLength(1)
  const [url, opts] = memoryCalls[0]
  expect(url).toBe(`${ANAMNESIS_URL}/memory/episodic`)
  expect(opts.method).toBe('POST')
  expect(headersOf(opts)['X-Optimaeus-Caller']).toBe('hephaestus')

  const body = JSON.parse(opts.body as string)
  expect(body.source_entity).toBe('hephaestus')
  expect(body.sovereignty_tier).toBe(1)
  expect(body.content.event_type).toBe('card_transition')
  expect(body.content.task_id).toBe(task.id)
  expect(body.content.from_status).toBe('backlog')
  expect(body.content.to_status).toBe('today')
  expect(body.content.taskTitle).toBe('Test Task')
  expect(body.project_id).toBe(PROJECT_UUID)
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/procedural')
  expect(memoryCalls).toHaveLength(1)
  const [url, opts] = memoryCalls[0]
  expect(url).toBe(`${ANAMNESIS_URL}/memory/procedural`)

  const body = JSON.parse(opts.body as string)
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

  const { fetchMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch,
    authSecret: 'test-secret'
  })

  await writer.flush()

  expect(fetchMock).toHaveBeenCalledTimes(2)
  for (const [, opts] of fetchMock.mock.calls) {
    expect(headersOf(opts)['Authorization']).toBe('Bearer test-secret')
  }
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

  const projectMock = endpointMock().mockResolvedValue(projectResponse())
  const memoryMock = endpointMock().mockResolvedValue(response(false, 503))
  const { fetchMock } = mockEndpoints({ project: projectMock, memory: memoryMock })
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()

  const { getUnsyncedEvents } = await import('../db/queries/task-events.queries')
  expect(getUnsyncedEvents(db)).toHaveLength(1)
})

it('caches the project UUID across memory writes for the same repository', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
  for (const toStatus of ['today', 'in_progress'] as const) {
    insertTaskEvent(db, {
      taskId: task.id,
      eventType: 'CARD_TRANSITION',
      fromStatus: 'backlog',
      toStatus,
      agentId: null,
      payload: {}
    })
  }

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledTimes(2)
  for (const [, opts] of callsTo(fetchMock, '/memory/episodic')) {
    expect(JSON.parse(opts.body as string).project_id).toBe(PROJECT_UUID)
  }
})

it('falls back to an unscoped memory write when project registration fails', async () => {
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

  const projectMock = endpointMock().mockResolvedValue(response(false, 503))
  const memoryMock = endpointMock().mockResolvedValue(response())
  const { fetchMock } = mockEndpoints({ project: projectMock, memory: memoryMock })
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/episodic')
  expect(memoryCalls).toHaveLength(1)
  expect(JSON.parse(memoryCalls[0][1].body as string)).not.toHaveProperty('project_id')
  const { getUnsyncedEvents } = await import('../db/queries/task-events.queries')
  expect(getUnsyncedEvents(db)).toHaveLength(0)
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

    const projectMock = endpointMock().mockResolvedValue(projectResponse())
    const memoryMock = endpointMock().mockRejectedValue(new Error('Connection failed'))
    const { fetchMock } = mockEndpoints({ project: projectMock, memory: memoryMock })
    const writer = new AnamnesisWriter(db, {
      anamnesisUrl: ANAMNESIS_URL,
      fetch: fetchMock as typeof fetch
    })

    await writer.flush()
    await writer.flush()
    await writer.flush()

    expect(projectMock).toHaveBeenCalledOnce()
    expect(memoryMock).toHaveBeenCalledTimes(3)

    memoryMock.mockResolvedValueOnce(response())

    await vi.advanceTimersByTimeAsync(60_000 + 1)

    expect(projectMock).toHaveBeenCalledOnce()
    expect(memoryMock).toHaveBeenCalledTimes(4)

    const { getUnsyncedEvents } = await import('../db/queries/task-events.queries')
    expect(getUnsyncedEvents(db)).toHaveLength(0)
  } finally {
    vi.useRealTimers()
  }
})

it('onEventInserted returns early when circuit is open', async () => {
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

    const projectMock = endpointMock().mockResolvedValue(projectResponse())
    const memoryMock = endpointMock().mockRejectedValue(new Error('Connection failed'))
    const { fetchMock } = mockEndpoints({ project: projectMock, memory: memoryMock })
    const writer = new AnamnesisWriter(db, {
      anamnesisUrl: ANAMNESIS_URL,
      fetch: fetchMock as typeof fetch
    })

    await writer.flush()
    await writer.flush()
    await writer.flush()

    expect(projectMock).toHaveBeenCalledOnce()
    expect(memoryMock).toHaveBeenCalledTimes(3)

    writer.onEventInserted()

    expect(projectMock).toHaveBeenCalledOnce()
    expect(memoryMock).toHaveBeenCalledTimes(3)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
})

it('flush sends at most BATCH_SIZE (10) events per call', async () => {
  vi.useFakeTimers()
  try {
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

    const { fetchMock, projectMock, memoryMock } = mockEndpoints()
    const writer = new AnamnesisWriter(db, {
      anamnesisUrl: ANAMNESIS_URL,
      fetch: fetchMock as typeof fetch
    })

    await writer.flush()
    expect(projectMock).toHaveBeenCalledOnce()
    expect(memoryMock).toHaveBeenCalledTimes(10)
    expect(callsTo(fetchMock, '/memory/procedural')).toHaveLength(10)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
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

    const { fetchMock, projectMock, memoryMock } = mockEndpoints()
    const writer = new AnamnesisWriter(db, {
      anamnesisUrl: ANAMNESIS_URL,
      fetch: fetchMock as typeof fetch
    })

    await writer.flush()
    expect(projectMock).toHaveBeenCalledOnce()
    expect(memoryMock).toHaveBeenCalledTimes(10)

    // run the scheduled follow-up flush
    await vi.runAllTimersAsync()
    expect(projectMock).toHaveBeenCalledOnce()
    expect(memoryMock).toHaveBeenCalledTimes(15)
    expect(callsTo(fetchMock, '/memory/procedural')).toHaveLength(15)
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/episodic')
  expect(memoryCalls).toHaveLength(1)
  const [url, opts] = memoryCalls[0]
  expect(url).toBe(`${ANAMNESIS_URL}/memory/episodic`)
  const body = JSON.parse(opts.body as string)
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/procedural')
  expect(memoryCalls).toHaveLength(1)
  const [url, opts] = memoryCalls[0]
  expect(url).toBe(`${ANAMNESIS_URL}/memory/procedural`)
  const body = JSON.parse(opts.body as string)
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/procedural')
  expect(memoryCalls).toHaveLength(1)
  const body = JSON.parse(memoryCalls[0][1].body as string)
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/procedural')
  expect(memoryCalls).toHaveLength(1)
  const body = JSON.parse(memoryCalls[0][1].body as string)
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledOnce()
  const memoryCalls = callsTo(fetchMock, '/memory/episodic')
  expect(memoryCalls).toHaveLength(1)
  const [url, opts] = memoryCalls[0]
  expect(url).toBe(`${ANAMNESIS_URL}/memory/episodic`)
  const body = JSON.parse(opts.body as string)
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
    'ORCHESTRATOR_SPRINT_COMPLETED'
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

  const { fetchMock, projectMock, memoryMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, {
    anamnesisUrl: ANAMNESIS_URL,
    fetch: fetchMock as typeof fetch
  })

  await writer.flush()

  // Registration is cached; only memory calls count as event sends.
  expect(projectMock).toHaveBeenCalledOnce()
  expect(memoryMock).toHaveBeenCalledTimes(5)
  expect(callsTo(fetchMock, '/memory/episodic')).toHaveLength(2)
  expect(callsTo(fetchMock, '/memory/procedural')).toHaveLength(3)
})
