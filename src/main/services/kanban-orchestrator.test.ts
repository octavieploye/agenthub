import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { KanbanOrchestratorService, type OrchestratorDeps } from './kanban-orchestrator'
import { getRun, insertTaskLog, updateTaskLogStatus, getTaskLogsByRun, getTaskLogsByTask } from '../db/queries/orchestrator.queries'
import { insertTask, getTaskById, updateTask } from '../db/queries/tasks.queries'
import { insertTaskDependency } from '../db/queries/task-dependencies.queries'
import type { AgentState } from '../../shared/types/agent.types'

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
    ...overrides,
  }
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  db.prepare("INSERT INTO repos (id, name, path, created_at, last_used_at) VALUES ('repo-1', 'test', '/tmp/test', datetime('now'), datetime('now'))").run()
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
      telegramNotify: false
    })

    expect(run.status).toBe('running')
    expect(run.sprintName).toBe('R7-A')
    expect(run.startedAt).toBeTruthy()
  })

  it('start throws if a run is already running', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    expect(() =>
      service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
    ).toThrow(/already running/i)
  })

  it('pause sets status to paused', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    service.pause(run.id)
    const updated = getRun(db, run.id)
    expect(updated?.status).toBe('paused')
  })

  it('resume sets status back to running', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
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
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    const status = service.getStatus()
    expect(status.run?.id).toBe(run.id)
  })

  it('getTaskLog returns logs for a task', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })
    insertTaskLog(db, { runId: run.id, taskId: task.id, phase: 'dev' })
    const logs = service.getTaskLog(task.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].phase).toBe('dev')
  })

  it('getNextDispatchableTasks returns unblocked tasks by priority', () => {
    const service = trackService(new KanbanOrchestratorService(db))
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', concurrencyCap: 2 })
    const t1 = insertTask(db, { repoId: 'repo-1', title: 'Task 1', priority: 1, status: 'backlog' })
    const t2 = insertTask(db, { repoId: 'repo-1', title: 'Task 2', priority: 2, status: 'backlog' })
    const t3 = insertTask(db, { repoId: 'repo-1', title: 'Task 3', priority: 1, status: 'backlog' })
    insertTaskDependency(db, t3.id, t1.id)

    const dispatchable = service.getNextDispatchableTasks(run.id)
    const ids = dispatchable.map(t => t.id)
    expect(ids).toContain(t1.id)
    expect(ids).toContain(t2.id)
    expect(ids).not.toContain(t3.id)
  })

  // -------------------------------------------------------------------------
  // R7-B-1: Dev phase dispatcher
  // -------------------------------------------------------------------------

  describe('dispatchDevPhase', () => {
    it('spawns agent with correct model and creates task log', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Build auth module', status: 'backlog' })

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
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
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
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)

      const updated = getTaskById(db, task.id)
      expect(updated!.status).toBe('in_progress')
    })

    it('uses Anthropic for dev phase', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs[0].providerUsed).toBe('anthropic')
    })

    it('returns null when no deps injected', () => {
      const service = trackService(new KanbanOrchestratorService(db)) // no deps
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
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
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Auth module', description: 'Add JWT auth', status: 'in_progress' })

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
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
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
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Add API route', description: 'REST endpoint for items', status: 'in_progress' })

      service.dispatchSecurityPhase(task.id, run)

      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.taskDescription).toContain('sec-devops')
    })

    it('selects insider-threat for auth-related tasks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Auth fix', description: 'Fix session token handling', status: 'in_progress' })

      service.dispatchSecurityPhase(task.id, run)

      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.taskDescription).toContain('insider-threat')
    })

    it('selects threat-defense for user-input tasks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Search', description: 'Handle user-input query parameters', status: 'in_progress' })

      service.dispatchSecurityPhase(task.id, run)

      const spawnCall = (deps.spawnAgent as any).mock.calls[0][0]
      expect(spawnCall.taskDescription).toContain('threat-defense')
    })

    it('creates security task log', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
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
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Add search API', status: 'in_progress' })

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
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.executeCommitPhase(task.id, run, false)

      expect(deps.gitStageAll).toHaveBeenCalledOnce()
      expect(deps.gitCommit).toHaveBeenCalledOnce()
      expect(deps.gitPush).toHaveBeenCalledOnce()
    })

    it('creates commit and push task logs with done status', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.executeCommitPhase(task.id, run, false)

      const logs = getTaskLogsByTask(db, task.id)
      const commitLog = logs.find(l => l.phase === 'commit')
      const pushLog = logs.find(l => l.phase === 'push')
      expect(commitLog?.status).toBe('done')
      expect(pushLog?.status).toBe('done')
    })

    it('updates task status to tested', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      service.executeCommitPhase(task.id, run, false)

      const updated = getTaskById(db, task.id)
      expect(updated!.status).toBe('tested')
    })

    it('pauses run when security blocks', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      const result = service.executeCommitPhase(task.id, run, true)

      expect(result).toBe(false)
      expect(deps.gitCommit).not.toHaveBeenCalled()
      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('paused')
    })

    it('marks commit log as failed on git error', () => {
      const deps = createMockDeps({
        gitCommit: vi.fn(() => { throw new Error('merge conflict') }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'in_progress' })

      const result = service.executeCommitPhase(task.id, run, false)

      expect(result).toBe(false)
      const logs = getTaskLogsByTask(db, task.id)
      const commitLog = logs.find(l => l.phase === 'commit')
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
        spawnAgent: vi.fn(() => mockAgent),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      // Dispatch dev phase
      service.dispatchDevPhase(task.id, run)

      // Simulate agent completion via the event handler
      const secondAgent = createMockAgent()
      ;(deps.spawnAgent as any).mockReturnValue(secondAgent)

      // Access the private method via the event system
      service['onAgentCompleted']({
        type: 'agent:completed',
        triageEvent: { agentId: mockAgent.id } as any,
      })

      const logs = getTaskLogsByTask(db, task.id)
      const devLog = logs.find(l => l.phase === 'dev')
      const reviewLog = logs.find(l => l.phase === 'review')
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
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      // Dev phase
      service.dispatchDevPhase(task.id, run)
      // Complete dev → starts review
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: devAgent.id } as any })
      // Complete review → starts security
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: reviewAgent.id } as any })

      const logs = getTaskLogsByTask(db, task.id)
      const secLog = logs.find(l => l.phase === 'security')
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
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      // Full lifecycle: dev → review → security → commit → push
      service.dispatchDevPhase(task.id, run)
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: devAgent.id } as any })
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: reviewAgent.id } as any })
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: secAgent.id } as any })

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs.find(l => l.phase === 'dev')?.status).toBe('done')
      expect(logs.find(l => l.phase === 'review')?.status).toBe('done')
      expect(logs.find(l => l.phase === 'security')?.status).toBe('done')
      expect(logs.find(l => l.phase === 'commit')?.status).toBe('done')
      expect(logs.find(l => l.phase === 'push')?.status).toBe('done')
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
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      // Only 1 task — run should complete after it's done
      insertTask(db, { repoId: 'repo-1', title: 'Only task', status: 'backlog' })
      const tasks = service.getNextDispatchableTasks(run.id)
      const taskId = tasks[0].id

      service.dispatchDevPhase(taskId, run)
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: devAgent.id } as any })
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: reviewAgent.id } as any })
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: secAgent.id } as any })

      const updatedRun = getRun(db, run.id)
      expect(updatedRun!.status).toBe('completed')

      const updatedTask = getTaskById(db, taskId)
      expect(updatedTask!.status).toBe('tested')
    })

    it('onAgentFailed marks phase as failed and dispatches next tasks', () => {
      const devAgent = createMockAgent({ id: 'dev-agent' })
      const deps = createMockDeps({
        spawnAgent: vi.fn(() => devAgent),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
      const task = insertTask(db, { repoId: 'repo-1', title: 'Test', status: 'backlog' })

      service.dispatchDevPhase(task.id, run)
      service['onAgentFailed']({ type: 'agent:failed', triageEvent: { agentId: devAgent.id } as any })

      const logs = getTaskLogsByTask(db, task.id)
      expect(logs[0].status).toBe('failed')
    })

    it('tick dispatches next tasks when slots are available', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', concurrencyCap: 2 })
      insertTask(db, { repoId: 'repo-1', title: 'Task A', priority: 1, status: 'backlog' })
      insertTask(db, { repoId: 'repo-1', title: 'Task B', priority: 2, status: 'backlog' })

      service.tick()

      // Should have dispatched up to cap
      expect(deps.spawnAgent).toHaveBeenCalledTimes(2)
    })

    it('tick does nothing when run is paused', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
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
        }),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const run = service.start({ sprintName: 'R7-B', repoId: 'repo-1', concurrencyCap: 3 })
      const tA = insertTask(db, { repoId: 'repo-1', title: 'A', priority: 1, status: 'backlog' })
      const tB = insertTask(db, { repoId: 'repo-1', title: 'B', priority: 2, status: 'backlog' })
      // B depends on A
      insertTaskDependency(db, tB.id, tA.id)

      // Initially only A should be dispatchable
      const initial = service.getNextDispatchableTasks(run.id)
      expect(initial.map(t => t.id)).toContain(tA.id)
      expect(initial.map(t => t.id)).not.toContain(tB.id)

      // Dispatch and complete A through all phases
      service.dispatchDevPhase(tA.id, run)
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: agentA.id } as any })
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: agentAReview.id } as any })
      service['onAgentCompleted']({ type: 'agent:completed', triageEvent: { agentId: agentASec.id } as any })
      // After commit+push, dispatchNextTasks should pick up B

      // Verify B was dispatched (spawnAgent called for B's dev phase)
      const spawnCalls = (deps.spawnAgent as any).mock.calls
      const bDevCall = spawnCalls.find((c: any) => c[0].name?.includes('B'))
      expect(bDevCall).toBeTruthy()
    })
  })
})
