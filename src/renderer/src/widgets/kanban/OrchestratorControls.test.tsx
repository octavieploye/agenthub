import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { OrchestratorControls } from './OrchestratorControls'
import { useOrchestratorStore } from '../../stores/orchestrator-store'
import type { OrchestratorRun, OrchestratorStatusResponse, OrchestratorStatusChangePayload } from '@shared/types/orchestrator.types'

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
    createdAt: '2026-09-19T00:00:00Z',
    updatedAt: '2026-09-19T00:00:00Z',
    startedAt: '2026-09-19T00:00:00Z',
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
    run: makeRun(),
    activeTasks: [],
    completedCount: 1,
    totalCount: 3,
    failedCount: 0,
    singleTaskId: null,
    activeRuns: [makeRun()],
    queuedRuns: [],
    ...overrides,
  }
}

/** Stub the IPC boundary — the only mock allowed (we don't own Electron IPC). */
function stubAgentHub(statusResponse: OrchestratorStatusResponse) {
  const cancelMock = vi.fn().mockResolvedValue({ success: true, data: undefined })
  const statusMock = vi.fn().mockResolvedValue({ success: true, data: statusResponse })

  Object.defineProperty(window, 'agentHub', {
    value: {
      orchestrator: {
        start: vi.fn().mockResolvedValue({ success: true, data: statusResponse.run }),
        pause: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        resume: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        cancel: cancelMock,
        status: statusMock,
        taskLog: vi.fn().mockResolvedValue({ success: true, data: [] }),
        approveTask: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        startSingleTask: vi.fn().mockResolvedValue({ success: true, data: statusResponse.run }),
        getRetryFailures: vi.fn().mockResolvedValue({ success: true, data: [] }),
        acknowledgeRetryFailures: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        onStatusChange: vi.fn().mockReturnValue(() => {}),
        onTaskPhaseChange: vi.fn().mockReturnValue(() => {}),
        onTaskApprovalNeeded: vi.fn().mockReturnValue(() => {}),
      },
      tasks: {
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
      on: {
        sprintAutoStart: vi.fn().mockReturnValue(() => {}),
      },
    },
    writable: true,
    configurable: true,
  })

  return { cancelMock, statusMock }
}

const defaultRepos = [{ id: 'repo-1', name: 'test-repo', path: '/tmp/test-repo' }]

/* ---------- tests ---------- */

describe('OrchestratorControls — queue visibility (R-006)', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders "N queued" badge when queuedRuns is non-empty', async () => {
    const queuedRun = makeRun({ id: 'run-q1', sprintName: 'sprint-beta', status: 'queued' })
    const resp = makeStatusResponse({ queuedRuns: [queuedRun] })
    stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    expect(screen.getByTestId('queue-indicator')).toHaveTextContent('1 queued')
  })

  it('renders each queued run sprint name in the queue list', async () => {
    const q1 = makeRun({ id: 'run-q1', sprintName: 'sprint-beta', status: 'queued' })
    const q2 = makeRun({ id: 'run-q2', sprintName: 'sprint-gamma', status: 'queued' })
    const resp = makeStatusResponse({ queuedRuns: [q1, q2] })
    stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    expect(screen.getByText('sprint-beta')).toBeInTheDocument()
    expect(screen.getByText('sprint-gamma')).toBeInTheDocument()
  })

  it('clicking X on a queued run calls cancel with THAT run id', async () => {
    const q1 = makeRun({ id: 'run-q1', sprintName: 'sprint-beta', status: 'queued' })
    const resp = makeStatusResponse({ queuedRuns: [q1] })
    const { cancelMock } = stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    const cancelBtn = screen.getByTestId('cancel-queued-run-q1')
    await act(async () => {
      fireEvent.click(cancelBtn)
    })

    expect(cancelMock).toHaveBeenCalledWith({ runId: 'run-q1' })
  })

  it('does NOT show queue indicator when queuedRuns is empty', async () => {
    const resp = makeStatusResponse({ queuedRuns: [] })
    stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    expect(screen.queryByTestId('queue-indicator')).not.toBeInTheDocument()
  })

  it('active run status badge still renders when queue is non-empty', async () => {
    const q1 = makeRun({ id: 'run-q1', sprintName: 'sprint-beta', status: 'queued' })
    const resp = makeStatusResponse({ queuedRuns: [q1] })
    stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    // Active run badge should show 'running'
    const badges = screen.getAllByText('running')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })
})

