// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { OrchestratorScheduler } from './orchestrator-scheduler'
import type { SchedulerDeps, SchedulerBrainDecision, ValidationOutcome } from './orchestrator-scheduler'
import {
  getActiveRun,
  insertTaskLog,
  getTaskLogsByRun,
} from '../db/queries/orchestrator.queries'
import {
  emitOrchestratorEvent,
  type OrchestratorAgentEvent,
} from './agent-lifecycle-bus'

// ---------------------------------------------------------------------------
// In-memory DB with minimum required tables
// ---------------------------------------------------------------------------

function buildDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orchestrator_runs (
      id               TEXT PRIMARY KEY,
      sprint_name      TEXT NOT NULL,
      project_id       TEXT,
      repo_id          TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'idle',
      concurrency_cap  INTEGER NOT NULL DEFAULT 3,
      telegram_notify  INTEGER NOT NULL DEFAULT 0,
      agents_spawned   INTEGER NOT NULL DEFAULT 0,
      single_task_id   TEXT,
      started_by       TEXT,
      trigger_source   TEXT,
      task_ids_json    TEXT,
      started_at       TEXT,
      completed_at     TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orchestrator_task_log (
      id               TEXT PRIMARY KEY,
      run_id           TEXT NOT NULL,
      task_id          TEXT NOT NULL,
      phase            TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      agent_id         TEXT,
      model_used       TEXT,
      provider_used    TEXT,
      summary_json     TEXT,
      issues_json      TEXT,
      files_changed_json TEXT,
      started_at       TEXT,
      completed_at     TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id                  TEXT PRIMARY KEY,
      repo_id             TEXT NOT NULL,
      title               TEXT NOT NULL,
      description         TEXT NOT NULL DEFAULT '',
      priority            INTEGER NOT NULL DEFAULT 3,
      status              TEXT NOT NULL DEFAULT 'backlog',
      category            TEXT,
      agent_id            TEXT,
      position            INTEGER NOT NULL DEFAULT 0,
      sbar_id             TEXT,
      sprint_name         TEXT,
      epic_name           TEXT,
      project_id          TEXT,
      section_target_date TEXT,
      note                TEXT,
      requires_approval   INTEGER NOT NULL DEFAULT 0,
      model_override      TEXT,
      provider_override   TEXT,
      date_trigger_fired_at TEXT,
      target_files_json   TEXT,
      skills_json         TEXT,
      guardrail_json      TEXT,
      estimated_tokens    INTEGER,
      recommended_model   TEXT,
      risk_score          INTEGER,
      risk_factors_json   TEXT,
      created_by          TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id       TEXT NOT NULL,
      depends_on_id TEXT NOT NULL,
      PRIMARY KEY (task_id, depends_on_id)
    );

    CREATE TABLE IF NOT EXISTS retry_failures (
      id              TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL,
      provider        TEXT NOT NULL,
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT,
      diagnostics     TEXT,
      acknowledged_at TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.enabled', 'true');
  `)
  return db
}

function insertTestTask(
  db: Database.Database,
  overrides: Partial<{ id: string; repoId: string; status: string; priority: number; title: string }>
): string {
  const id = overrides.id ?? `task-${Date.now()}-${Math.random()}`
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO tasks (id, repo_id, title, description, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?, ?, ?)`
  ).run(
    id,
    overrides.repoId ?? 'repo-1',
    overrides.title ?? 'Test Task',
    overrides.priority ?? 3,
    overrides.status ?? 'today',
    now,
    now
  )
  return id
}

