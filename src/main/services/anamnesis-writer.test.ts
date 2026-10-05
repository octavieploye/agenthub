import { it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import Database from 'better-sqlite3'
import log from 'electron-log/main'
import { runMigrations } from '../db/migration-runner'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskEvent, getUnsyncedEvents } from '../db/queries/task-events.queries'
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

// ---------------------------------------------------------------------------
// C-T5f (RED): S87 — CARD_COMPLETED content sent to Anamnesis is built from an allowlist,
// even for events queued before the fix (raw SBAR copy with extra keys).
// ---------------------------------------------------------------------------

it('S87: CARD_COMPLETED content carries only allowlisted payload keys and a redacted SBAR', async () => {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'Legacy task', status: 'backlog', sprintName: 'sprint-c' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_COMPLETED',
    fromStatus: 'in_progress',
    toStatus: 'completed',
    agentId: 'agent-1',
    payload: {
      taskTitle: 'Legacy task',
      repoId,
      cwd: '/tmp/test-repo',
      rawOutput: 'export API_KEY=sk-live-123',
      sbar: {
        id: 'sbar-1',
        agentName: 'agent-1',
        situation: 'Agent "agent-1" was finished while working on: FULL PROMPT secret steps',
        background: 'Repository: r. Working directory: /tmp/test-repo/pkg. Model: m (anthropic)',
        assessment: 'Last known status: completed (high confidence). Last output: export API_KEY=sk-live-123 | done',
        recommendation: 'Task completed successfully.',
        createdAt: '2026-09-30T00:00:00.000Z'
      }
    }
  })

  const { fetchMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()

  const [, opts] = callsTo(fetchMock, '/memory/procedural')[0]
  const body = JSON.parse(opts.body as string) as { content: Record<string, unknown> & { sbar: Record<string, string> } }
  expect(Object.keys(body.content).sort()).toEqual(
    ['agent_id', 'event_type', 'from_status', 'repoId', 'sbar', 'sprintName', 'taskTitle', 'task_id', 'to_status']
  )
  expect(Object.keys(body.content.sbar).sort()).toEqual(
    ['assessment', 'background', 'createdAt', 'id', 'recommendation', 'situation']
  )
  expect(body.content.sbar.background).toContain('Working directory: pkg')
  const serialized = String(opts.body)
  expect(serialized).not.toContain('/tmp/test-repo')
  expect(serialized).not.toContain('sk-live-123')
  expect(serialized).not.toContain('FULL PROMPT')
})

// ── domain_category (additive): the legacy `domain` field is untouched, a new top-level
// `domain_category` carries one of the 7 shared categories. Top-level, not inside `content`:
// the CARD_COMPLETED content key list is pinned by the SBAR allowlist test above.

async function flushOneEvent(
  eventType: 'CARD_TRANSITION' | 'CARD_COMPLETED' | 'ORCHESTRATOR_TASK_SECURED',
  category: string | null
): Promise<{ body: Record<string, unknown>; content: Record<string, unknown> }> {
  const repoId = seedRepo()
  const task = insertTask(db, { repoId, title: 'Categorised task', status: 'in_progress', category })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType,
    fromStatus: 'in_progress',
    toStatus: 'completed',
    agentId: 'agent-1',
    payload: { taskTitle: 'Categorised task', repoId }
  })

  const { fetchMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })
  await writer.flush()

  const path = eventType === 'CARD_TRANSITION' ? '/memory/episodic' : '/memory/procedural'
  const calls = callsTo(fetchMock, path)
  expect(calls).toHaveLength(1)
  const body = JSON.parse(calls[0][1].body as string) as Record<string, unknown>
  return { body, content: body.content as Record<string, unknown> }
}

it('CARD_COMPLETED payload adds domain_category and keeps the legacy domain unchanged', async () => {
  const { body } = await flushOneEvent('CARD_COMPLETED', 'marketing')

  expect(body.domain_category).toBe('marketing')
  expect(body.domain).toBe('task_completion')
  expect(body.pattern_type).toBe('build_sequence')
})

it('domain_category maps a code-like task category (backend) to code', async () => {
  const { body } = await flushOneEvent('CARD_COMPLETED', 'backend')

  expect(body.domain_category).toBe('code')
})

it('domain_category maps a business task category to business', async () => {
  const { body } = await flushOneEvent('CARD_COMPLETED', 'business')

  expect(body.domain_category).toBe('business')
})