describe('OrchestratorControls — handleStatusChange run-awareness', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cancelling a queued run does NOT clobber the active run status', async () => {
    const store = useOrchestratorStore

    // Seed the store with an active run + a queued run
    store.setState({
      runId: 'run-active',
      runStatus: 'running',
      sprintName: 'sprint-alpha',
      queuedRuns: [makeRun({ id: 'run-q1', sprintName: 'sprint-beta', status: 'queued' })],
    })

    // Simulate a status change event for the QUEUED run being cancelled
    const payload: OrchestratorStatusChangePayload = {
      runId: 'run-q1',
      status: 'cancelled',
      sprintName: 'sprint-beta',
      repoId: 'repo-1',
    }
    store.getState().handleStatusChange(payload)

    // Active run must be untouched
    expect(store.getState().runId).toBe('run-active')
    expect(store.getState().runStatus).toBe('running')
    expect(store.getState().sprintName).toBe('sprint-alpha')
  })

  it('status change for the active run still updates active run fields', () => {
    const store = useOrchestratorStore

    store.setState({
      runId: 'run-active',
      runStatus: 'running',
      sprintName: 'sprint-alpha',
      queuedRuns: [],
    })

    const payload: OrchestratorStatusChangePayload = {
      runId: 'run-active',
      status: 'completed',
      sprintName: 'sprint-alpha',
      repoId: 'repo-1',
    }
    store.getState().handleStatusChange(payload)

    expect(store.getState().runId).toBe('run-active')
    expect(store.getState().runStatus).toBe('completed')
  })
})

describe('OrchestratorControls — isIdle invariant', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does NOT show start button when status is "queued"', async () => {
    const resp = makeStatusResponse({
      run: makeRun({ status: 'queued' }),
      queuedRuns: [],
    })
    stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    // 'queued' is not idle — start button should not appear
    expect(screen.queryByTitle('Start orchestrator run')).not.toBeInTheDocument()
  })
})

describe('OrchestratorControls — terminal badge (R-002)', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders completed terminal badge even when activeRuns is non-empty (stale push-event window)', async () => {
    // Simulate the window between a push event setting runStatus→'completed'
    // and fetchStatus clearing activeRuns: the badge must already be visible.
    const staleRun = makeRun({ id: 'run-1', status: 'running' })
    stubAgentHub(
      makeStatusResponse({
        run: makeRun({ id: 'run-1', status: 'completed' }),
        activeRuns: [staleRun],
      })
    )

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('renders failed terminal badge even when activeRuns is non-empty', async () => {
    const staleRun = makeRun({ id: 'run-1', status: 'running' })
    stubAgentHub(
      makeStatusResponse({
        run: makeRun({ id: 'run-1', status: 'failed' }),
        activeRuns: [staleRun],
      })
    )

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('renders cancelled terminal badge even when activeRuns is non-empty', async () => {
    const staleRun = makeRun({ id: 'run-1', status: 'running' })
    stubAgentHub(
      makeStatusResponse({
        run: makeRun({ id: 'run-1', status: 'cancelled' }),
        activeRuns: [staleRun],
      })
    )

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    expect(screen.getByText('cancelled')).toBeInTheDocument()
  })
})

describe('OrchestratorControls — multi-run per-run controls (R-007)', () => {
  beforeEach(() => {
    useOrchestratorStore.setState(useOrchestratorStore.getInitialState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders per-run status badge, sprint name, and controls for each active run', async () => {
    const runA = makeRun({ id: 'run-a', sprintName: 'sprint-alpha', status: 'running' })
    const runB = makeRun({ id: 'run-b', sprintName: 'sprint-beta', status: 'paused' })
    const resp = makeStatusResponse({ run: runA, activeRuns: [runA, runB], queuedRuns: [] })
    stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    // Both sprint names must appear
    expect(screen.getByText('sprint-alpha')).toBeInTheDocument()
    expect(screen.getByText('sprint-beta')).toBeInTheDocument()

    // runA (running) → pause button; runB (paused) → resume button
    expect(screen.getByTestId('pause-run-run-a')).toBeInTheDocument()
    expect(screen.getByTestId('resume-run-run-b')).toBeInTheDocument()

    // Each run must have its own cancel button
    expect(screen.getByTestId('cancel-run-run-a')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-run-run-b')).toBeInTheDocument()

    // Start button must NOT appear while active runs exist
    expect(screen.queryByTitle('Start orchestrator run')).not.toBeInTheDocument()
  })

  it('pausing run B calls pause({ runId: B }) and does not change run A singleton status', async () => {
    const runA = makeRun({ id: 'run-a', sprintName: 'sprint-alpha', status: 'running' })
    const runB = makeRun({ id: 'run-b', sprintName: 'sprint-beta', status: 'running' })
    const resp = makeStatusResponse({ run: runA, activeRuns: [runA, runB], queuedRuns: [] })
    stubAgentHub(resp)

    await act(async () => {
      render(<OrchestratorControls repos={defaultRepos} selectedProjectId={null} />)
    })

    // After fetchStatus, store singleton is focused on run-a
    expect(useOrchestratorStore.getState().runId).toBe('run-a')

    // Click pause on run-b specifically
    await act(async () => {
      fireEvent.click(screen.getByTestId('pause-run-run-b'))
    })

    // IPC must target run-b
    expect(window.agentHub.orchestrator.pause).toHaveBeenCalledWith({ runId: 'run-b' })

    // Singleton for run-a must remain 'running' — not changed to 'paused'
    expect(useOrchestratorStore.getState().runStatus).toBe('running')
  })
})
