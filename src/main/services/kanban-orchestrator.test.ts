import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { KanbanOrchestratorService, type OrchestratorDeps } from './kanban-orchestrator'
import {
  getRun,
  insertTaskLog,
  getTaskLogsByRun,
  getTaskLogsByTask
} from '../db/queries/orchestrator.queries'
import { insertTask, getTaskById } from '../db/queries/tasks.queries'
import { insertTaskDependency } from '../db/queries/task-dependencies.queries'
import { getUnsyncedEvents } from '../db/queries/task-events.queries'
import type { AgentState } from '../../shared/types/agent.types'
import { OPERATING_RULES } from './orchestrator-rules'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
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
    ...overrides
  }
}

function createMockDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  return {
    spawnAgent: vi.fn(() => createMockAgent()),
    getRepoPath: vi.fn(() => '/tmp/test'),
    gitStageAll: vi.fn(),
    gitCommit: vi.fn(() => 'abc123def456'),
    gitPush: vi.fn(),
    ...overrides
  }
}

function enableOrchestrator(): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('orchestrator.enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'"
  ).run()
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  db.prepare(
    "INSERT INTO repos (id, name, path, created_at, last_used_at) VALUES ('repo-1', 'test', '/tmp/test', datetime('now'), datetime('now'))"
  ).run()
  // S3: orchestrator is flag-gated — enable it for the enabled-path tests by default
  enableOrchestrator()
})

afterEach(() => {
  for (const s of activeServices) s.stop()
  activeServices = []
  db.close()
})