it('domain_category defaults to code when the task has no category', async () => {
  const { body } = await flushOneEvent('CARD_COMPLETED', null)

  expect(body.domain_category).toBe('code')
  expect(body.domain).toBe('task_completion')
})

it('domain_category defaults to code for an unrecognised free-form task category', async () => {
  const { body } = await flushOneEvent('CARD_COMPLETED', 'not-a-known-category')

  expect(body.domain_category).toBe('code')
})

it('ORCHESTRATOR_TASK_SECURED keeps domain security_audit and adds domain_category from the task category', async () => {
  const { body } = await flushOneEvent('ORCHESTRATOR_TASK_SECURED', 'business')

  expect(body.domain).toBe('security_audit')
  expect(body.pattern_type).toBe('security_scan')
  expect(body.domain_category).toBe('business')
})

it('episodic CARD_TRANSITION payload also carries domain_category', async () => {
  const { body } = await flushOneEvent('CARD_TRANSITION', 'marketing')

  expect(body.domain_category).toBe('marketing')
})

it('domain_category is never placed inside content (content key list is pinned by the SBAR allowlist)', async () => {
  const { content } = await flushOneEvent('CARD_COMPLETED', 'marketing')

  expect(content).not.toHaveProperty('domain_category')
})

it('every payload sent carries a domain_category that is one of the 7 shared categories', async () => {
  const { body } = await flushOneEvent('CARD_COMPLETED', 'research')

  expect(['code', 'business', 'marketing', 'strategy', 'client', 'legal', 'operations']).toContain(body.domain_category)
})

// ── S93: BRAIN_ENTRY_PUBLISHED payloads go through the writer allowlist ──

function insertBrainEvent(payload: Record<string, unknown>): void {
  insertTaskEvent(db, {
    taskId: null,
    eventType: 'BRAIN_ENTRY_PUBLISHED',
    fromStatus: null,
    toStatus: 'active',
    agentId: null,
    payload
  })
}

it('S93: BRAIN_ENTRY_PUBLISHED content drops non-allowlisted keys and absolute artifact paths (legacy queued events)', async () => {
  insertBrainEvent({
    entry_id: 'b1',
    repo_id: 'r1',
    repo_name: 'test-repo',
    type: 'plan',
    subject: 'Q4 plan',
    status: 'active',
    computed_status: null,
    artifact_path: '/Users/someone/private/plan.md',
    created_at: '2026-09-30T10:00:00.000Z',
    domain_category: 'strategy',
    pointer_path: '/Users/someone/private/brain/b1.md',
    stray_secret: 'sk-live-123'
  })

  const { fetchMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })
  await writer.flush()

  const calls = callsTo(fetchMock, '/memory/episodic')
  expect(calls).toHaveLength(1)
  const serialized = String(calls[0][1].body)
  expect(serialized).not.toContain('/Users/')
  expect(serialized).not.toContain('sk-live-123')
  expect(serialized).not.toContain('pointer_path')
  const body = JSON.parse(serialized) as { content: Record<string, unknown>; domain_category: string }
  expect(body.content.artifact_path).toBe('plan.md')
  expect(body.content.artifact_path_scope).toBe('basename')
  expect(body.content.entry_id).toBe('b1')
  expect(body.content.subject).toBe('Q4 plan')
  expect(body.domain_category).toBe('strategy')
})

it('S93: BRAIN_ENTRY_PUBLISHED keeps a repo-relative artifact path unchanged', async () => {
  insertBrainEvent({
    entry_id: 'b2',
    repo_name: 'test-repo',
    type: 'spec',
    subject: 'Auth spec',
    status: 'active',
    artifact_path: 'docs/auth.md',
    artifact_path_scope: 'repo_relative',
    domain_category: 'code'
  })

  const { fetchMock } = mockEndpoints()
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })
  await writer.flush()

  const body = JSON.parse(callsTo(fetchMock, '/memory/episodic')[0][1].body as string) as {
    content: Record<string, unknown>
  }
  expect(body.content.artifact_path).toBe('docs/auth.md')
  expect(body.content.artifact_path_scope).toBe('repo_relative')
})

// ── S94: the bearer secret is only sent to https or loopback-http Anamnesis URLs ──

