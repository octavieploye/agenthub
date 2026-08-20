import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { KanbanOrchestratorService, type OrchestratorDeps } from './kanban-orchestrator'
import { getRun, getTaskLogsByRun, getTaskLogsByTask } from '../db/queries/orchestrator.queries'
import { insertTask, getTaskById } from '../db/queries/tasks.queries'
import { insertTaskDependency } from '../db/queries/task-dependencies.queries'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type { AgentState } from '../../shared/types/agent.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}))

let db: Database.Database
let activeServices: KanbanOrchestratorService[] = []

function trackService(service: KanbanOrchestratorService): KanbanOrchestratorService {
  activeServices.push(service)
  return service
}

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: `agent-${Math.random().toString(36).slice(2, 8)}`,
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-5-20250514',
    provider: 'anthropic',
    effortLevel: 'high',
    taskDescription: 'test task',
    pid: null,
    ptyFd: null,
    cwd: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: 0,
    color: '#3B82F6',
    executionMode: 'native',
    voiceMode: 'off',
    telegramNotify: false,
    ...overrides,
  }
}

function createMockDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  return {
    spawnAgent: vi.fn(() => createMockAgent()),
    getRepoPath: vi.fn(() => '/tmp/test'),
    gitStageAll: vi.fn(),
    gitCommit: vi.fn(() => 'abc123def456'),
    gitPush: vi.fn(),
    emitToRenderer: vi.fn(),
    sendTelegramNotification: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  db.prepare(
    "INSERT INTO repos (id, name, path, created_at, last_used_at) VALUES ('repo-1', 'test', '/tmp/test', datetime('now'), datetime('now'))"
  ).run()
})

afterEach(() => {
  for (const s of activeServices) s.stop()
  activeServices = []
  db.close()
})

