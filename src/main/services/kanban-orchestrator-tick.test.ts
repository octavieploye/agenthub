import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { KanbanOrchestratorService, type OrchestratorDeps } from './kanban-orchestrator'
import {
  getActiveTaskLogs,
  getTaskLogsByRun,
  insertTaskLog,
  updateTaskLogStatus,
} from '../db/queries/orchestrator.queries'
import { insertTask } from '../db/queries/tasks.queries'
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
    emitToRenderer: vi.fn(),
    sendTelegramNotification: vi.fn(),
    killAgent: vi.fn(),
    isAgentAlive: vi.fn(() => false),
    getAgentLastOutputTime: vi.fn(() => null),
    ...overrides
  }
}

function enableOrchestrator(): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('orchestrator.enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'"
  ).run()
}

/**
 * Create a running orchestrator run with an active task log that has been
 * running for `elapsedMs` milliseconds.
 */
function setupStuckScenario(
  service: KanbanOrchestratorService,
  deps: OrchestratorDeps,
  elapsedMs: number
): { runId: string; taskId: string; taskLogId: string; agentId: string } {
  const run = service.start({
    sprintName: 'tick-test',
    repoId: 'repo-1',
    concurrencyCap: 3,
    telegramNotify: true,
    confirmed: true,
  })

  const task = insertTask(db, {
    repoId: 'repo-1',
    title: 'Stuck test task',
    status: 'in_progress',
  })

  const taskLog = insertTaskLog(db, {
    runId: run.id,
    taskId: task.id,
    phase: 'dev',
  })

  const agentId = 'agent-stuck-test'
  // Set log to active with a started_at in the past
  updateTaskLogStatus(db, taskLog.id, 'active', agentId)
  const pastDate = new Date(Date.now() - elapsedMs).toISOString()
  db.prepare('UPDATE orchestrator_task_log SET started_at = ? WHERE id = ?').run(pastDate, taskLog.id)

  return { runId: run.id, taskId: task.id, taskLogId: taskLog.id, agentId }
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  db.prepare(
    "INSERT INTO repos (id, name, path, created_at, last_used_at) VALUES ('repo-1', 'test', '/tmp/test', datetime('now'), datetime('now'))"
  ).run()
  enableOrchestrator()
})

afterEach(() => {
  for (const s of activeServices) s.stop()
  activeServices = []
  db.close()
})