async function flushOneEventAgainst(url: string, authSecret: string): Promise<Array<Record<string, string>>> {
  const repoId = seedRepoOnce()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'SPRINT_INTAKE',
    fromStatus: null,
    toStatus: 'backlog',
    agentId: null,
    payload: {}
  })
  const fetchMock = vi.fn<EndpointHandler>(async (input) =>
    String(input).endsWith('/projects') ? projectResponse() : response()
  )
  const writer = new AnamnesisWriter(db, { anamnesisUrl: url, fetch: fetchMock as typeof fetch, authSecret })
  await writer.flush()
  expect(fetchMock).toHaveBeenCalled()
  return fetchMock.mock.calls.map(([, init]) => headersOf(init))
}

it('S94: sends the bearer to an https Anamnesis URL', async () => {
  const headers = await flushOneEventAgainst('https://anamnesis.example.eu', 's3cret')
  for (const h of headers) expect(h['Authorization']).toBe('Bearer s3cret')
})

it('S94: sends the bearer to http on loopback hosts (localhost, 127.0.0.1, ::1)', async () => {
  for (const url of ['http://localhost:9300', 'http://127.0.0.1:9300', 'http://[::1]:9300']) {
    const headers = await flushOneEventAgainst(url, 's3cret')
    for (const h of headers) expect(h['Authorization']).toBe('Bearer s3cret')
  }
})

it('S94: sends no bearer to a plain-http non-loopback Anamnesis URL', async () => {
  const headers = await flushOneEventAgainst('http://anamnesis.attacker.test:9300', 's3cret')
  for (const h of headers) expect(h['Authorization']).toBeUndefined()
})

it('S94: sends no bearer when the URL only imitates loopback in its userinfo', async () => {
  const headers = await flushOneEventAgainst('http://localhost@attacker-two.test:9300', 's3cret')
  for (const h of headers) expect(h['Authorization']).toBeUndefined()
})

// ── S95: best-effort project-status PUT leaves an audit/reconcile record on failure ──

function statusPutHandler(putResult: () => Promise<Response>): EndpointMock {
  return vi.fn<EndpointHandler>(async (input, init) => {
    const url = String(input)
    if (url === `${ANAMNESIS_URL}/projects`) return projectResponse()
    if (url.startsWith(`${ANAMNESIS_URL}/memory/`)) return response()
    if (init?.method === 'PUT' && url.startsWith(`${ANAMNESIS_URL}/projects/${PROJECT_UUID}/status/`)) {
      return putResult()
    }
    throw new Error(`Unexpected Anamnesis URL: ${url}`)
  })
}

function insertCompletedEvent(title: string): { taskId: string; repoId: string } {
  const repoId = seedRepoOnce()
  const task = insertTask(db, { repoId, title, status: 'in_progress', category: 'backend' })
  insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_COMPLETED',
    fromStatus: 'in_progress',
    toStatus: 'completed',
    agentId: 'agent-1',
    payload: { taskTitle: title, repoId }
  })
  return { taskId: task.id, repoId }
}

function seedRepoOnce(): string {
  const existing = db.prepare('SELECT id FROM repos LIMIT 1').get() as { id: string } | undefined
  return existing?.id ?? seedRepo()
}

interface ReconcileRow {
  event_type: string
  entity_type: string
  entity_id: string
  repo_id: string | null
  details: string | null
}

function reconcileRows(): ReconcileRow[] {
  return db
    .prepare(`SELECT event_type, entity_type, entity_id, repo_id, details FROM activity_log WHERE event_type = 'anamnesis_status_unreconciled'`)
    .all() as ReconcileRow[]
}

it('S95: a rejected project-status PUT writes a reconcile record to activity_log and logs the status', async () => {
  const { taskId, repoId } = insertCompletedEvent('Finish feature')
  const fetchMock = statusPutHandler(async () => response(false, 503))
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()

  const rows = reconcileRows()
  expect(rows).toHaveLength(1)
  expect(rows[0].entity_type).toBe('task')
  expect(rows[0].entity_id).toBe(taskId)
  expect(rows[0].repo_id).toBe(repoId)
  const details = JSON.parse(rows[0].details ?? '{}') as Record<string, unknown>
  expect(details.projectId).toBe(PROJECT_UUID)
  expect(details.domainCategory).toBe('code')
  expect(details.state).toBe('done')
  expect(details.httpStatus).toBe(503)
})

