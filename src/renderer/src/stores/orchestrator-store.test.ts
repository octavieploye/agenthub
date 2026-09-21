import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useOrchestratorStore } from './orchestrator-store'
import type {
  OrchestratorRun,
  OrchestratorStatusChangePayload,
  OrchestratorStatusResponse,
  OrchestratorTaskPhaseChangePayload,
} from '@shared/types/orchestrator.types'

/* ---------- helpers ---------- */

function makeRun(overrides: Partial<OrchestratorRun> = {}): OrchestratorRun {
  return {
    id: 'run-1',
    sprintName: 'sprint-alpha',
    projectId: null,
    repoId: 'repo-1',
    status: 'running',
    concurrencyCap: 1,
    telegramNotify: false,
    createdAt: '2026-09-20T00:00:00Z',
    updatedAt: '2026-09-20T00:00:00Z',
    startedAt: '2026-09-20T00:00:00Z',
    completedAt: null,
    singleTaskId: null,
    startedBy: null,
    triggerSource: 'manual',
    taskIds: null,
    agentsSpawned: 0,
    agentLifetimeCap: 3600,
    ...overrides,
  }
}

function makeStatusResponse(overrides: Partial<OrchestratorStatusResponse> = {}): OrchestratorStatusResponse {
  return {
    run: null,
    activeTasks: [],
    completedCount: 0,
    totalCount: 0,
    failedCount: 0,
    singleTaskId: null,
    activeRuns: [],
    queuedRuns: [],
    ...overrides,
  }
}

/**
 * Stub the IPC boundary — the only mock allowed (we don't own Electron IPC).
 * Returns the individual mocks for assertion.
 */
function stubOrchestrator(opts: {
  startResult?: OrchestratorRun | null
  statusResponse?: OrchestratorStatusResponse
} = {}) {
  const {
    startResult = makeRun(),
    statusResponse = makeStatusResponse(),
  } = opts

  const startMock = vi.fn().mockResolvedValue({ success: true, data: startResult })
  const statusMock = vi.fn().mockResolvedValue({ success: true, data: statusResponse })
  const pauseMock = vi.fn().mockResolvedValue({ success: true, data: undefined })
  const resumeMock = vi.fn().mockResolvedValue({ success: true, data: undefined })
  const cancelMock = vi.fn().mockResolvedValue({ success: true, data: undefined })

  Object.defineProperty(window, 'agentHub', {
    value: {
      orchestrator: {
        start: startMock,
        status: statusMock,
        pause: pauseMock,
        resume: resumeMock,
        cancel: cancelMock,
        taskLog: vi.fn().mockResolvedValue({ success: true, data: [] }),
        approveTask: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        startSingleTask: vi.fn().mockResolvedValue({ success: true, data: makeRun() }),
        getRetryFailures: vi.fn().mockResolvedValue({ success: true, data: [] }),
        acknowledgeRetryFailures: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        onStatusChange: vi.fn().mockReturnValue(() => {}),
        onTaskPhaseChange: vi.fn().mockReturnValue(() => {}),
        onTaskApprovalNeeded: vi.fn().mockReturnValue(() => {}),
      },
      tasks: { list: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      on: { sprintAutoStart: vi.fn().mockReturnValue(() => {}) },
    },
    writable: true,
    configurable: true,
  })

  return { startMock, statusMock, pauseMock, resumeMock, cancelMock }
}

/* ---------- Fix 1: start() — queued result ---------- */

describe('orchestrator-store — start() queued result', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does NOT write singleton runId when backend returns queued status', async () => {
    const queuedRun = makeRun({ id: 'run-q1', sprintName: 'sprint-q', status: 'queued' })
    const { statusMock } = stubOrchestrator({
      startResult: queuedRun,
      statusResponse: makeStatusResponse({ queuedRuns: [queuedRun] }),
    })
    // Override start to return a queued run
    window.agentHub.orchestrator.start = vi.fn().mockResolvedValue({ success: true, data: queuedRun })

    const ok = await useOrchestratorStore.getState().start({
      sprintName: 'sprint-q',
      repoId: 'repo-1',
      confirmed: true,
    })

    expect(ok).toBe(true)
    expect(useOrchestratorStore.getState().runId).toBeNull()
    expect(useOrchestratorStore.getState().runStatus).toBeNull()
    expect(useOrchestratorStore.getState().sprintName).toBeNull()
    expect(statusMock).toHaveBeenCalled()
  })

  it('writes singleton when backend returns running status', async () => {
    const runningRun = makeRun({ id: 'run-1', status: 'running', sprintName: 'sprint-alpha' })
    stubOrchestrator({ startResult: runningRun })

    const ok = await useOrchestratorStore.getState().start({
      sprintName: 'sprint-alpha',
      repoId: 'repo-1',
      confirmed: true,
    })

    expect(ok).toBe(true)
    expect(useOrchestratorStore.getState().runId).toBe('run-1')
    expect(useOrchestratorStore.getState().runStatus).toBe('running')
    expect(useOrchestratorStore.getState().sprintName).toBe('sprint-alpha')
  })

  it('writes singleton when backend returns paused status', async () => {
    const pausedRun = makeRun({ id: 'run-2', status: 'paused', sprintName: 'sprint-alpha' })
    stubOrchestrator({ startResult: pausedRun })

    const ok = await useOrchestratorStore.getState().start({
      sprintName: 'sprint-alpha',
      repoId: 'repo-1',
      confirmed: true,
    })

    expect(ok).toBe(true)
    expect(useOrchestratorStore.getState().runId).toBe('run-2')
    expect(useOrchestratorStore.getState().runStatus).toBe('paused')
  })
})