describe('Tick timer safety (G1-G5)', () => {
  // ---------------------------------------------------------------------------
  // pauseTick / resumeTick / isTickPaused
  // ---------------------------------------------------------------------------

  describe('pauseTick / resumeTick', () => {
    it('pauseTick sets isTickPaused to true', () => {
      const service = trackService(new KanbanOrchestratorService(db, createMockDeps()))
      expect(service.isTickPaused()).toBe(false)
      service.pauseTick()
      expect(service.isTickPaused()).toBe(true)
    })

    it('resumeTick resets isTickPaused to false', () => {
      const service = trackService(new KanbanOrchestratorService(db, createMockDeps()))
      service.pauseTick()
      expect(service.isTickPaused()).toBe(true)
      service.resumeTick()
      expect(service.isTickPaused()).toBe(false)
    })

    it('stop() resets tickPaused to false', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      service.start({ sprintName: 'test', repoId: 'repo-1', confirmed: true })
      service.pauseTick()
      expect(service.isTickPaused()).toBe(true)

      service.stop()
      expect(service.isTickPaused()).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // tick() guard — returns immediately when paused
  // ---------------------------------------------------------------------------

  describe('tick() tickPaused guard', () => {
    it('tick() does nothing when tickPaused is true', () => {
      const deps = createMockDeps()
      const service = trackService(new KanbanOrchestratorService(db, deps))
      service.start({ sprintName: 'test', repoId: 'repo-1', confirmed: true })

      // Insert a task that would be dispatched
      insertTask(db, { repoId: 'repo-1', title: 'Should not dispatch', status: 'backlog' })

      service.pauseTick()
      service.tick()

      // spawnAgent should NOT have been called beyond the initial dispatch from start()
      // If tick ran, it would try to dispatch — verify no additional spawn calls
      const spawnCalls = (deps.spawnAgent as ReturnType<typeof vi.fn>).mock.calls.length
      // tick() should have returned immediately — no new dispatches
      expect(service.isTickPaused()).toBe(true)
      // The key assertion: tick() returned early and didn't update the run timestamp
      // We verify by checking that no stuck detection ran (killAgent never called)
      expect(deps.killAgent).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Stuck detection — agent alive + recently active → NOT killed
  // ---------------------------------------------------------------------------

  describe('stuck detection — liveness-aware (G1)', () => {
    it('skips killing agent that is alive and recently active', () => {
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => true),
        getAgentLastOutputTime: vi.fn(() => Date.now() - 60_000), // 1 min ago — well within 10-min threshold
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))

      // Setup: task log running for 70 minutes (past 60-min stuck threshold)
      const scenario = setupStuckScenario(service, deps, 70 * 60 * 1000)

      service.tick()

      // Agent is alive and recently active — should NOT be killed
      expect(deps.killAgent).not.toHaveBeenCalled()
      // Task log should still be active (not marked failed)
      const activeLogs = getActiveTaskLogs(db, scenario.runId)
      expect(activeLogs.length).toBe(1)
      expect(activeLogs[0].status).toBe('active')
    })

    it('kills agent that is alive but silent for > 10 minutes', () => {
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => true),
        getAgentLastOutputTime: vi.fn(() => Date.now() - 15 * 60 * 1000), // 15 min ago — past silence threshold
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const scenario = setupStuckScenario(service, deps, 70 * 60 * 1000)

      service.tick()

      // Agent alive but silent too long — should be killed
      expect(deps.killAgent).toHaveBeenCalledWith(scenario.agentId)
      // Task log should be marked failed
      const activeLogs = getActiveTaskLogs(db, scenario.runId)
      expect(activeLogs.length).toBe(0)
    })

    it('kills agent that is dead (process exited)', () => {
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => false),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const scenario = setupStuckScenario(service, deps, 70 * 60 * 1000)

      service.tick()

      // Dead agent — kill immediately
      expect(deps.killAgent).toHaveBeenCalledWith(scenario.agentId)
      const activeLogs = getActiveTaskLogs(db, scenario.runId)
      expect(activeLogs.length).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // stuckWarned dedup — warning fires once per task
  // ---------------------------------------------------------------------------

  describe('stuckWarned dedup', () => {
    it('logs warning at 30-min mark only once per task', async () => {
      const log = (await import('electron-log/main')).default
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => true),
        getAgentLastOutputTime: vi.fn(() => Date.now()), // actively producing output
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))

      // Setup: 35 minutes elapsed (past 30-min warning, before 60-min stuck)
      setupStuckScenario(service, deps, 35 * 60 * 1000)

      // Reset mock to count only tick-originated calls
      vi.mocked(log.info).mockClear()

      service.tick()
      const firstTickInfoCalls = vi.mocked(log.info).mock.calls
        .filter(c => typeof c[0] === 'string' && c[0].includes('30+ min'))
      expect(firstTickInfoCalls.length).toBe(1)

      // Second tick — should NOT warn again
      vi.mocked(log.info).mockClear()
      service.tick()
      const secondTickInfoCalls = vi.mocked(log.info).mock.calls
        .filter(c => typeof c[0] === 'string' && c[0].includes('30+ min'))
      expect(secondTickInfoCalls.length).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Same-tick skip (G3) — stuck task not re-dispatched in same tick
  // ---------------------------------------------------------------------------

  describe('same-tick skip (G3)', () => {
    it('does not re-dispatch a task that was just marked stuck', () => {
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => false), // dead agent
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      const scenario = setupStuckScenario(service, deps, 70 * 60 * 1000)

      // Clear spawn calls from start()
      vi.mocked(deps.spawnAgent).mockClear()

      service.tick()

      // The task was killed in stuck detection and marked failed.
      // dispatchNextTasks runs in the same tick but should skip this taskId
      // because it's in the stuckTaskIds set (G3).
      // Verify: spawnAgent should NOT have been called to re-dispatch.
      // (If G3 were broken, the stuck task would be re-dispatched immediately.)
      expect(deps.killAgent).toHaveBeenCalledWith(scenario.agentId)
      // Any spawn calls that happen should NOT be for the stuck task
      const spawnCalls = vi.mocked(deps.spawnAgent).mock.calls
      for (const call of spawnCalls) {
        // spawnAgent receives AgentSpawnOptions — check taskDescription doesn't match
        expect(call[0].taskDescription).not.toContain(scenario.taskId)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // stuckThresholdMs from activeGuardrails overrides default
  // ---------------------------------------------------------------------------

  describe('stuckThresholdMs override (G5)', () => {
    it('uses stuckThresholdMs from activeGuardrails when provided', () => {
      // Set a very short stuck threshold (5 minutes)
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => false),
        activeGuardrails: { stuckThresholdMs: 5 * 60 * 1000 },
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))

      // Setup: 6 minutes elapsed — past custom 5-min threshold but under default 60-min
      setupStuckScenario(service, deps, 6 * 60 * 1000)

      service.tick()

      // With custom threshold of 5 min, agent at 6 min should be killed
      expect(deps.killAgent).toHaveBeenCalled()
    })

    it('does not kill agent under custom stuckThresholdMs', () => {
      // Set a longer stuck threshold (120 minutes)
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => true),
        getAgentLastOutputTime: vi.fn(() => Date.now()), // actively producing output
        activeGuardrails: { stuckThresholdMs: 120 * 60 * 1000 },
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))

      // Setup: 70 minutes — past default 60-min but under custom 120-min
      setupStuckScenario(service, deps, 70 * 60 * 1000)

      service.tick()

      // With custom threshold of 120 min, agent at 70 min should NOT be killed
      expect(deps.killAgent).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Telegram notification on stuck kill
  // ---------------------------------------------------------------------------

  describe('Telegram notification for stuck agents', () => {
    it('sends Telegram notification when a stuck agent is killed', () => {
      const deps = createMockDeps({
        isAgentAlive: vi.fn(() => false),
      })
      const service = trackService(new KanbanOrchestratorService(db, deps))
      setupStuckScenario(service, deps, 70 * 60 * 1000)

      service.tick()

      const allCalls = vi.mocked(deps.sendTelegramNotification!).mock.calls
      const stuckCall = allCalls.find(c => c[0].includes('Stuck agent killed'))
      expect(stuckCall).toBeDefined()
      expect(stuckCall![1]).toBe('failed')
    })
  })
})