it('S95: an unreachable project-status PUT records the error message in the reconcile record', async () => {
  insertCompletedEvent('Finish feature')
  const fetchMock = statusPutHandler(async () => {
    throw new Error('connect ECONNREFUSED')
  })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()

  const rows = reconcileRows()
  expect(rows).toHaveLength(1)
  const details = JSON.parse(rows[0].details ?? '{}') as Record<string, unknown>
  expect(details.error).toBe('connect ECONNREFUSED')
})

it('S103: a transport error whose message embeds a URL stores no URL in the reconcile record', async () => {
  insertCompletedEvent('Finish feature')
  const fetchMock = statusPutHandler(async () => {
    throw new TypeError(
      'Request cannot be constructed from a URL that includes credentials: http://user:s3cret@localhost:9300/projects'
    )
  })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()

  const rows = reconcileRows()
  expect(rows).toHaveLength(1)
  const details = JSON.parse(rows[0].details ?? '{}') as Record<string, unknown>
  const stored = String(details.error)
  expect(stored).not.toContain('http://')
  expect(stored).not.toContain('s3cret')
  expect(stored).not.toContain('@')
})

it.each([
  ['an uppercase scheme', 'Failed: HTTP://user:s3cret@anamnesis.internal:9300/projects'],
  ['a malformed scheme (undici parse error)', 'Failed to parse URL from http//user:s3cret@anamnesis.internal:9300/projects'],
  ['a scheme-less URL with userinfo', 'Failed to parse URL from user:s3cret@anamnesis.internal:9300/projects'],
  ['userinfo holding whitespace', 'Failed to parse URL from http://user:s3 cret@anamnesis.internal:9300/projects'],
  ['a scheme-less host:port', 'connect ECONNREFUSED anamnesis.internal:9300'],
])('S106: a transport error with %s stores no credential or host in the reconcile record', async (_label, message) => {
  insertCompletedEvent('Finish feature')
  const fetchMock = statusPutHandler(async () => {
    throw new TypeError(message)
  })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()

  const rows = reconcileRows()
  expect(rows).toHaveLength(1)
  const details = JSON.parse(rows[0].details ?? '{}') as Record<string, unknown>
  const stored = String(details.error)
  expect(stored).toContain('[redacted-url]')
  for (const leaked of ['s3', 'cret', 'user:', '@', 'anamnesis.internal', '9300']) {
    expect(stored).not.toContain(leaked)
  }
})

it('S95: a successful project-status PUT writes no reconcile record', async () => {
  insertCompletedEvent('Finish feature')
  const fetchMock = statusPutHandler(async () => response())
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()

  expect(reconcileRows()).toHaveLength(0)
})

it('S95: failing project-status PUTs never trip the circuit breaker and the event stays synced', async () => {
  for (const title of ['one', 'two', 'three']) insertCompletedEvent(title)
  const fetchMock = statusPutHandler(async () => response(false, 500))
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()
  expect(getUnsyncedEvents(db)).toHaveLength(0)
  expect(reconcileRows()).toHaveLength(3)

  insertCompletedEvent('four')
  await writer.flush()
  expect(getUnsyncedEvents(db)).toHaveLength(0)
  expect(reconcileRows()).toHaveLength(4)
})

// ── Z-P0-1: while the circuit is open there is always exactly one pending retry timer ──

const BACKOFF_MS = 60_000

function insertTransitionEvent(payload: Record<string, unknown> = {}): { eventId: string; taskId: string; repoId: string } {
  const repoId = seedRepoOnce()
  const task = insertTask(db, { repoId, title: 'T', status: 'backlog' })
  const event = insertTaskEvent(db, {
    taskId: task.id,
    eventType: 'CARD_TRANSITION',
    fromStatus: 'backlog',
    toStatus: 'today',
    agentId: null,
    payload
  })
  return { eventId: event.id, taskId: task.id, repoId }
}

/** A writer whose memory endpoint is unreachable, flushed until the circuit opens (3 failed sends). */
async function writerWithOpenCircuit(): Promise<{ writer: AnamnesisWriter; memoryMock: EndpointMock }> {
  const memoryMock = endpointMock().mockRejectedValue(new Error('Connection failed'))
  const { fetchMock } = mockEndpoints({ memory: memoryMock })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })
  await writer.flush()
  await writer.flush()
  await writer.flush()
  expect(memoryMock).toHaveBeenCalledTimes(3)
  return { writer, memoryMock }
}