/* ---------- Fix 2: pause(runId?) ---------- */

describe('orchestrator-store — pause(runId?)', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('no arg defaults to get().runId', async () => {
    const { pauseMock } = stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'running' })

    await useOrchestratorStore.getState().pause()

    expect(pauseMock).toHaveBeenCalledWith({ runId: 'run-active' })
    expect(useOrchestratorStore.getState().runStatus).toBe('paused')
  })

  it('explicit runId targets that run on the backend', async () => {
    const { pauseMock } = stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'running' })

    await useOrchestratorStore.getState().pause('run-other')

    expect(pauseMock).toHaveBeenCalledWith({ runId: 'run-other' })
  })

  it('does NOT update singleton runStatus when explicit runId differs from focused run', async () => {
    stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'running' })

    await useOrchestratorStore.getState().pause('run-other')

    expect(useOrchestratorStore.getState().runStatus).toBe('running')
  })

  it('returns false when no runId is available', async () => {
    stubOrchestrator()
    // runId stays null from initial state

    const result = await useOrchestratorStore.getState().pause()

    expect(result).toBe(false)
  })
})

/* ---------- Fix 2: resume(runId?) ---------- */

describe('orchestrator-store — resume(runId?)', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('no arg defaults to get().runId', async () => {
    const { resumeMock } = stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'paused' })

    await useOrchestratorStore.getState().resume()

    expect(resumeMock).toHaveBeenCalledWith({ runId: 'run-active' })
    expect(useOrchestratorStore.getState().runStatus).toBe('running')
  })

  it('explicit runId targets that run on the backend', async () => {
    const { resumeMock } = stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'paused' })

    await useOrchestratorStore.getState().resume('run-other')

    expect(resumeMock).toHaveBeenCalledWith({ runId: 'run-other' })
  })

  it('does NOT update singleton runStatus when explicit runId differs from focused run', async () => {
    stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'paused' })

    await useOrchestratorStore.getState().resume('run-other')

    expect(useOrchestratorStore.getState().runStatus).toBe('paused')
  })

  it('returns false when no runId is available', async () => {
    stubOrchestrator()

    const result = await useOrchestratorStore.getState().resume()

    expect(result).toBe(false)
  })
})

/* ---------- Fix 3: handleStatusChange() — multi-run safety ---------- */