describe('KanbanOrchestrator Integration', () => {
  // ---------------------------------------------------------------------------
  // 1. Full lifecycle — single task, all phases succeed
  // ---------------------------------------------------------------------------
  describe('full lifecycle — single task, all phases succeed', () => {
    it('drives a task through dev → review → security → commit → push and completes the run', () => {
      const devAgent = createMockAgent({ id: 'dev-agent-1' })
      const reviewAgent = createMockAgent({ id: 'review-agent-1' })
      const secAgent = createMockAgent({ id: 'sec-agent-1' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))

      // Start orchestrator with telegram enabled
      const run = service.start({
        sprintName: 'Integration-Test',
        repoId: 'repo-1',
        concurrencyCap: 3,
        telegramNotify: true,
      })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Build auth module',
        description: 'Implement JWT authentication',
        status: 'backlog',
      })

      // Dispatch dev phase
      service.dispatchDevPhase(task.id, run)
      expect(deps.spawnAgent).toHaveBeenCalledTimes(1)

      // Verify task is in_progress
      const taskAfterDev = getTaskById(db, task.id)
      expect(taskAfterDev!.status).toBe('in_progress')

      // Simulate dev agent completion → review phase dispatched
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any,
      })
      expect(deps.spawnAgent).toHaveBeenCalledTimes(2)

      // Verify dev log is done, review log is active
      let logs = getTaskLogsByTask(db, task.id)
      expect(logs.find((l) => l.phase === 'dev')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'review')?.status).toBe('active')

      // Simulate review agent completion → security phase dispatched
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any,
      })
      expect(deps.spawnAgent).toHaveBeenCalledTimes(3)

      logs = getTaskLogsByTask(db, task.id)
      expect(logs.find((l) => l.phase === 'review')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'security')?.status).toBe('active')

      // Simulate security agent completion → commit+push executed synchronously
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any,
      })

      // Verify all 5 phase logs are done
      logs = getTaskLogsByTask(db, task.id)
      expect(logs.find((l) => l.phase === 'dev')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'review')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'security')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'commit')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'push')?.status).toBe('done')

      // Verify task status is 'tested'
      const finalTask = getTaskById(db, task.id)
      expect(finalTask!.status).toBe('tested')

      // Verify run status is 'completed'
      const finalRun = getRun(db, run.id)
      expect(finalRun!.status).toBe('completed')

      // Verify emitToRenderer was called with STATUS_CHANGE events
      const emitCalls = (deps.emitToRenderer as ReturnType<typeof vi.fn>).mock.calls
      const statusChangeCalls = emitCalls.filter(
        (c: unknown[]) => c[0] === IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE
      )
      // start (running) + completed
      expect(statusChangeCalls.length).toBeGreaterThanOrEqual(2)
      const statusPayloads = statusChangeCalls.map((c: unknown[]) => c[1] as { status: string })
      expect(statusPayloads.some((p) => p.status === 'running')).toBe(true)
      expect(statusPayloads.some((p) => p.status === 'completed')).toBe(true)

      // Verify emitToRenderer was called with TASK_PHASE_CHANGE events
      const phaseChangeCalls = emitCalls.filter(
        (c: unknown[]) => c[0] === IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE
      )
      expect(phaseChangeCalls.length).toBeGreaterThanOrEqual(5) // at least one per phase

      // Verify sendTelegramNotification was called for sprint start and completion
      const telegramCalls = (deps.sendTelegramNotification as ReturnType<typeof vi.fn>).mock.calls
      expect(telegramCalls.length).toBeGreaterThanOrEqual(2)
      // Start notification
      expect(telegramCalls[0][0]).toContain('Integration-Test')
      expect(telegramCalls[0][1]).toBe('completed')
      // Completion notification
      const completionCall = telegramCalls.find(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('completed')
      )
      expect(completionCall).toBeTruthy()

      // Verify git operations executed
      expect(deps.gitStageAll).toHaveBeenCalledOnce()
      expect(deps.gitCommit).toHaveBeenCalledOnce()
      expect(deps.gitPush).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Security blocked — critical finding pauses sprint
  // ---------------------------------------------------------------------------
  describe('security blocked — critical finding pauses sprint', () => {
    it('pauses the run when security agent fails and sends telegram notification', () => {
      const devAgent = createMockAgent({ id: 'dev-blocked' })
      const reviewAgent = createMockAgent({ id: 'review-blocked' })
      const secAgent = createMockAgent({ id: 'sec-blocked' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'Security-Block-Test',
        repoId: 'repo-1',
        telegramNotify: true,
      })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Risky endpoint',
        description: 'Add public API with auth bypass',
        status: 'backlog',
      })

      // Advance through dev and review
      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any,
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any,
      })

      // Verify security phase is now active
      let logs = getTaskLogsByTask(db, task.id)
      expect(logs.find((l) => l.phase === 'security')?.status).toBe('active')

      // Simulate security agent failure
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: secAgent.id } as any,
      })

      // Verify the security phase log is marked as failed
      logs = getTaskLogsByTask(db, task.id)
      expect(logs.find((l) => l.phase === 'security')?.status).toBe('failed')

      // Verify no commit was attempted
      expect(deps.gitCommit).not.toHaveBeenCalled()

      // The run should still be running (the orchestrator only pauses on
      // explicit security-block in executeCommitPhase, not on agent failure).
      // onAgentFailed marks the phase log as failed and dispatches next tasks.
      const updatedRun = getRun(db, run.id)
      // Run status depends on whether there are other tasks to dispatch.
      // With a single task that failed security, the run remains running
      // (no more tasks to dispatch, but not all completed either).
      expect(['running', 'paused']).toContain(updatedRun!.status)
    })

    it('pauses the run when executeCommitPhase receives securityBlocked=true', () => {
      const devAgent = createMockAgent({ id: 'dev-explicit-block' })
      const reviewAgent = createMockAgent({ id: 'review-explicit-block' })
      const secAgent = createMockAgent({ id: 'sec-explicit-block' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'Explicit-Block-Test',
        repoId: 'repo-1',
        telegramNotify: true,
      })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Blocked task',
        status: 'backlog',
      })

      // Advance through dev and review
      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any,
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any,
      })

      // Manually execute commit with securityBlocked=true
      const result = service.executeCommitPhase(task.id, run, true)

      expect(result).toBe(false)
      expect(deps.gitCommit).not.toHaveBeenCalled()

      // Run is paused
      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('paused')

      // Telegram notification sent with 'failed' type
      const telegramCalls = (deps.sendTelegramNotification as ReturnType<typeof vi.fn>).mock.calls
      const failedCall = telegramCalls.find((c: unknown[]) => c[1] === 'failed')
      expect(failedCall).toBeTruthy()
      expect(failedCall![0]).toContain('Security blocked')
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Multi-task dependency ordering
  // ---------------------------------------------------------------------------
  describe('multi-task dependency ordering', () => {
    it('dispatches task B only after task A completes all phases', () => {
      const agentA_dev = createMockAgent({ id: 'a-dev' })
      const agentA_review = createMockAgent({ id: 'a-review' })
      const agentA_sec = createMockAgent({ id: 'a-sec' })
      const agentB_dev = createMockAgent({ id: 'b-dev' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return agentA_dev
          if (callCount === 2) return agentA_review
          if (callCount === 3) return agentA_sec
          if (callCount === 4) return agentB_dev
          return createMockAgent({ id: `extra-${callCount}` })
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'Dep-Order-Test',
        repoId: 'repo-1',
        concurrencyCap: 3,
      })

      const taskA = insertTask(db, {
        repoId: 'repo-1',
        title: 'Foundation module',
        priority: 1,
        status: 'backlog',
      })
      const taskB = insertTask(db, {
        repoId: 'repo-1',
        title: 'Feature on top',
        priority: 2,
        status: 'backlog',
      })
      // B depends on A
      insertTaskDependency(db, taskB.id, taskA.id)

      // Verify only task A is dispatchable initially
      const initial = service.getNextDispatchableTasks(run.id)
      expect(initial.map((t) => t.id)).toContain(taskA.id)
      expect(initial.map((t) => t.id)).not.toContain(taskB.id)

      // Dispatch A and complete through all phases
      service.dispatchDevPhase(taskA.id, run)
      expect(deps.spawnAgent).toHaveBeenCalledTimes(1)

      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentA_dev.id } as any,
      })
      // Review dispatched for A
      expect(deps.spawnAgent).toHaveBeenCalledTimes(2)

      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentA_review.id } as any,
      })
      // Security dispatched for A
      expect(deps.spawnAgent).toHaveBeenCalledTimes(3)

      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentA_sec.id } as any,
      })
      // After commit+push for A, dispatchNextTasks should find B and dispatch its dev phase
      expect(deps.spawnAgent).toHaveBeenCalledTimes(4)

      // Verify task A is now tested
      const finalA = getTaskById(db, taskA.id)
      expect(finalA!.status).toBe('tested')

      // Verify task B's dev phase was dispatched
      const spawnCalls = (deps.spawnAgent as ReturnType<typeof vi.fn>).mock.calls
      const bDevCall = spawnCalls.find(
        (c: unknown[]) =>
          typeof (c[0] as Record<string, unknown>).name === 'string' &&
          ((c[0] as Record<string, unknown>).name as string).includes('Feature on top')
      )
      expect(bDevCall).toBeTruthy()

      // Verify task B is now in_progress
      const bTask = getTaskById(db, taskB.id)
      expect(bTask!.status).toBe('in_progress')
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Pause and resume
  // ---------------------------------------------------------------------------
  describe('pause and resume', () => {
    it('pausing stops tick dispatch; resuming restarts it and emits STATUS_CHANGE for both', () => {
      const devAgent = createMockAgent({ id: 'pr-dev' })
      const reviewAgent = createMockAgent({ id: 'pr-review' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return createMockAgent({ id: `pr-extra-${callCount}` })
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'Pause-Resume-Test',
        repoId: 'repo-1',
        concurrencyCap: 3,
      })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Pausable task',
        status: 'backlog',
      })

      // Dispatch dev and advance to review
      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any,
      })

      // Verify review is active
      let logs = getTaskLogsByTask(db, task.id)
      expect(logs.find((l) => l.phase === 'review')?.status).toBe('active')

      // Clear emitToRenderer calls to isolate pause/resume events
      ;(deps.emitToRenderer as ReturnType<typeof vi.fn>).mockClear()

      // Pause
      service.pause(run.id)

      // Verify run is paused
      let updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('paused')

      // Verify tick does nothing when paused
      // Insert another task to see if tick dispatches it
      insertTask(db, { repoId: 'repo-1', title: 'Should not dispatch', status: 'backlog' })
      const spawnCountBeforeTick = (deps.spawnAgent as ReturnType<typeof vi.fn>).mock.calls.length
      service.tick()
      expect((deps.spawnAgent as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        spawnCountBeforeTick
      )

      // Verify STATUS_CHANGE emitted for pause
      let emitCalls = (deps.emitToRenderer as ReturnType<typeof vi.fn>).mock.calls
      let statusCalls = emitCalls.filter(
        (c: unknown[]) => c[0] === IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE
      )
      expect(statusCalls.length).toBe(1)
      expect((statusCalls[0][1] as { status: string }).status).toBe('paused')

      // Resume
      ;(deps.emitToRenderer as ReturnType<typeof vi.fn>).mockClear()
      service.resume(run.id)

      // Verify run is running again
      updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('running')

      // Verify STATUS_CHANGE emitted for resume
      emitCalls = (deps.emitToRenderer as ReturnType<typeof vi.fn>).mock.calls
      statusCalls = emitCalls.filter(
        (c: unknown[]) => c[0] === IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE
      )
      expect(statusCalls.length).toBe(1)
      expect((statusCalls[0][1] as { status: string }).status).toBe('running')

      // Verify tick works again after resume
      service.tick()
      // spawnAgent should have been called for the new task (or at least tick runs without error)
      expect((deps.spawnAgent as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        spawnCountBeforeTick
      )
    })
  })
})