it('Z-P0-1: a failed half-open retry arms the next retry 60 s later', async () => {
  vi.useFakeTimers()
  try {
    insertTransitionEvent()
    const { memoryMock } = await writerWithOpenCircuit()

    await vi.advanceTimersByTimeAsync(BACKOFF_MS + 1)
    expect(memoryMock).toHaveBeenCalledTimes(4)

    await vi.advanceTimersByTimeAsync(BACKOFF_MS + 1)
    expect(memoryMock).toHaveBeenCalledTimes(5)
    expect(getUnsyncedEvents(db)).toHaveLength(1)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
})

it('Z-P0-1: after several failed retries a later success delivers the event and closes the circuit', async () => {
  vi.useFakeTimers()
  try {
    insertTransitionEvent()
    const { writer, memoryMock } = await writerWithOpenCircuit()

    for (let retry = 1; retry <= 4; retry++) {
      await vi.advanceTimersByTimeAsync(BACKOFF_MS + 1)
      expect(memoryMock).toHaveBeenCalledTimes(3 + retry)
    }

    memoryMock.mockResolvedValue(response())
    await vi.advanceTimersByTimeAsync(BACKOFF_MS + 1)

    expect(memoryMock).toHaveBeenCalledTimes(8)
    expect(getUnsyncedEvents(db)).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)

    // Circuit closed: a new event is sent at once, without waiting for a back-off.
    insertTransitionEvent()
    writer.onEventInserted()
    await vi.advanceTimersByTimeAsync(0)
    expect(memoryMock).toHaveBeenCalledTimes(9)
    expect(getUnsyncedEvents(db)).toHaveLength(0)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
})

it('Z-P0-1: a long outage keeps exactly one pending timer and sends one event per back-off (no burst)', async () => {
  vi.useFakeTimers()
  try {
    for (let i = 0; i < 5; i++) insertTransitionEvent()
    const { writer, memoryMock } = await writerWithOpenCircuit()
    expect(vi.getTimerCount()).toBe(1)

    for (let retry = 1; retry <= 10; retry++) {
      await vi.advanceTimersByTimeAsync(BACKOFF_MS + 1)
      writer.onEventInserted()
      await vi.advanceTimersByTimeAsync(0)
      expect(memoryMock).toHaveBeenCalledTimes(3 + retry)
      expect(vi.getTimerCount()).toBe(1)
    }

    memoryMock.mockResolvedValue(response())
    await vi.advanceTimersByTimeAsync(BACKOFF_MS + 1)

    expect(memoryMock).toHaveBeenCalledTimes(13 + 5)
    expect(getUnsyncedEvents(db)).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
})

it('Z-P0-1: onEventInserted attempts a flush once the back-off has elapsed, without adding a timer', async () => {
  vi.useFakeTimers()
  try {
    insertTransitionEvent()
    const { writer, memoryMock } = await writerWithOpenCircuit()

    // Move the clock past the back-off without firing the retry timer.
    vi.setSystemTime(Date.now() + BACKOFF_MS + 1)
    writer.onEventInserted()
    await vi.advanceTimersByTimeAsync(0)

    expect(memoryMock).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(1)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
})

// ── Z-P0-2: an event Anamnesis rejects for good is marked rejected and never sent again ──

const PAYLOAD_MARKER = 'PAYLOAD-MARKER-XYZ'

interface RejectionRow {
  rejected_at: string | null
  rejection_status: number | null
  synced_to_anamnesis: number
}

function rejectionRow(eventId: string): RejectionRow {
  return db
    .prepare('SELECT rejected_at, rejection_status, synced_to_anamnesis FROM task_events WHERE id = ?')
    .get(eventId) as RejectionRow
}

function rejectedActivityRows(): ReconcileRow[] {
  return db
    .prepare(`SELECT event_type, entity_type, entity_id, repo_id, details FROM activity_log WHERE event_type = 'anamnesis_event_rejected'`)
    .all() as ReconcileRow[]
}

function writerAnswering(memoryMock: EndpointMock): { writer: AnamnesisWriter; fetchMock: EndpointMock } {
  const { fetchMock } = mockEndpoints({ memory: memoryMock })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })
  return { writer, fetchMock }
}

it.each([400, 413, 422])(
  'Z-P0-2: a %i marks the event rejected, keeps synced_to_anamnesis at 0 and never re-sends it',
  async (status) => {
    const { eventId } = insertTransitionEvent()
    const memoryMock = endpointMock().mockResolvedValue(response(false, status))
    const { writer } = writerAnswering(memoryMock)

    await writer.flush()

    const row = rejectionRow(eventId)
    expect(row.rejected_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(row.rejection_status).toBe(status)
    expect(row.synced_to_anamnesis).toBe(0)
    expect(getUnsyncedEvents(db)).toHaveLength(0)

    await writer.flush()
    expect(memoryMock).toHaveBeenCalledOnce()
    expect(db.prepare('SELECT COUNT(*) AS n FROM task_events').get()).toEqual({ n: 1 })
  }
)

it('Z-P0-2: three 422 events at the head do not block a good event and leave the circuit closed', async () => {
  const head = [insertTransitionEvent(), insertTransitionEvent(), insertTransitionEvent()]
  const good = insertTransitionEvent()
  db.prepare(`UPDATE task_events SET created_at = '2026-10-05T23:59:59.999Z' WHERE id = ?`).run(good.eventId)
  db.prepare(`UPDATE task_events SET created_at = '2026-10-05T00:00:00.000Z' WHERE id != ?`).run(good.eventId)
  const memoryMock = endpointMock()
    .mockResolvedValueOnce(response(false, 422))
    .mockResolvedValueOnce(response(false, 422))
    .mockResolvedValueOnce(response(false, 422))
    .mockResolvedValue(response())
  const { writer } = writerAnswering(memoryMock)

  await writer.flush()

  expect(memoryMock).toHaveBeenCalledTimes(4)
  for (const { eventId } of head) expect(rejectionRow(eventId).rejection_status).toBe(422)
  expect(rejectionRow(good.eventId)).toEqual({ rejected_at: null, rejection_status: null, synced_to_anamnesis: 1 })
  expect(getUnsyncedEvents(db)).toHaveLength(0)

  // Circuit still closed: the next flush sends a new event straight away.
  insertTransitionEvent()
  await writer.flush()
  expect(memoryMock).toHaveBeenCalledTimes(5)
  expect(getUnsyncedEvents(db)).toHaveLength(0)
})

it('Z-P0-2: a corrupt payload_json is rejected with a NULL status, not sent, and does not block later events', async () => {
  const warnSpy = vi.spyOn(log, 'warn')
  try {
    const corrupt = insertTransitionEvent()
    const good = insertTransitionEvent()
    db.prepare(`UPDATE task_events SET payload_json = ?, created_at = '2026-10-05T00:00:00.000Z' WHERE id = ?`).run(
      `{"taskTitle":"${PAYLOAD_MARKER}`,
      corrupt.eventId
    )
    const memoryMock = endpointMock().mockResolvedValue(response())
    const { writer } = writerAnswering(memoryMock)

    await writer.flush()

    expect(memoryMock).toHaveBeenCalledOnce()
    const row = rejectionRow(corrupt.eventId)
    expect(row.rejected_at).toBeTruthy()
    expect(row.rejection_status).toBeNull()
    expect(row.synced_to_anamnesis).toBe(0)
    expect(rejectionRow(good.eventId).synced_to_anamnesis).toBe(1)
    expect(getUnsyncedEvents(db)).toHaveLength(0)

    const rows = rejectedActivityRows()
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0].details ?? '{}')).toEqual({
      eventId: corrupt.eventId,
      eventType: 'CARD_TRANSITION',
      httpStatus: null
    })
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(PAYLOAD_MARKER)

    await writer.flush()
    expect(memoryMock).toHaveBeenCalledOnce()
    expect(rejectedActivityRows()).toHaveLength(1)
  } finally {
    warnSpy.mockRestore()
  }
})