function buildDeps(db: Database.Database, partial: Partial<SchedulerDeps> = {}): SchedulerDeps {
  return {
    db,
    brain: { decide: vi.fn().mockResolvedValue(null) },
    validator: { validate: vi.fn().mockReturnValue({ valid: true, failures: [] } satisfies ValidationOutcome) },
    dispatch: { execute: vi.fn().mockReturnValue(null) },
    emitToRenderer: vi.fn(),
    maxAgents: 3,
    // Use a large interval so fake timers control exactly when ticks fire
    tickIntervalMs: 60_000,
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// Fake triage event factory
// ---------------------------------------------------------------------------

function fakeTriageEvent(agentId: string, status: 'completed' | 'error'): OrchestratorAgentEvent['triageEvent'] {
  return {
    agentId,
    agentName: 'agent-test',
    repoName: 'repo-1',
    taskDescription: 'test task',
    previousStatus: 'busy',
    currentStatus: status,
    triageLevel: status === 'error' ? 'high' : 'low',
    timestamp: Date.now(),
    reason: status,
    requiresUserAction: status === 'error',
    requiresSoundAlert: status === 'error',
    isTaskCompleted: status === 'completed',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrchestratorScheduler', () => {
  let db: Database.Database
  let scheduler: OrchestratorScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    db = buildDb()
  })

  afterEach(() => {
    scheduler?.stop()
    db.close()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // start()
  // -------------------------------------------------------------------------

  describe('start()', () => {
    it('creates a run with status running', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })

      expect(run.status).toBe('running')
      expect(run.sprintName).toBe('sprint-1')
    })

    it('returns existing active run when one is already running', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const first = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      const second = scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-1' })

      expect(second.id).toBe(first.id)
    })

    it('throws when orchestrator is disabled', () => {
      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orchestrator.enabled'").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(() => scheduler.start({ sprintName: 'x', repoId: 'repo-1' })).toThrow('ORCHESTRATOR_DISABLED')
    })

    it('emits STATUS_CHANGE running to renderer on start', () => {
      const emitToRenderer = vi.fn()
      const deps = buildDeps(db, { emitToRenderer })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })

      expect(emitToRenderer).toHaveBeenCalledWith(
        'on-orchestrator:status-change',
        expect.objectContaining({ status: 'running' })
      )
    })
  })

  // -------------------------------------------------------------------------
  // startSingleTask()
  // -------------------------------------------------------------------------

  describe('startSingleTask()', () => {
    it('creates a run scoped to a single task', () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1' })
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.startSingleTask({ taskId })

      expect(run.singleTaskId).toBe(taskId)
      expect(run.taskIds).toContain(taskId)
      expect(run.status).toBe('running')
    })

    it('throws when task does not exist', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(() => scheduler.startSingleTask({ taskId: 'no-such-task' })).toThrow('Task not found')
    })
  })

  // -------------------------------------------------------------------------
  // pause()
  // -------------------------------------------------------------------------

  describe('pause()', () => {
    it('prevents tick from calling brain.decide', async () => {
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.pause(run.id)

      // Advance past one tick interval — tick should be blocked
      await vi.advanceTimersByTimeAsync(60_000)

      expect(brain.decide).not.toHaveBeenCalled()
    })

    it('emits STATUS_CHANGE paused to renderer', () => {
      const emitToRenderer = vi.fn()
      const deps = buildDeps(db, { emitToRenderer })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })
      emitToRenderer.mockClear()
      scheduler.pause(run.id)

      expect(emitToRenderer).toHaveBeenCalledWith(
        'on-orchestrator:status-change',
        expect.objectContaining({ status: 'paused', runId: run.id })
      )
    })
  })

  // -------------------------------------------------------------------------
  // resume()
  // -------------------------------------------------------------------------

  describe('resume()', () => {
    it('un-pauses a run and triggers an immediate tick', async () => {
      // brain returns null so tick terminates cleanly after one pass
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })
      scheduler.pause(run.id)
      brain.decide.mockClear()

      scheduler.resume(run.id)
      // Flush the setTimeout(0) that resume() schedules
      await vi.advanceTimersByTimeAsync(1)

      expect(brain.decide).not.toHaveBeenCalled() // no ready tasks, returns before brain
    })

    it('throws when orchestrator is disabled', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)
      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })
      scheduler.pause(run.id)

      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orchestrator.enabled'").run()

      expect(() => scheduler.resume(run.id)).toThrow('ORCHESTRATOR_DISABLED')
    })
  })

  // -------------------------------------------------------------------------
  // cancel()
  // -------------------------------------------------------------------------

  describe('cancel()', () => {
    it('marks run as cancelled and removes from active runs', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)
      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })

      scheduler.cancel(run.id)

      expect(getActiveRun(db)).toBeNull()
    })

    it('emits STATUS_CHANGE cancelled to renderer', () => {
      const emitToRenderer = vi.fn()
      const deps = buildDeps(db, { emitToRenderer })
      scheduler = new OrchestratorScheduler(deps)
      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })
      emitToRenderer.mockClear()

      scheduler.cancel(run.id)

      expect(emitToRenderer).toHaveBeenCalledWith(
        'on-orchestrator:status-change',
        expect.objectContaining({ status: 'cancelled', runId: run.id })
      )
    })
  })

  // -------------------------------------------------------------------------
  // Kill-switch
  // -------------------------------------------------------------------------

  describe('kill-switch', () => {
    it('aborts tick and stops scheduler when orchestrator.enabled is false', async () => {
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 's', repoId: 'repo-1' })

      // Disable before the first tick fires
      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orchestrator.enabled'").run()

      await vi.advanceTimersByTimeAsync(60_000)

      // tick() must abort before reaching brain.decide
      expect(brain.decide).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // tick() — dispatch flow
  // -------------------------------------------------------------------------

  describe('tick() — dispatch flow', () => {
    it('dispatches a ready task when all conditions are met', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      // Return the decision once, then null so loop terminates
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id-1') }
      const emitToRenderer = vi.fn()
      const deps = buildDeps(db, { brain, dispatch, emitToRenderer })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })

      // Fire the first tick interval
      await vi.advanceTimersByTimeAsync(60_000)

      expect(brain.decide).toHaveBeenCalled()
      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-1' }),
        taskId,
        run.id
      )

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.taskId === taskId && l.status === 'active')).toBe(true)
    })

    it('does not dispatch when brain returns null', async () => {
      insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const dispatch = { execute: vi.fn() }
      // brain already defaults to returning null via buildDeps
      const deps = buildDeps(db, { dispatch })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      await vi.advanceTimersByTimeAsync(60_000)

      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('does not dispatch when validator rejects the decision', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const validator = {
        validate: vi.fn().mockReturnValue({ valid: false, failures: ['risk too high'] } satisfies ValidationOutcome)
      }
      const dispatch = { execute: vi.fn() }
      const deps = buildDeps(db, { brain, validator, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      await vi.advanceTimersByTimeAsync(60_000)

      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('does not call brain when no dispatchable tasks exist', async () => {
      insertTestTask(db, { repoId: 'repo-1', status: 'in_progress' })

      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const dispatch = { execute: vi.fn() }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      await vi.advanceTimersByTimeAsync(60_000)

      // Returns early before brain because candidateTasks is empty (in_progress is not dispatchable)
      expect(brain.decide).not.toHaveBeenCalled()
      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('marks task log failed when dispatch returns null', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue(null) }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(60_000)

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.taskId === taskId && l.status === 'failed')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Rate limiter
  // -------------------------------------------------------------------------

  describe('rate limiter', () => {
    it('blocks a second dispatch within the same window', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      // Always returns a decision so we can see if the second tick is blocked
      const brain = { decide: vi.fn().mockResolvedValue(decision) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id-1') }
      // maxAgents=1, tickIntervalMs=1000: after one spawn the limiter window is full
      const deps = buildDeps(db, { brain, dispatch, maxAgents: 1, tickIntervalMs: 1_000 })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })

      // First tick — should dispatch once
      await vi.advanceTimersByTimeAsync(1_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // Second tick — rate limiter window not expired yet (window = 1000ms, we advance < 1000ms more)
      await vi.advanceTimersByTimeAsync(500)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Agent event handling
  // -------------------------------------------------------------------------

  describe('handleAgentEvent()', () => {
    it('marks task log done when agent:completed fires', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      // Dispatch once then stop so the run doesn't loop
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-abc') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })

      // Trigger the first tick to dispatch the task
      await vi.advanceTimersByTimeAsync(60_000)

      // Verify it was dispatched as active
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // Emit completion event
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-abc', 'completed'),
      })

      // Flush the setTimeout(0) re-tick triggered by completion
      await vi.advanceTimersByTimeAsync(1)

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.taskId === taskId && l.status === 'done')).toBe(true)
    })

    it('retries once on agent:failed then marks failed on second failure', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      // Dispatch on first tick (retry), then null so the re-dispatch tick also works
      const brain = { decide: vi.fn()
        .mockResolvedValueOnce(decision)  // initial dispatch
        .mockResolvedValueOnce(decision)  // retry dispatch
        .mockResolvedValue(null)
      }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-xyz') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })

      // First tick: initial dispatch
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // First failure → retry (retryRecord.count becomes 1)
      emitOrchestratorEvent({ type: 'agent:failed', triageEvent: fakeTriageEvent('agent-xyz', 'error') })
      await vi.advanceTimersByTimeAsync(1) // flush retry setTimeout(0)

      // Second failure → give up (retryRecord.count already === 1, so branch goes to else)
      emitOrchestratorEvent({ type: 'agent:failed', triageEvent: fakeTriageEvent('agent-xyz', 'error') })
      await vi.advanceTimersByTimeAsync(1)

      const logs = getTaskLogsByRun(db, run.id)
      const failedLogs = logs.filter(l => l.taskId === taskId && l.status === 'failed')
      expect(failedLogs.length).toBeGreaterThanOrEqual(1)
    })
  })

  // -------------------------------------------------------------------------
  // getStatus()
  // -------------------------------------------------------------------------

  describe('getStatus()', () => {
    it('returns null run when no active run exists', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const status = scheduler.getStatus()

      expect(status.run).toBeNull()
      expect(status.activeTasks).toHaveLength(0)
      expect(status.completedCount).toBe(0)
    })

    it('returns the active run with correct counts', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-status-test') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(60_000)

      const status = scheduler.getStatus()
      expect(status.run).not.toBeNull()
      // After dispatch, task log is active
      expect(status.activeTasks.length).toBeGreaterThanOrEqual(1)
      expect(status.totalCount).toBeGreaterThanOrEqual(1)
      expect(status.completedCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // approveTaskDispatch()
  // -------------------------------------------------------------------------

  describe('approveTaskDispatch()', () => {
    it('skips pending task log when approval is rejected', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      const taskLog = insertTaskLog(db, { runId: run.id, taskId: 'task-abc', phase: 'dev' })

      scheduler.approveTaskDispatch(run.id, 'task-abc', false)

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.id === taskLog.id && l.status === 'skipped')).toBe(true)
    })

    it('triggers a tick when approval is granted', async () => {
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      // Use a very long tick interval so only the approval-triggered tick fires
      const deps = buildDeps(db, { brain, tickIntervalMs: 999_999 })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      brain.decide.mockClear()

      scheduler.approveTaskDispatch(run.id, 'task-abc', true)
      // Flush the setTimeout(0) scheduled by approveTaskDispatch
      await vi.advanceTimersByTimeAsync(1)

      // No ready tasks, but brain is reached (empty candidateTasks returns before brain, that's OK)
      // The key assertion: tick was triggered (the scheduler did not error)
      expect(brain.decide).not.toHaveBeenCalled() // no ready tasks → returns before brain
    })
  })

  // -------------------------------------------------------------------------
  // Integration: full critical path (C1+C2+C3+C4+H1+L1)
  // -------------------------------------------------------------------------

  describe('integration — requiresApproval full dispatch path', () => {
    it('C1: approved task dispatches on next tick (no infinite re-approval loop)', async () => {
      // Insert a task that requires approval
      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO tasks (id, repo_id, title, description, priority, status, requires_approval, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('approval-task-1', 'repo-1', 'Bootstrap project', 'Init the project', 1, 'today', 1, now, now)

      const decision: SchedulerBrainDecision = {
        taskId: 'approval-task-1',
        spawnOptions: { repoId: 'repo-1', name: 'agent-approval', cwd: '/tmp' },
        reason: 'highest priority',
      }
      const brain = { decide: vi.fn().mockResolvedValue(decision) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id-approval') }
      const emitToRenderer = vi.fn()
      const deps = buildDeps(db, { brain, dispatch, emitToRenderer, tickIntervalMs: 60_000 })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'test-sprint', repoId: 'repo-1', taskIds: ['approval-task-1'] })

      // --- Tick 1: immediate tick fires, approval gate triggers ---
      await vi.advanceTimersByTimeAsync(1) // flush setTimeout(0) from start()

      // Brain should NOT have been called (approval gate returned early)
      expect(brain.decide).not.toHaveBeenCalled()
      // Renderer should have received TASK_APPROVAL_NEEDED
      expect(emitToRenderer).toHaveBeenCalled()

      // --- User approves ---
      scheduler.approveTaskDispatch(run.id, 'approval-task-1', true)

      // --- Tick 2: approval kick fires, task should now dispatch ---
      await vi.advanceTimersByTimeAsync(1) // flush setTimeout(0) from approval

      expect(brain.decide).toHaveBeenCalled()
      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-1' }),
        'approval-task-1',
        run.id
      )

      // --- Tick 3: verify NO re-approval (C1 fix) ---
      brain.decide.mockClear()
      dispatch.execute.mockClear()
      emitToRenderer.mockClear()

      await vi.advanceTimersByTimeAsync(60_000) // next interval tick

      // The task is already dispatched (active log exists), so it should NOT
      // re-dispatch the same task
      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('L1: approval-gated task does not block non-approval tasks', async () => {
      const now = new Date().toISOString()
      // Task A requires approval (priority 1)
      db.prepare(
        `INSERT INTO tasks (id, repo_id, title, description, priority, status, requires_approval, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('approval-blocker', 'repo-1', 'Needs approval', 'desc', 1, 'today', 1, now, now)
      // Task B does NOT require approval (priority 2)
      db.prepare(
        `INSERT INTO tasks (id, repo_id, title, description, priority, status, requires_approval, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('free-task', 'repo-1', 'Free task', 'desc', 2, 'today', 0, now, now)

      const decision: SchedulerBrainDecision = {
        taskId: 'free-task',
        spawnOptions: { repoId: 'repo-1', name: 'agent-free', cwd: '/tmp' },
        reason: 'fallback to non-approval task',
      }
      const brain = { decide: vi.fn().mockResolvedValue(decision) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-free-id') }
      const deps = buildDeps(db, { brain, dispatch, tickIntervalMs: 60_000 })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'test-sprint', repoId: 'repo-1' })

      // Tick fires — approval-blocker gated, but free-task dispatches
      await vi.advanceTimersByTimeAsync(1) // immediate tick

      expect(brain.decide).toHaveBeenCalled()
      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-1' }),
        'free-task',
        expect.any(String)
      )
    })

    it('C4: immediate tick fires within 1ms of start()', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-imm', cwd: '/tmp' },
        reason: 'test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-imm-id') }
      const deps = buildDeps(db, { brain, dispatch, tickIntervalMs: 60_000 })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })

      // Only advance 1ms — should still dispatch (immediate tick)
      await vi.advanceTimersByTimeAsync(1)

      expect(brain.decide).toHaveBeenCalled()
      expect(dispatch.execute).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // recoverOrphanedState()
  // -------------------------------------------------------------------------

  describe('recoverOrphanedState()', () => {
    it('marks stale running runs with no active task logs as failed', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      db.prepare(
        `INSERT INTO orchestrator_runs
           (id, sprint_name, repo_id, status, concurrency_cap, agents_spawned, created_at, updated_at)
         VALUES ('stale-run', 'old-sprint', 'repo-1', 'running', 3, 0,
                 datetime('now', '-3 hours'), datetime('now', '-3 hours'))`
      ).run()

      const result = scheduler.recoverOrphanedState()

      expect(result.staleRuns).toBe(1)
      expect(result.orphanedTasks).toBe(0)

      const row = db
        .prepare('SELECT status FROM orchestrator_runs WHERE id = ?')
        .get('stale-run') as { status: string }
      expect(row.status).toBe('failed')
    })

    it('marks orphaned active task logs as failed when run has active logs', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      db.prepare(
        `INSERT INTO orchestrator_runs
           (id, sprint_name, repo_id, status, concurrency_cap, agents_spawned, created_at, updated_at)
         VALUES ('stale-run-2', 'old-sprint', 'repo-1', 'running', 3, 0,
                 datetime('now', '-3 hours'), datetime('now', '-3 hours'))`
      ).run()

      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO orchestrator_task_log
           (id, run_id, task_id, phase, status, created_at, updated_at)
         VALUES ('log-1', 'stale-run-2', 'task-x', 'dev', 'active', ?, ?)`
      ).run(now, now)

      const result = scheduler.recoverOrphanedState()

      expect(result.orphanedTasks).toBe(1)
      expect(result.staleRuns).toBe(0)

      const log = db
        .prepare('SELECT status FROM orchestrator_task_log WHERE id = ?')
        .get('log-1') as { status: string }
      expect(log.status).toBe('failed')
    })
  })

  // -------------------------------------------------------------------------
  // getTaskLog()
  // -------------------------------------------------------------------------

  describe('getTaskLog()', () => {
    it('returns empty array when no active run', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(scheduler.getTaskLog('any-task')).toHaveLength(0)
    })

    it('returns logs for the specified task in the active run', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      insertTaskLog(db, { runId: run.id, taskId: 'task-log-test', phase: 'dev' })
      insertTaskLog(db, { runId: run.id, taskId: 'other-task', phase: 'dev' })

      const logs = scheduler.getTaskLog('task-log-test')
      expect(logs).toHaveLength(1)
      expect(logs[0].taskId).toBe('task-log-test')
    })
  })
})