describe('KanbanOrchestratorService', () => {
  // -------------------------------------------------------------------------
  // R7-A lifecycle tests (preserved from original)
  // -------------------------------------------------------------------------

  it('start creates a run and sets it to running', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({
      sprintName: 'R7-A',
      repoId: 'repo-1',
      concurrencyCap: 3,
      telegramNotify: false,
      confirmed: true
    })

    expect(run.status).toBe('running')
    expect(run.sprintName).toBe('R7-A')
    expect(run.startedAt).toBeTruthy()
  })

  it('start persists startedBy and triggerSource with manual defaults', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: true })

    expect(run.startedBy).toBe('user')
    expect(run.triggerSource).toBe('manual')

    const persisted = getRun(db, run.id)
    expect(persisted!.startedBy).toBe('user')
    expect(persisted!.triggerSource).toBe('manual')
  })

  it('startSingleTask persists triggerSource as single-task', () => {
    const task = insertTask(db, { repoId: 'repo-1', title: 'Single task', status: 'backlog' })
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.startSingleTask({
      sprintName: 'R7-single',
      repoId: 'repo-1',
      singleTaskId: task.id
    })

    expect(run.startedBy).toBe('user')
    expect(run.triggerSource).toBe('single-task')

    const persisted = getRun(db, run.id)
    expect(persisted!.startedBy).toBe('user')
    expect(persisted!.triggerSource).toBe('single-task')
  })

  it('start throws if a run is already running', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: true })
    expect(() => service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })).toThrow(
      /already running/i
    )
  })

  it('pause sets status to paused', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: true })
    service.pause(run.id)
    const updated = getRun(db, run.id)
    expect(updated?.status).toBe('paused')
  })

  it('resume sets status back to running', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: true })
    service.pause(run.id)
    service.resume(run.id)
    const updated = getRun(db, run.id)
    expect(updated?.status).toBe('running')
  })

  it('getStatus returns null when no active run', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const status = service.getStatus()
    expect(status.run).toBeNull()
    expect(status.completedCount).toBe(0)
  })

  it('getStatus returns active run info', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: true })
    const status = service.getStatus()
    expect(status.run?.id).toBe(run.id)
  })

  it('getTaskLog returns logs for a task', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: true })
    const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })
    insertTaskLog(db, { runId: run.id, taskId: task.id, phase: 'dev' })
    const logs = service.getTaskLog(task.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].phase).toBe('dev')
  })

  it('getNextDispatchableTasks returns unblocked tasks by priority', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({
      sprintName: 'R7-A',
      repoId: 'repo-1',
      concurrencyCap: 2,
      confirmed: true
    })
    const t1 = insertTask(db, { repoId: 'repo-1', title: 'Task 1', priority: 1, status: 'backlog' })
    const t2 = insertTask(db, { repoId: 'repo-1', title: 'Task 2', priority: 2, status: 'backlog' })
    const t3 = insertTask(db, { repoId: 'repo-1', title: 'Task 3', priority: 1, status: 'backlog' })
    insertTaskDependency(db, t3.id, t1.id)

    const dispatchable = service.getNextDispatchableTasks(run.id)
    const ids = dispatchable.map((t) => t.id)
    expect(ids).toContain(t1.id)
    expect(ids).toContain(t2.id)
    expect(ids).not.toContain(t3.id)
  })

  // -------------------------------------------------------------------------
  // S2: Sprint-scoped task selection
  // -------------------------------------------------------------------------

  describe('S2: sprint-scoped task selection', () => {
    it('start({sprintName}) dispatches only tasks in that sprint', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      insertTask(db, {
        repoId: 'repo-1',
        title: 'R7-A task 1',
        sprintName: 'R7-A',
        status: 'backlog'
      })
      insertTask(db, {
        repoId: 'repo-1',
        title: 'R7-A task 2',
        sprintName: 'R7-A',
        status: 'backlog'
      })
      insertTask(db, {
        repoId: 'repo-1',
        title: 'R7-B task',
        sprintName: 'R7-B',
        status: 'backlog'
      })

      service.start({ sprintName: 'R7-A', repoId: 'repo-1', concurrencyCap: 3, confirmed: true })
      service.tick()

      const spawnCalls = (deps.spawnAgent as any).mock.calls
      const names = spawnCalls.map((c: any) => c[0].name)
      expect(names.some((n: string) => n.includes('R7-B task'))).toBe(false)
      expect(names.some((n: string) => n.includes('R7-A task 1'))).toBe(true)
      expect(names.some((n: string) => n.includes('R7-A task 2'))).toBe(true)
    })

    it('start({taskIds}) dispatches only the specified tasks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const t1 = insertTask(db, { repoId: 'repo-1', title: 'Task 1', status: 'backlog' })
      const t2 = insertTask(db, { repoId: 'repo-1', title: 'Task 2', status: 'backlog' })
      const t3 = insertTask(db, { repoId: 'repo-1', title: 'Task 3', status: 'backlog' })

      const run = service.start({
        sprintName: 'R7-A',
        repoId: 'repo-1',
        taskIds: [t1.id, t2.id],
        concurrencyCap: 3,
        confirmed: true
      })
      service.tick()

      const logs = getTaskLogsByRun(db, run.id)
      const dispatchedIds = new Set(logs.map((l) => l.taskId))
      expect(dispatchedIds.has(t1.id)).toBe(true)
      expect(dispatchedIds.has(t2.id)).toBe(true)
      expect(dispatchedIds.has(t3.id)).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // R7-B-1: Dev phase dispatcher
  // -------------------------------------------------------------------------

  describe('dispatchDevPhase', () => {
    it('spawns agent with correct model and creates task log', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Build auth module',
        status: 'backlog'
      })

      const log = service.dispatchDevPhase(task.id, run)

      expect(log).not.toBeNull()
      expect(log!.phase).toBe('dev')
      expect(deps.spawnAgent).toHaveBeenCalledOnce()
      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.repoId).toBe('repo-1')
      expect(spawnCall.cwd).toBe('/tmp/test')
      expect(spawnCall.skipPermissions).toBe(true)
      expect(spawnCall.name).toContain('Build auth module')
    })

    it('creates task log with active status', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs).toHaveLength(1)
      expect(logs[0].phase).toBe('dev')
      expect(logs[0].status).toBe('active')
      expect(logs[0].agentId).toBeTruthy()
    })

    it('updates task status to in_progress', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)

      const updated = getTaskById(db, task.id)
      expect(updated!.status).toBe('in_progress')
    })

    it('uses Anthropic for dev phase', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs[0].providerUsed).toBe('anthropic')
    })

    it('returns null when no deps injected', () => {
      const service = trackService(new KanbanOrchestratorService(db)) // no deps
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      const log = service.dispatchDevPhase(task.id, run)
      expect(log).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // R7-B-2: Review phase dispatcher
  // -------------------------------------------------------------------------

  describe('dispatchReviewPhase', () => {
    it('spawns review agent with review prompt', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Auth module',
        description: 'Add JWT auth',
        status: 'in_progress'
      })

      const log = service.dispatchReviewPhase(task.id, run)

      expect(log).not.toBeNull()
      expect(log!.phase).toBe('review')
      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.taskDescription).toContain('Review the code changes')
      expect(spawnCall.name).toContain('[review]')
    })

    it('creates review task log with active status', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.dispatchReviewPhase(task.id, run)

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs).toHaveLength(1)
      expect(logs[0].phase).toBe('review')
      expect(logs[0].status).toBe('active')
    })
  })

  // -------------------------------------------------------------------------
  // R7-B-3: Security phase dispatcher
  // -------------------------------------------------------------------------

  describe('dispatchSecurityPhase', () => {
    it('selects sec-devops for generic backend tasks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Add API route',
        description: 'REST endpoint for items',
        status: 'in_progress'
      })

      service.dispatchSecurityPhase(task.id, run)

      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.taskDescription).toContain('sec-devops')
    })

    it('selects insider-threat for auth-related tasks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Auth fix',
        description: 'Fix session token handling',
        status: 'in_progress'
      })

      service.dispatchSecurityPhase(task.id, run)

      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.taskDescription).toContain('insider-threat')
    })

    it('selects threat-defense for user-input tasks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Search',
        description: 'Handle user-input query parameters',
        status: 'in_progress'
      })

      service.dispatchSecurityPhase(task.id, run)

      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.taskDescription).toContain('threat-defense')
    })

    it('creates security task log', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.dispatchSecurityPhase(task.id, run)

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs).toHaveLength(1)
      expect(logs[0].phase).toBe('security')
      expect(logs[0].status).toBe('active')
    })
  })

  // -------------------------------------------------------------------------
  // R7-B-4: Commit + push phase
  // -------------------------------------------------------------------------

  describe('executeCommitPhase', () => {
    it('calls gitCommit with correct message format including task ID', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Add search API',
        status: 'in_progress'
      })

      const result = service.executeCommitPhase(task.id, run, false)

      expect(result).toBe(true)
      expect(deps.gitCommit).toHaveBeenCalledOnce()
      const commitMsg = (deps.gitCommit as any).mock.calls[0][1] as string
      expect(commitMsg).toContain('Add search API')
      expect(commitMsg).toContain(`task-${task.id.slice(0, 8)}`)
    })

    it('calls gitPush after commit', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.executeCommitPhase(task.id, run, false)

      expect(deps.gitStageAll).toHaveBeenCalledOnce()
      expect(deps.gitCommit).toHaveBeenCalledOnce()
      expect(deps.gitPush).toHaveBeenCalledOnce()
    })

    it('creates commit and push task logs with done status', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.executeCommitPhase(task.id, run, false)

      const logs = getTaskLogsByTask(db, task.id)
      const commitLog = logs.find((l) => l.phase === 'commit')
      const pushLog = logs.find((l) => l.phase === 'push')
      expect(commitLog?.status).toBe('done')
      expect(pushLog?.status).toBe('done')
    })

    it('updates task status to tested', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.executeCommitPhase(task.id, run, false)

      const updated = getTaskById(db, task.id)
      expect(updated!.status).toBe('tested')
    })

    it('pauses run when security blocks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      const result = service.executeCommitPhase(task.id, run, true)

      expect(result).toBe(false)
      expect(deps.gitCommit).not.toHaveBeenCalled()
      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('paused')
    })

    it('marks commit log as failed on git error', () => {
      const deps = createMockDeps({
        gitCommit: vi.fn(() => {
          throw new Error('merge conflict')
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      const result = service.executeCommitPhase(task.id, run, false)

      expect(result).toBe(false)
      const logs = getTaskLogsByTask(db, task.id)
      const commitLog = logs.find((l) => l.phase === 'commit')
      expect(commitLog?.status).toBe('failed')
    })
  })

  // -------------------------------------------------------------------------
  // R7-B-5: Phase transition coordinator
  // -------------------------------------------------------------------------

  describe('phase transitions', () => {
    it('onAgentCompleted transitions dev→review', () => {
      const mockAgent = createMockAgent()
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => mockAgent)
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      // Dispatch dev phase
      service.dispatchDevPhase(task.id, run)

      // Simulate agent completion via the event handler
      const secondAgent = createMockAgent()
      ;(deps.spawnAgent as any).mockReturnValue(secondAgent)

      // Access the private method via the event system
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: mockAgent.id } as any
      })

      const logs = getTaskLogsByTask(db, task.id)
      const devLog = logs.find((l) => l.phase === 'dev')
      const reviewLog = logs.find((l) => l.phase === 'review')
      expect(devLog?.status).toBe('done')
      expect(reviewLog?.status).toBe('active')
    })

    it('onAgentCompleted transitions review→security', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      // Dev phase
      service.dispatchDevPhase(task.id, run)
      // Complete dev → starts review
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      // Complete review → starts security
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })

      const logs = getTaskLogsByTask(db, task.id)
      const secLog = logs.find((l) => l.phase === 'security')
      expect(secLog?.status).toBe('active')
    })

    it('onAgentCompleted transitions security→commit→push→done', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      // Full lifecycle: dev → review → security → commit → push
      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs.find((l) => l.phase === 'dev')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'review')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'security')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'commit')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'push')?.status).toBe('done')
    })

    it('full lifecycle: task goes through all 5 phases and run completes', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      // Only 1 task — run should complete after it's done
      insertTask(db, { repoId: 'repo-1', title: 'Only task', status: 'backlog' })
      const tasks = service.getNextDispatchableTasks(run.id)
      const taskId = tasks[0].id

      service.dispatchDevPhase(taskId, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('completed')

      const updatedTask = getTaskById(db, taskId)
      expect(updatedTask!.status).toBe('tested')
    })

    it('onAgentFailed marks phase as failed and dispatches next tasks', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => devAgent)
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: devAgent.id } as any
      })

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs[0].status).toBe('failed')
    })

    it('tick dispatches next tasks when slots are available', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'R7-B',
        repoId: 'repo-1',
        concurrencyCap: 2,
        confirmed: true
      })
      insertTask(db, { repoId: 'repo-1', title: 'Task A', priority: 1, status: 'backlog' })
      insertTask(db, { repoId: 'repo-1', title: 'Task B', priority: 2, status: 'backlog' })

      service.tick()

      // Should have dispatched up to cap
      expect(deps.spawnAgent).toHaveBeenCalledTimes(2)
    })

    it('tick does nothing when run is paused', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', confirmed: true })
      insertTask(db, { repoId: 'repo-1', title: 'Task A', status: 'backlog' })
      service.pause(run.id)

      service.tick()

      expect(deps.spawnAgent).not.toHaveBeenCalled()
    })

    it('dispatches next task after dependency resolved', () => {
      const agentA = createMockAgent({ id: 'agent-a' })
      const agentAReview = createMockAgent({ id: 'agent-a-review' })
      const agentASec = createMockAgent({ id: 'agent-a-sec' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return agentA
          if (callCount === 2) return agentAReview
          if (callCount === 3) return agentASec
          return createMockAgent({ id: `agent-${callCount}` })
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'R7-B',
        repoId: 'repo-1',
        concurrencyCap: 3,
        confirmed: true
      })
      const tA = insertTask(db, { repoId: 'repo-1', title: 'A', priority: 1, status: 'backlog' })
      const tB = insertTask(db, { repoId: 'repo-1', title: 'B', priority: 2, status: 'backlog' })
      // B depends on A
      insertTaskDependency(db, tB.id, tA.id)

      // Initially only A should be dispatchable
      const initial = service.getNextDispatchableTasks(run.id)
      expect(initial.map((t) => t.id)).toContain(tA.id)
      expect(initial.map((t) => t.id)).not.toContain(tB.id)

      // Dispatch and complete A through all phases
      service.dispatchDevPhase(tA.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentA.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentAReview.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentASec.id } as any
      })
      // After commit+push, dispatchNextTasks should pick up B

      // Verify B was dispatched (spawnAgent called for B's dev phase)
      const spawnCalls = (deps.spawnAgent as any).mock.calls
      const bDevCall = spawnCalls.find((c: any) => c[0].name?.includes('B'))
      expect(bDevCall).toBeTruthy()
    })
  })

  // ---------------------------------------------------------------------------
  // R7-C Anamnesis integration tests
  // ---------------------------------------------------------------------------

  describe('C-3: Anamnesis event wiring', () => {
    it('inserts ORCHESTRATOR_TASK_COMMITTED event when task completes all phases', () => {
      const agentDev = createMockAgent({ id: 'agent-dev' })
      const agentReview = createMockAgent({ id: 'agent-review' })
      const agentSec = createMockAgent({ id: 'agent-sec' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return agentDev
          if (callCount === 2) return agentReview
          if (callCount === 3) return agentSec
          return createMockAgent()
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'C3-test', repoId: 'repo-1', confirmed: true })
      insertTask(db, { repoId: 'repo-1', title: 'Wire Anamnesis', priority: 1, status: 'backlog' })

      // Drive task through all phases
      service.tick()
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentDev.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentReview.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentSec.id } as any
      })

      // Verify ORCHESTRATOR_TASK_COMMITTED event was inserted
      const events = getUnsyncedEvents(db)
      const committed = events.find((e) => e.eventType === 'ORCHESTRATOR_TASK_COMMITTED')
      expect(committed).toBeTruthy()
      expect(committed!.toStatus).toBe('done')
      expect(committed!.fromStatus).toBe('push')

      const payload = JSON.parse(committed!.payloadJson)
      expect(payload.summary).toBeDefined()
      expect(payload.summary.taskTitle).toBe('Wire Anamnesis')
      expect(payload.summary.phases).toBeInstanceOf(Array)
      expect(payload.summary.debtFlags).toBeInstanceOf(Array)
    })

    it('inserts ORCHESTRATOR_SPRINT_COMPLETED event when all tasks finish', () => {
      const agentDev = createMockAgent({ id: 'agent-dev' })
      const agentReview = createMockAgent({ id: 'agent-review' })
      const agentSec = createMockAgent({ id: 'agent-sec' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return agentDev
          if (callCount === 2) return agentReview
          if (callCount === 3) return agentSec
          return createMockAgent()
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'Sprint-C3', repoId: 'repo-1', confirmed: true })
      insertTask(db, { repoId: 'repo-1', title: 'Only task', priority: 1, status: 'backlog' })

      // Complete the single task through all phases
      service.tick()
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentDev.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentReview.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentSec.id } as any
      })

      // Verify ORCHESTRATOR_SPRINT_COMPLETED event was inserted
      const events = getUnsyncedEvents(db)
      const sprintCompleted = events.find((e) => e.eventType === 'ORCHESTRATOR_SPRINT_COMPLETED')
      expect(sprintCompleted).toBeTruthy()
      expect(sprintCompleted!.fromStatus).toBe('running')
      expect(sprintCompleted!.toStatus).toBe('completed')

      expect(sprintCompleted!.taskId).toMatch(/^run:/)

      const payload = JSON.parse(sprintCompleted!.payloadJson)
      expect(payload.runId).toBeTruthy()
      expect(payload.sprintName).toBe('Sprint-C3')
      expect(payload.repoId).toBe('repo-1')
      expect(payload.taskCount).toBe(1)
      expect(payload.completedCount).toBe(1)
    })

    it('execution summary includes phases and debt flags', () => {
      const agentDev = createMockAgent({ id: 'agent-dev' })
      const agentReview = createMockAgent({ id: 'agent-review' })
      const agentSec = createMockAgent({ id: 'agent-sec' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return agentDev
          if (callCount === 2) return agentReview
          if (callCount === 3) return agentSec
          return createMockAgent()
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'C3-summary', repoId: 'repo-1', confirmed: true })
      insertTask(db, { repoId: 'repo-1', title: 'Summary test', priority: 1, status: 'backlog' })

      service.tick()

      // Inject issues into the review phase log before completing it
      const taskLogs = getTaskLogsByRun(db, run.id)
      const devLog = taskLogs.find((l) => l.phase === 'dev')
      expect(devLog).toBeTruthy()

      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentDev.id } as any
      })

      // Add issues to review log before completing review
      const logsAfterReview = getTaskLogsByRun(db, run.id)
      const reviewLog = logsAfterReview.find((l) => l.phase === 'review' && l.status === 'active')
      if (reviewLog) {
        db.prepare('UPDATE orchestrator_task_log SET issues_json = ? WHERE id = ?').run(
          JSON.stringify([
            { severity: 'medium', category: 'tech_debt', description: 'missing test coverage' }
          ]),
          reviewLog.id
        )
      }

      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentReview.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentSec.id } as any
      })

      const events = getUnsyncedEvents(db)
      const committed = events.find((e) => e.eventType === 'ORCHESTRATOR_TASK_COMMITTED')
      expect(committed).toBeTruthy()

      const payload = JSON.parse(committed!.payloadJson)
      expect(payload.summary.phases.length).toBeGreaterThanOrEqual(3)
      expect(payload.summary.issues.length).toBeGreaterThanOrEqual(1)
      expect(payload.summary.debtFlags.length).toBeGreaterThanOrEqual(1)
      expect(payload.summary.debtFlags[0].timeframe).toBe('short') // "missing test" → short
    })

    it('calls onEventInserted after inserting task events', () => {
      const agentDev = createMockAgent({ id: 'agent-dev' })
      const agentReview = createMockAgent({ id: 'agent-review' })
      const agentSec = createMockAgent({ id: 'agent-sec' })
      let callCount = 0
      const onEventInserted = vi.fn()
      const deps = createMockDeps({
        onEventInserted,
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return agentDev
          if (callCount === 2) return agentReview
          if (callCount === 3) return agentSec
          return createMockAgent()
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      service.start({ sprintName: 'Flush-test', repoId: 'repo-1', confirmed: true })
      insertTask(db, { repoId: 'repo-1', title: 'Flush task', priority: 1, status: 'backlog' })

      service.tick()
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentDev.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentReview.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: agentSec.id } as any
      })

      // onEventInserted called for ORCHESTRATOR_TASK_COMMITTED + ORCHESTRATOR_SPRINT_COMPLETED
      expect(onEventInserted).toHaveBeenCalledTimes(2)
    })
  })

  // ---------------------------------------------------------------------------
  // C1: Security output parsing — onAgentCompleted stores parsed output
  // ---------------------------------------------------------------------------

  describe('C1: security output parsing', () => {
    it('stores parsed security output in task log summaryJson', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
        getAgentOutput: vi.fn((agentId: string) => {
          if (agentId === secAgent.id) {
            return JSON.stringify({
              recommendation: 'pass',
              findings: [{ severity: 'low', category: 'style', description: 'minor naming issue' }]
            })
          }
          return null
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'C1-test', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'C1 test', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      // Security completes — should store output
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      const logs = getTaskLogsByTask(db, task.id)
      const secLog = logs.find((l) => l.phase === 'security')
      expect(secLog?.summaryJson).toBeTruthy()
      const summary = JSON.parse(secLog!.summaryJson!)
      expect(summary.recommendation).toBe('pass')
      expect(summary.findings).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // C2: Gate commit on CRITICAL findings
  // ---------------------------------------------------------------------------

  describe('C2: commit gating on CRITICAL', () => {
    it('blocks commit and pauses run when security finds CRITICAL (no loop-back for refactor)', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
        getAgentOutput: vi.fn((agentId: string) => {
          if (agentId === secAgent.id) {
            return JSON.stringify({
              recommendation: 'block',
              findings: [
                {
                  severity: 'critical',
                  category: 'injection',
                  description: 'SQL injection in query builder'
                }
              ]
            })
          }
          return null
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'C2-test', repoId: 'repo-1', confirmed: true })
      // refactor category = security-once profile, no loop-back
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'C2 test',
        category: 'refactor',
        status: 'backlog'
      })

      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      // Commit should be blocked — run paused
      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('paused')

      // gitCommit should not have been called
      expect(deps.gitCommit).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // C3: Human approval gate
  // ---------------------------------------------------------------------------

  describe('C3: security approval gate', () => {
    it('approveSecurityFindings(approved=true) proceeds to commit', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
        getAgentOutput: vi.fn((agentId: string) => {
          if (agentId === secAgent.id) {
            return JSON.stringify({
              recommendation: 'block',
              findings: [{ severity: 'critical', category: 'xss', description: 'reflected XSS' }]
            })
          }
          return null
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'C3-test', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'C3 test',
        category: 'refactor',
        status: 'backlog'
      })

      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      // Run should be paused
      expect(getRun(db, run.id)!.status).toBe('paused')

      // Approve
      service.approveSecurityFindings(run.id, task.id, true)

      // Commit should have been called
      expect(deps.gitCommit).toHaveBeenCalled()
      const updatedTask = getTaskById(db, task.id)
      expect(updatedTask!.status).toBe('tested')
    })

    it('approveSecurityFindings(approved=false) moves task to backlog', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
        getAgentOutput: vi.fn((agentId: string) => {
          if (agentId === secAgent.id) {
            return JSON.stringify({
              recommendation: 'block',
              findings: [
                { severity: 'critical', category: 'injection', description: 'SQL injection' }
              ]
            })
          }
          return null
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'C3-reject', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'C3 reject',
        category: 'refactor',
        status: 'backlog'
      })

      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      // Reject
      service.approveSecurityFindings(run.id, task.id, false)

      const updatedTask = getTaskById(db, task.id)
      expect(updatedTask!.status).toBe('backlog')
      expect(deps.gitCommit).not.toHaveBeenCalled()
    })

    it('approveSecurityFindings throws for non-existent pending approval', () => {
      const service = trackService(new KanbanOrchestratorService(db))
      const run = service.start({ sprintName: 'C3-err', repoId: 'repo-1', confirmed: true })
      expect(() => service.approveSecurityFindings(run.id, 'fake-task', true)).toThrow(
        /no pending/i
      )
    })
  })

  // ---------------------------------------------------------------------------
  // C4: Max retry count for agent failures
  // ---------------------------------------------------------------------------

  describe('C4: max retry count', () => {
    it('marks task as backlog after MAX_PHASE_RETRIES failures', () => {
      const agents = [
        createMockAgent({ id: 'batch-fail-0' }),
        createMockAgent({ id: 'batch-fail-1' }),
        createMockAgent({ id: 'batch-fail-2' })
      ]
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => agents[callCount++] ?? createMockAgent())
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'C4-test', repoId: 'repo-1', confirmed: true })
      insertTask(db, { repoId: 'repo-1', title: 'Flaky task', status: 'backlog' })

      // tick dispatches agent-0
      service.tick()
      // Fail agent-0 — onAgentFailed re-dispatches agent-1 via dispatchNextTasks
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: agents[0].id } as any
      })
      // Fail agent-1 — re-dispatches agent-2
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: agents[1].id } as any
      })
      // Fail agent-2 — max retries reached, task goes to backlog
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: agents[2].id } as any
      })

      const tasks = service.getNextDispatchableTasks(run.id)
      expect(tasks).toHaveLength(0) // permanently failed, not dispatchable

      expect(deps.spawnAgent).toHaveBeenCalledTimes(3)
    })

    it('single-task mode fails run after MAX_PHASE_RETRIES', () => {
      const agents = [
        createMockAgent({ id: 'agent-0' }),
        createMockAgent({ id: 'agent-1' }),
        createMockAgent({ id: 'agent-2' })
      ]
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => agents[callCount++] ?? createMockAgent())
      })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Single flaky', status: 'backlog' })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.startSingleTask({
        sprintName: 'C4-single',
        repoId: 'repo-1',
        singleTaskId: task.id
      })

      // startSingleTask dispatches agent-0 automatically
      // Fail it — retry 1
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: agents[0].id } as any
      })
      // dispatchNextTasks re-dispatches agent-1
      // Fail it — retry 2
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: agents[1].id } as any
      })
      // dispatchNextTasks re-dispatches agent-2
      // Fail it — retry 3 (max)
      service['onAgentFailed']({
        type: 'agent:failed',
        triageEvent: { agentId: agents[2].id } as any
      })

      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('failed')
    })
  })

  // ---------------------------------------------------------------------------
  // M1: Validate dependency IDs at start
  // ---------------------------------------------------------------------------

  describe('M1: dependency validation', () => {
    it('throws on broken dependency ID', () => {
      const service = trackService(new KanbanOrchestratorService(db))
      const task = insertTask(db, { repoId: 'repo-1', title: 'Valid task', status: 'backlog' })
      // Insert a dependency pointing to non-existent task
      db.prepare(
        'INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
      ).run(task.id, 'non-existent-id')

      expect(() =>
        service.start({ sprintName: 'M1-test', repoId: 'repo-1', confirmed: true })
      ).toThrow(/broken dependency/i)
    })

    it('passes when all dependency IDs exist', () => {
      const service = trackService(new KanbanOrchestratorService(db))
      const t1 = insertTask(db, { repoId: 'repo-1', title: 'A', status: 'backlog' })
      const t2 = insertTask(db, { repoId: 'repo-1', title: 'B', status: 'backlog' })
      insertTaskDependency(db, t2.id, t1.id)

      expect(() =>
        service.start({ sprintName: 'M1-ok', repoId: 'repo-1', confirmed: true })
      ).not.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // M2: Push error handling — push failure marks pushLog failed, not commitLog
  // ---------------------------------------------------------------------------

  describe('M2: push error separation', () => {
    it('marks pushLog as failed and commitLog as done on push error', () => {
      const deps = createMockDeps({
        gitPush: vi.fn(() => {
          throw new Error('remote rejected')
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'M2-test', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Push fail test',
        status: 'in_progress'
      })

      const result = service.executeCommitPhase(task.id, run, false)

      expect(result).toBe(false)
      const logs = getTaskLogsByTask(db, task.id)
      const commitLog = logs.find((l) => l.phase === 'commit')
      const pushLog = logs.find((l) => l.phase === 'push')
      expect(commitLog?.status).toBe('done')
      expect(pushLog?.status).toBe('failed')
    })
  })

  // ---------------------------------------------------------------------------
  // Security loop-back mechanism
  // ---------------------------------------------------------------------------

  describe('security loop-back', () => {
    it('loops task back to dev phase when CRITICAL found on full-loop category', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      const fixAgent = createMockAgent({ id: 'fix-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          if (callCount === 3) return secAgent
          return fixAgent
        }),
        getAgentOutput: vi.fn((agentId: string) => {
          if (agentId === secAgent.id) {
            return JSON.stringify({
              recommendation: 'block',
              findings: [
                { severity: 'critical', category: 'injection', description: 'SQL injection' }
              ]
            })
          }
          return null
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'loop-test', repoId: 'repo-1', confirmed: true })
      // backend category = full-loop profile
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Loop test',
        category: 'backend',
        status: 'backlog'
      })

      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      // Security completes with CRITICAL → should loop back to dev
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      // Should have spawned a fix agent (4th spawnAgent call)
      expect(deps.spawnAgent).toHaveBeenCalledTimes(4)
      const lastSpawnCall = (deps.spawnAgent as any).mock.calls[3][0]
      expect(lastSpawnCall.taskDescription).toContain('SECURITY LOOP-BACK')
      expect(lastSpawnCall.taskDescription).toContain('SQL injection')
      expect(lastSpawnCall.name).toContain('[fix-sec]')
    })
  })

  // ---------------------------------------------------------------------------
  // Category-based phase profiles — skip security for design
  // ---------------------------------------------------------------------------

  describe('category-based phase profiles', () => {
    it('skips security phase for design category', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          return reviewAgent
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'design-test', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Design task',
        category: 'design',
        status: 'backlog'
      })

      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      // Review completes — should skip security and go to commit
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })

      // Only 2 agents spawned (dev + review), no security agent
      expect(deps.spawnAgent).toHaveBeenCalledTimes(2)

      // Commit+push should have happened
      expect(deps.gitCommit).toHaveBeenCalled()
      expect(deps.gitPush).toHaveBeenCalled()

      const logs = getTaskLogsByTask(db, task.id)
      // R-005: Security phase is now logged as 'skipped' for audit trail
      expect(logs.find((l) => l.phase === 'security')?.status).toBe('skipped')
      expect(logs.find((l) => l.phase === 'commit')?.status).toBe('done')
      expect(logs.find((l) => l.phase === 'push')?.status).toBe('done')
    })

    it('runs security once for refactor category without loop-back', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const reviewAgent = createMockAgent({ id: 'review-agent' })
      const secAgent = createMockAgent({ id: 'sec-agent' })
      let callCount = 0
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => {
          callCount++
          if (callCount === 1) return devAgent
          if (callCount === 2) return reviewAgent
          return secAgent
        }),
        getAgentOutput: vi.fn((agentId: string) => {
          if (agentId === secAgent.id) {
            return JSON.stringify({
              recommendation: 'block',
              findings: [
                { severity: 'critical', category: 'xss', description: 'XSS vulnerability' }
              ]
            })
          }
          return null
        })
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'refactor-test', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, {
        repoId: 'repo-1',
        title: 'Refactor task',
        category: 'refactor',
        status: 'backlog'
      })

      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: devAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: reviewAgent.id } as any
      })
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: secAgent.id } as any
      })

      // Should NOT loop back — refactor is security-once
      // Should escalate to human (pause + pending approval)
      expect(deps.spawnAgent).toHaveBeenCalledTimes(3) // no 4th spawn for loop-back
      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('paused')
    })
  })

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------

  describe('cancel', () => {
    it('marks run as failed and cleans up active task logs', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'cancel-test', repoId: 'repo-1', confirmed: true })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Cancel me', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)
      service.cancel(run.id)

      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('failed')

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs.every((l) => l.status !== 'active')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // S3: Runtime kill-switch (persisted orchestrator.enabled flag)
  // ---------------------------------------------------------------------------

  describe('S3: runtime kill-switch', () => {
    describe('disabled (flag off)', () => {
      beforeEach(() => {
        db.prepare("DELETE FROM settings WHERE key = 'orchestrator.enabled'").run()
      })

      it('start throws ORCHESTRATOR_DISABLED and creates no run', () => {
        const service = trackService(new KanbanOrchestratorService(db))
        expect(() =>
          service.start({ sprintName: 'S3', repoId: 'repo-1', confirmed: true })
        ).toThrow(/ORCHESTRATOR_DISABLED/)
        const count = (
          db.prepare('SELECT COUNT(*) AS count FROM orchestrator_runs').get() as { count: number }
        ).count
        expect(count).toBe(0)
      })

      it('startSingleTask throws ORCHESTRATOR_DISABLED when flag is off', () => {
        const task = insertTask(db, { repoId: 'repo-1', title: 'Single task', status: 'backlog' })
        const service = trackService(new KanbanOrchestratorService(db))
        expect(() =>
          service.startSingleTask({
            sprintName: 'S3-single',
            repoId: 'repo-1',
            singleTaskId: task.id
          })
        ).toThrow(/ORCHESTRATOR_DISABLED/)
      })
    })

    it('start succeeds and returns a running run when flag is on', () => {
      enableOrchestrator()
      const service = trackService(new KanbanOrchestratorService(db))
      const run = service.start({ sprintName: 'S3-enabled', repoId: 'repo-1', confirmed: true })
      expect(run.status).toBe('running')
    })
  })

  // ---------------------------------------------------------------------------
  // S4: Pick-list confirmation gate (manual start)
  // ---------------------------------------------------------------------------

  describe('S4: pick-list confirmation gate', () => {
    it('previewRun returns scoped task entries without creating a run', () => {
      const service = trackService(new KanbanOrchestratorService(db))
      insertTask(db, {
        repoId: 'repo-1',
        title: 'R7-A task 1',
        sprintName: 'R7-A',
        priority: 1,
        status: 'backlog'
      })
      insertTask(db, {
        repoId: 'repo-1',
        title: 'R7-A task 2',
        sprintName: 'R7-A',
        priority: 2,
        status: 'backlog'
      })
      insertTask(db, {
        repoId: 'repo-1',
        title: 'R7-B task',
        sprintName: 'R7-B',
        priority: 1,
        status: 'backlog'
      })

      const preview = service.previewRun({ sprintName: 'R7-A', repoId: 'repo-1' })

      expect(preview).toHaveLength(2)
      const titles = preview.map((t) => t.title).sort()
      expect(titles).toEqual(['R7-A task 1', 'R7-A task 2'])
      for (const entry of preview) {
        expect(entry.id).toBeTruthy()
        expect(typeof entry.priority).toBe('number')
      }

      const count = (
        db.prepare('SELECT COUNT(*) AS count FROM orchestrator_runs').get() as { count: number }
      ).count
      expect(count).toBe(0)
    })

    it('start throws ORCHESTRATOR_NOT_CONFIRMED when confirmed is not true', () => {
      const service = trackService(new KanbanOrchestratorService(db))
      expect(() =>
        service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: false })
      ).toThrow(/ORCHESTRATOR_NOT_CONFIRMED/)
    })

    it('start proceeds and creates a run when confirmed is true', () => {
      const service = trackService(new KanbanOrchestratorService(db))
      const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', confirmed: true })
      expect(run.status).toBe('running')
      const count = (
        db.prepare('SELECT COUNT(*) AS count FROM orchestrator_runs').get() as { count: number }
      ).count
      expect(count).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // S5: Budget / duration cap
  // ---------------------------------------------------------------------------

  describe('S5: budget / duration cap', () => {
    it('pauses and alerts when agent budget (maxAgents) is exceeded', () => {
      const sendTelegramNotification = vi.fn()
      const deps = createMockDeps({ sendTelegramNotification })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'S5-agents',
        repoId: 'repo-1',
        telegramNotify: true,
        confirmed: true
      })
      sendTelegramNotification.mockClear() // ignore the "started" notification

      for (let i = 0; i < OPERATING_RULES.limits.maxAgents; i++) {
        const task = insertTask(db, { repoId: 'repo-1', title: `Task ${i}`, status: 'backlog' })
        service.dispatchDevPhase(task.id, run)
      }
      expect(deps.spawnAgent).toHaveBeenCalledTimes(OPERATING_RULES.limits.maxAgents)

      const extraTask = insertTask(db, { repoId: 'repo-1', title: 'Extra task', status: 'backlog' })
      const result = service.dispatchDevPhase(extraTask.id, run)

      expect(result).toBeNull()
      expect(deps.spawnAgent).toHaveBeenCalledTimes(OPERATING_RULES.limits.maxAgents)
      expect(getRun(db, run.id)!.status).toBe('paused')
      expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
      expect(sendTelegramNotification.mock.calls[0][0]).toContain('auto-paused')
    })

    it('pauses and alerts when wall-clock budget (maxWallClockMs) is exceeded', () => {
      const sendTelegramNotification = vi.fn()
      const deps = createMockDeps({ sendTelegramNotification })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({
        sprintName: 'S5-clock',
        repoId: 'repo-1',
        telegramNotify: true,
        confirmed: true
      })
      sendTelegramNotification.mockClear() // ignore the "started" notification

      const past = new Date(
        Date.now() - OPERATING_RULES.limits.maxWallClockMs - 60_000
      ).toISOString()
      db.prepare('UPDATE orchestrator_runs SET started_at = ? WHERE id = ?').run(past, run.id)

      const task = insertTask(db, { repoId: 'repo-1', title: 'Clock task', status: 'backlog' })
      const result = service.dispatchDevPhase(task.id, run)

      expect(result).toBeNull()
      expect(deps.spawnAgent).not.toHaveBeenCalled()
      expect(getRun(db, run.id)!.status).toBe('paused')
      expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
      expect(sendTelegramNotification.mock.calls[0][0]).toContain('auto-paused')
    })

    it('tracks spawns exactly once per spawn (no double-count)', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'S5-count', repoId: 'repo-1', confirmed: true })

      for (let i = 0; i < OPERATING_RULES.limits.maxAgents - 1; i++) {
        const task = insertTask(db, { repoId: 'repo-1', title: `Task ${i}`, status: 'backlog' })
        service.dispatchDevPhase(task.id, run)
      }

      // The maxAgents-th spawn is still allowed (counter is exactly maxAgents - 1)
      const lastTask = insertTask(db, {
        repoId: 'repo-1',
        title: 'Last allowed',
        status: 'backlog'
      })
      expect(service.dispatchDevPhase(lastTask.id, run)).not.toBeNull()
      expect(deps.spawnAgent).toHaveBeenCalledTimes(OPERATING_RULES.limits.maxAgents)

      // The (maxAgents + 1)-th spawn is blocked (counter is exactly maxAgents)
      const overflowTask = insertTask(db, {
        repoId: 'repo-1',
        title: 'Overflow',
        status: 'backlog'
      })
      expect(service.dispatchDevPhase(overflowTask.id, run)).toBeNull()
      expect(deps.spawnAgent).toHaveBeenCalledTimes(OPERATING_RULES.limits.maxAgents)
    })
  })

  // ---------------------------------------------------------------------------
  // R-012: tick() S72 kill-switch auto-pause
  // ---------------------------------------------------------------------------

  describe('tick() S72 kill-switch', () => {
    it('auto-pauses a running run when kill-switch is disabled at runtime', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'S72-tick', repoId: 'repo-1', confirmed: true })
      expect(run.status).toBe('running')

      // Disable orchestrator at runtime
      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orchestrator.enabled'").run()

      // tick() should auto-pause and clear timer
      service.tick()
      const updated = getRun(db, run.id)
      expect(updated!.status).toBe('paused')
    })

    it('clears tick timer even if pause throws', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      service.start({ sprintName: 'S72-throw', repoId: 'repo-1', confirmed: true })

      // Remove the run row to make pause() throw (run not found)
      db.prepare('DELETE FROM orchestrator_runs').run()
      // Re-insert a running run that pause() will fail on (missing the expected state)
      db.prepare(
        "INSERT INTO orchestrator_runs (id, sprint_name, repo_id, status, concurrency_cap, created_at, updated_at) VALUES ('bad-run', 'bad', 'repo-1', 'running', 3, datetime('now'), datetime('now'))"
      ).run()

      // Disable orchestrator
      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orchestrator.enabled'").run()

      // tick() should not throw — the try-catch protects it
      expect(() => service.tick()).not.toThrow()
    })
  })
})