it('Z-P0-2: three corrupt payloads never open the circuit', async () => {
  for (let i = 0; i < 3; i++) insertTransitionEvent()
  db.prepare(`UPDATE task_events SET payload_json = '{broken'`).run()
  const memoryMock = endpointMock().mockResolvedValue(response())
  const { writer } = writerAnswering(memoryMock)

  await writer.flush()
  expect(memoryMock).not.toHaveBeenCalled()

  insertTransitionEvent()
  await writer.flush()
  expect(memoryMock).toHaveBeenCalledOnce()
  expect(getUnsyncedEvents(db)).toHaveLength(0)
})

it.each([503, 429, 401, 403, 404, 408, 500])(
  'Z-P0-2: a %i leaves the event unsynced and NOT rejected',
  async (status) => {
    const { eventId } = insertTransitionEvent()
    const memoryMock = endpointMock().mockResolvedValue(response(false, status))
    const { writer } = writerAnswering(memoryMock)

    await writer.flush()

    expect(rejectionRow(eventId)).toEqual({ rejected_at: null, rejection_status: null, synced_to_anamnesis: 0 })
    expect(getUnsyncedEvents(db)).toHaveLength(1)
    expect(rejectedActivityRows()).toHaveLength(0)

    await writer.flush()
    expect(memoryMock).toHaveBeenCalledTimes(2)
  }
)