describe('orchestrator-store — handleStatusChange() multi-run safety', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('focused-run change: updates singleton fields', () => {
    stubOrchestrator()
    useOrchestratorStore.setState({
      runId: 'run-active',
      runStatus: 'running',
      sprintName: 'sprint-alpha',
    })

    const payload: OrchestratorStatusChangePayload = {
      runId: 'run-active',
      status: 'completed',
      sprintName: 'sprint-alpha',
      repoId: 'repo-1',
    }
    useOrchestratorStore.getState().handleStatusChange(payload)

    expect(useOrchestratorStore.getState().runId).toBe('run-active')
    expect(useOrchestratorStore.getState().runStatus).toBe('completed')
  })

  it('focused-run change: does NOT call fetchStatus', () => {
    const { statusMock } = stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'running' })

    useOrchestratorStore.getState().handleStatusChange({
      runId: 'run-active',
      status: 'paused',
      sprintName: 'sprint-alpha',
      repoId: 'repo-1',
    })

    expect(statusMock).not.toHaveBeenCalled()
  })

  it('foreign-run change: does NOT write singleton runId/runStatus/sprintName', () => {
    stubOrchestrator()
    useOrchestratorStore.setState({
      runId: 'run-active',
      runStatus: 'running',
      sprintName: 'sprint-alpha',
    })

    const payload: OrchestratorStatusChangePayload = {
      runId: 'run-foreign',
      status: 'completed',
      sprintName: 'sprint-foreign',
      repoId: 'repo-1',
    }
    useOrchestratorStore.getState().handleStatusChange(payload)

    expect(useOrchestratorStore.getState().runId).toBe('run-active')
    expect(useOrchestratorStore.getState().runStatus).toBe('running')
    expect(useOrchestratorStore.getState().sprintName).toBe('sprint-alpha')
  })

  it('foreign-run change: calls fetchStatus to refresh arrays', async () => {
    const { statusMock } = stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', runStatus: 'running' })

    useOrchestratorStore.getState().handleStatusChange({
      runId: 'run-foreign',
      status: 'completed',
      sprintName: 'sprint-foreign',
      repoId: 'repo-1',
    })

    // fetchStatus is fire-and-forget; flush microtasks to let it land
    await Promise.resolve()

    expect(statusMock).toHaveBeenCalled()
  })

  it('null-focused change: does NOT write singleton runId/runStatus', () => {
    stubOrchestrator()
    // No active run — runId stays null from initial state
    expect(useOrchestratorStore.getState().runId).toBeNull()

    const payload: OrchestratorStatusChangePayload = {
      runId: 'run-new',
      status: 'running',
      sprintName: 'sprint-new',
      repoId: 'repo-1',
    }
    useOrchestratorStore.getState().handleStatusChange(payload)

    expect(useOrchestratorStore.getState().runId).toBeNull()
    expect(useOrchestratorStore.getState().runStatus).toBeNull()
  })

  it('null-focused change: calls fetchStatus to refresh arrays', async () => {
    const { statusMock } = stubOrchestrator()
    expect(useOrchestratorStore.getState().runId).toBeNull()

    useOrchestratorStore.getState().handleStatusChange({
      runId: 'run-new',
      status: 'running',
      sprintName: 'sprint-new',
      repoId: 'repo-1',
    })

    await Promise.resolve()

    expect(statusMock).toHaveBeenCalled()
  })
})

/* ---------- R-011: instanceof Error guard in startSingleTask ---------- */

describe('orchestrator-store — R-011: instanceof Error guard', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('startSingleTask: stores String(err) when thrown value is not an Error instance', async () => {
    stubOrchestrator()
    window.agentHub.orchestrator.startSingleTask = vi.fn().mockRejectedValue('plain string error')

    const ok = await useOrchestratorStore.getState().startSingleTask('task-1')

    expect(ok).toBe(false)
    expect(useOrchestratorStore.getState().error).toBe('plain string error')
  })

  it('cancel: stores String(err) when thrown value is not an Error instance', async () => {
    stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-1' })
    window.agentHub.orchestrator.cancel = vi.fn().mockRejectedValue('cancel plain error')

    await useOrchestratorStore.getState().cancel()

    expect(useOrchestratorStore.getState().error).toBe('cancel plain error')
  })
})

/* ---------- R-013: startSingleTask optional repoId ---------- */

describe('orchestrator-store — R-013: startSingleTask optional repoId', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('startSingleTask can be called with taskId only — repoId is not required', async () => {
    stubOrchestrator()

    // TypeScript compile error before fix: "Expected 2 arguments, but got 1"
    const ok = await useOrchestratorStore.getState().startSingleTask('task-1')

    expect(ok).toBe(true)
    expect(useOrchestratorStore.getState().singleTaskId).toBeTruthy()
  })
})

/* ---------- R-014: taskProgress stores phase in phase field ---------- */

describe('orchestrator-store — R-014: taskProgress.phase field', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handleTaskPhaseChange stores phase in .phase, not .skill', () => {
    stubOrchestrator()

    const payload: OrchestratorTaskPhaseChangePayload = {
      runId: 'run-1',
      taskId: 'task-1',
      phase: 'dev',
      status: 'active',
    }
    useOrchestratorStore.getState().handleTaskPhaseChange(payload)

    const entry = useOrchestratorStore.getState().taskProgress.get('task-1')
    expect(entry?.phase).toBe('dev')
    expect(entry?.skill).toBeNull()
  })
})

/* ---------- R-015: foreign-run fetchStatus deduplication ---------- */

describe('orchestrator-store — R-015: foreign-run fetchStatus deduplication', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does NOT call fetchStatus again when loading=true (overlapping fetch guard)', async () => {
    const { statusMock } = stubOrchestrator()
    useOrchestratorStore.setState({ runId: 'run-active', loading: true })

    useOrchestratorStore.getState().handleStatusChange({
      runId: 'run-foreign',
      status: 'completed',
      sprintName: 'sprint-foreign',
      repoId: 'repo-1',
    } as OrchestratorStatusChangePayload)

    await Promise.resolve()

    expect(statusMock).not.toHaveBeenCalled()
  })
})