it('Z-P0-2: a network error leaves the event unsynced and NOT rejected', async () => {
  const { eventId } = insertTransitionEvent()
  const memoryMock = endpointMock().mockRejectedValue(new Error('connect ECONNREFUSED'))
  const { writer } = writerAnswering(memoryMock)

  await writer.flush()

  expect(rejectionRow(eventId)).toEqual({ rejected_at: null, rejection_status: null, synced_to_anamnesis: 0 })
  expect(getUnsyncedEvents(db)).toHaveLength(1)
  expect(rejectedActivityRows()).toHaveLength(0)
})

it('Z-P0-2: retryable answers still open the circuit after 3 failures (401 is not a rejection)', async () => {
  vi.useFakeTimers()
  try {
    for (let i = 0; i < 5; i++) insertTransitionEvent()
    const memoryMock = endpointMock().mockResolvedValue(response(false, 401))
    const { writer } = writerAnswering(memoryMock)

    await writer.flush()

    expect(memoryMock).toHaveBeenCalledTimes(3)
    expect(getUnsyncedEvents(db)).toHaveLength(5)
    expect(vi.getTimerCount()).toBe(1)
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
  }
})

it('Z-P0-2: each rejection writes one activity record and one warning, neither holding payload text', async () => {
  const warnSpy = vi.spyOn(log, 'warn')
  try {
    const { eventId, taskId, repoId } = insertTransitionEvent({ taskTitle: PAYLOAD_MARKER })
    const memoryMock = endpointMock().mockResolvedValue(response(false, 422))
    const { writer } = writerAnswering(memoryMock)

    await writer.flush()
    await writer.flush()

    const rows = rejectedActivityRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].entity_type).toBe('task')
    expect(rows[0].entity_id).toBe(taskId)
    expect(rows[0].repo_id).toBe(repoId)
    expect(JSON.parse(rows[0].details ?? '{}')).toEqual({ eventId, eventType: 'CARD_TRANSITION', httpStatus: 422 })
    expect(JSON.stringify(rows)).not.toContain(PAYLOAD_MARKER)

    const rejectionWarnings = warnSpy.mock.calls.filter((call) => JSON.stringify(call).includes(eventId))
    expect(rejectionWarnings).toHaveLength(1)
    expect(rejectionWarnings[0][1]).toEqual({ eventId, eventType: 'CARD_TRANSITION', status: 422 })
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(PAYLOAD_MARKER)
  } finally {
    warnSpy.mockRestore()
  }
})

it('Z-P0-2: a rejected event without a task uses the event id as the activity entity id', async () => {
  insertBrainEvent({ entry_id: 'b9', repo_name: 'test-repo', subject: PAYLOAD_MARKER })
  const [{ id: eventId }] = getUnsyncedEvents(db)
  const memoryMock = endpointMock().mockResolvedValue(response(false, 422))
  const { writer } = writerAnswering(memoryMock)

  await writer.flush()

  const rows = rejectedActivityRows()
  expect(rows).toHaveLength(1)
  expect(rows[0].entity_id).toBe(eventId)
  expect(rows[0].repo_id).toBeNull()
  expect(JSON.stringify(rows)).not.toContain(PAYLOAD_MARKER)
})

it('Z-P0-2: a rejected CARD_COMPLETED event makes no project-status PUT', async () => {
  insertCompletedEvent('Finish feature')
  const fetchMock = vi.fn<EndpointHandler>(async (input) => {
    const url = String(input)
    if (url === `${ANAMNESIS_URL}/projects`) return projectResponse()
    if (url.startsWith(`${ANAMNESIS_URL}/memory/`)) return response(false, 422)
    return response()
  })
  const writer = new AnamnesisWriter(db, { anamnesisUrl: ANAMNESIS_URL, fetch: fetchMock as typeof fetch })

  await writer.flush()

  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0)
  expect(rejectedActivityRows()).toHaveLength(1)
  expect(reconcileRows()).toHaveLength(0)
})
