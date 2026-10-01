// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { OrchestratorScheduler } from './orchestrator-scheduler'
import type { SchedulerDeps, SchedulerBrainDecision, ValidationOutcome } from './orchestrator-scheduler'
import {
  getActiveRun,
  getActiveRuns,
  getQueuedRuns,
  getRun,
  insertTaskLog,
  getTaskLogsByRun,
  insertApproval,
  getApproval,
} from '../db/queries/orchestrator.queries'
import {
  emitOrchestratorEvent,
  type OrchestratorAgentEvent,
} from './agent-lifecycle-bus'
import type { AgentLifecycleStatus } from '../../shared/types/agent.types'
import type { TaskEvent } from '../../shared/types/task.types'
import { ClaudeCliOutputParser, gateParsedStatus } from '../parsers/cli-output-parser'

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
      agent_lifetime_cap INTEGER NOT NULL DEFAULT 50,
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

    CREATE TABLE IF NOT EXISTS orchestrator_approvals (
      id             TEXT PRIMARY KEY,
      run_id         TEXT NOT NULL,
      task_id        TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending',
      requested_at   TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at     TEXT NOT NULL,
      responded_at   TEXT,
      reminder_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(run_id, task_id)
    );

    INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.enabled', 'true');
  `)
  return db
}

function insertTestTask(
  db: Database.Database,
  overrides: Partial<{ id: string; repoId: string; status: string; priority: number; title: string; sprintName: string }>
): string {
  const id = overrides.id ?? `task-${Date.now()}-${Math.random()}`
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO tasks (id, repo_id, title, description, priority, status, sprint_name, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides.repoId ?? 'repo-1',
    overrides.title ?? 'Test Task',
    overrides.priority ?? 3,
    overrides.status ?? 'today',
    overrides.sprintName ?? null,
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

    it('returns existing active run at default maxConcurrentRuns=1', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const first = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      expect(first.status).toBe('running')

      const second = scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-1' })
      expect(second.id).toBe(first.id)
    })

    it('M-1: reuse preserves telegramNotify when input is explicitly false (promote-only)', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const first = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1', telegramNotify: true })
      expect(first.telegramNotify).toBe(true)

      const second = scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-1', telegramNotify: false })
      expect(second.id).toBe(first.id)
      expect(second.telegramNotify).toBe(true)
    })

    it('queues a new run when maxConcurrentRuns > 1 and slots are full', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const first = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      expect(first.status).toBe('running')
      const second = scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-1' })
      expect(second.status).toBe('running')

      const third = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-1' })
      expect(third.id).not.toBe(first.id)
      expect(third.id).not.toBe(second.id)
      expect(third.status).toBe('queued')
    })

    it('throws when orchestrator is disabled', () => {
      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orchestrator.enabled'").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(() => scheduler.start({ sprintName: 'x', repoId: 'repo-1' })).toThrow('ORCHESTRATOR_DISABLED')
    })

    it('M-4: throws when repoId is missing', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(() => scheduler.start({ sprintName: 'x' })).toThrow('ORCHESTRATOR_START_REQUIRES_REPO_ID')
    })

    it('M-4: throws when repoId is whitespace-only', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(() => scheduler.start({ sprintName: 'x', repoId: '   ' })).toThrow('ORCHESTRATOR_START_REQUIRES_REPO_ID')
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

    it('stores agentLifetimeCap when passed to start()', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1', agentLifetimeCap: 7 })

      expect(getRun(db, run.id)!.agentLifetimeCap).toBe(7)
    })

    it('stores projectId when passed to start()', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1', projectId: 'proj-9' })

      expect(getRun(db, run.id)!.projectId).toBe('proj-9')
    })

    it('R-005: persists startedBy and triggerSource when provided to start()', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({
        sprintName: 'sprint-1',
        repoId: 'repo-1',
        startedBy: 'operator',
        triggerSource: 'sprint-watcher',
      })

      const persisted = getRun(db, run.id)!
      expect(persisted.startedBy).toBe('operator')
      expect(persisted.triggerSource).toBe('sprint-watcher')
    })

    it('R-005: persists singleTaskId when provided to start()', () => {
      const taskId = insertTestTask(db, { id: 'st-task', repoId: 'repo-1' })
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({
        sprintName: 'sprint-1',
        repoId: 'repo-1',
        singleTaskId: taskId,
      })

      expect(getRun(db, run.id)!.singleTaskId).toBe(taskId)
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

  describe('startSingleTask() — cross-sprint dependency', () => {
    it('dispatches a task whose blockedBy dependency is already done in a prior run', async () => {
      // A dependency completed in a DIFFERENT (prior) run — not part of this run's scope.
      const depId = insertTestTask(db, { id: 'prior-dep', repoId: 'repo-1', status: 'done' })
      const taskId = insertTestTask(db, { id: 'dependent-task', repoId: 'repo-1', status: 'today' })
      // The dependent task is blocked by a task that is already done elsewhere.
      db.prepare(
        'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
      ).run(taskId, depId)

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id-1') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.startSingleTask({ taskId })

      await vi.advanceTimersByTimeAsync(60_000)

      // The task must dispatch (reach the brain) despite its completed cross-sprint dep.
      expect(brain.decide).toHaveBeenCalled()
      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-1' }),
        taskId,
        expect.any(String)
      )
    })
  })

  // -------------------------------------------------------------------------
  // Slot-aware run admission
  // -------------------------------------------------------------------------

  describe('slot-aware run admission', () => {
    it('allows multiple concurrent runs when maxConcurrentRuns is raised', () => {
      // Set maxConcurrentRuns to 3
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      insertTestTask(db, { id: 'task-a', repoId: 'repo-1' })
      insertTestTask(db, { id: 'task-b', repoId: 'repo-2' })
      insertTestTask(db, { id: 'task-c', repoId: 'repo-3' })

      const run1 = scheduler.start({ sprintName: 's1', repoId: 'repo-1' })
      const run2 = scheduler.start({ sprintName: 's2', repoId: 'repo-2' })
      const run3 = scheduler.start({ sprintName: 's3', repoId: 'repo-3' })

      expect(run1.status).toBe('running')
      expect(run2.status).toBe('running')
      expect(run3.status).toBe('running')

      // 4th run should be queued
      const run4 = scheduler.start({ sprintName: 's4', repoId: 'repo-4' })
      expect(run4.status).toBe('queued')
    })

    it('queues startSingleTask when slots are full (maxConcurrentRuns > 1)', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const taskId = insertTestTask(db, { repoId: 'repo-1' })

      // Fill both slots
      scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-1' })

      // Single-task run should be queued
      const run = scheduler.startSingleTask({ taskId })
      expect(run.status).toBe('queued')
      expect(run.singleTaskId).toBe(taskId)
    })

    it('starts normally when a slot is available after previous run completes', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const first = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      expect(first.status).toBe('running')

      // Complete the first run
      scheduler.cancel(first.id)

      // Now a new run should start, not queue
      const second = scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-1' })
      expect(second.status).toBe('running')
    })

    it('counts paused runs as active for slot calculation (maxConcurrentRuns > 1)', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })
      scheduler.pause(run1.id)
      expect(getRun(db, run1.id)!.status).toBe('paused')

      // Paused run still occupies a slot — 3rd run should queue
      const run3 = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-3' })
      expect(run3.status).toBe('queued')
    })

    it('queued run is persisted in the database with correct status (maxConcurrentRuns > 1)', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })
      const queued = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-3' })

      const found = getRun(db, queued.id)
      expect(found).not.toBeNull()
      expect(found!.status).toBe('queued')
      expect(found!.sprintName).toBe('sprint-3')
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
  // extendRunWallClock()
  // -------------------------------------------------------------------------

  describe('extendRunWallClock()', () => {
    it('resets started_at and resumes a paused run', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'wc-sprint', repoId: 'repo-1' })
      const originalStartedAt = getRun(db, run.id)!.startedAt!

      // Advance fake time so the reset timestamp will be strictly later
      vi.advanceTimersByTime(5_000)

      scheduler.pause(run.id)
      expect(getRun(db, run.id)!.status).toBe('paused')

      const result = scheduler.extendRunWallClock(run.id)
      expect(result).toBe(true)

      const afterRun = getRun(db, run.id)!
      expect(afterRun.status).toBe('running')
      expect(afterRun.startedAt).not.toBeNull()
      // started_at must be strictly later (wall-clock was reset, not preserved by COALESCE)
      expect(new Date(afterRun.startedAt!).getTime()).toBeGreaterThan(
        new Date(originalStartedAt).getTime()
      )
      // fresh: within 10 seconds of now
      expect(new Date(afterRun.startedAt!).getTime()).toBeGreaterThanOrEqual(
        Date.now() - 10_000
      )
    })

    it('returns false and does not change status for a running run', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'wc-running', repoId: 'repo-1' })
      expect(getRun(db, run.id)!.status).toBe('running')

      const result = scheduler.extendRunWallClock(run.id)
      expect(result).toBe(false)

      expect(getRun(db, run.id)!.status).toBe('running')
    })

    it('returns false for a missing runId', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const result = scheduler.extendRunWallClock('non-existent-run-id')
      expect(result).toBe(false)
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

    it('syncs task status using newest log per task (done wins over older active)', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)
      const taskId = insertTestTask(db, { id: 'multi-log-task', repoId: 'repo-1', status: 'in_progress' })
      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })

      // Insert two logs for the same task: first active (older), then done (newer)
      const older = new Date('2026-01-01T00:00:00Z').toISOString()
      const newer = new Date('2026-01-01T01:00:00Z').toISOString()
      db.prepare(
        `INSERT INTO orchestrator_task_log (id, run_id, task_id, phase, status, created_at, updated_at)
         VALUES (?, ?, ?, 'dev', 'active', ?, ?)`
      ).run('log-older', run.id, taskId, older, older)
      db.prepare(
        `INSERT INTO orchestrator_task_log (id, run_id, task_id, phase, status, created_at, updated_at)
         VALUES (?, ?, ?, 'dev', 'done', ?, ?)`
      ).run('log-newer', run.id, taskId, newer, newer)

      scheduler.cancel(run.id)

      // Newest log is 'done' → task should be marked 'completed', not reset to 'backlog'
      const task = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string }
      expect(task.status).toBe('completed')
    })

    it('clears the agent link of a reverted active task but keeps the agent id in the task log', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)
      const taskId = insertTestTask(db, { id: 'cancel-link-task', repoId: 'repo-1', status: 'in_progress' })
      db.prepare('UPDATE tasks SET agent_id = ? WHERE id = ?').run('agent-still-alive', taskId)
      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })

      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO orchestrator_task_log (id, run_id, task_id, phase, status, agent_id, created_at, updated_at)
         VALUES ('log-cancel-link', ?, ?, 'dev', 'active', 'agent-still-alive', ?, ?)`
      ).run(run.id, taskId, now, now)

      scheduler.cancel(run.id)

      const task = db.prepare('SELECT status, agent_id FROM tasks WHERE id = ?').get(taskId) as {
        status: string
        agent_id: string | null
      }
      expect(task.status).toBe('backlog')
      expect(task.agent_id).toBeNull()
      const log = db.prepare('SELECT agent_id FROM orchestrator_task_log WHERE id = ?').get('log-cancel-link') as {
        agent_id: string | null
      }
      expect(log.agent_id).toBe('agent-still-alive')
    })

    it('marks in-flight active task logs as skipped on cancel (M-2)', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)
      const taskId = insertTestTask(db, { id: 'm2-active-task', repoId: 'repo-1', status: 'in_progress' })
      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1' })

      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO orchestrator_task_log (id, run_id, task_id, phase, status, created_at, updated_at)
         VALUES (?, ?, ?, 'dev', 'active', ?, ?)`
      ).run('log-m2-active', run.id, taskId, now, now)

      scheduler.cancel(run.id)

      const log = db.prepare('SELECT status FROM orchestrator_task_log WHERE id = ?').get('log-m2-active') as { status: string }
      expect(log.status).toBe('skipped')
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
    it('throws on start() when orchestrator.enabled key is absent (default = disabled)', () => {
      db.prepare("DELETE FROM settings WHERE key = 'orchestrator.enabled'").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(() => scheduler.start({ sprintName: 'x', repoId: 'repo-1' })).toThrow('ORCHESTRATOR_DISABLED')
    })

    it('aborts tick when orchestrator.enabled key is absent (default = disabled)', async () => {
      // Start with enabled, then delete the key before the tick fires
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 's', repoId: 'repo-1' })
      db.prepare("DELETE FROM settings WHERE key = 'orchestrator.enabled'").run()

      await vi.advanceTimersByTimeAsync(60_000)

      expect(brain.decide).not.toHaveBeenCalled()
    })

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

    it('respects run concurrencyCap instead of global maxAgents budget', async () => {
      const taskA = insertTestTask(db, { id: 'task-a', repoId: 'repo-1', status: 'today' })
      const taskB = insertTestTask(db, { id: 'task-b', repoId: 'repo-1', status: 'today' })

      const decisionA: SchedulerBrainDecision = {
        taskId: taskA,
        spawnOptions: { repoId: 'repo-1', name: 'agent-a', cwd: '/tmp' },
        reason: 'test',
      }
      const decisionB: SchedulerBrainDecision = {
        taskId: taskB,
        spawnOptions: { repoId: 'repo-1', name: 'agent-b', cwd: '/tmp' },
        reason: 'test',
      }
      // High global budget (50) but per-run concurrencyCap=1. The scheduler must
      // NOT dispatch taskB while taskA is still active, or the monitor flags a
      // false-positive breach and pauses the run.
      const brain = { decide: vi.fn().mockResolvedValueOnce(decisionA).mockResolvedValueOnce(decisionB).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id') }
      const deps = buildDeps(db, { brain, dispatch, maxAgents: 50 })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskA, taskB], concurrencyCap: 1 })

      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
      expect(brain.decide).toHaveBeenCalledTimes(1)

      // Second tick: active (1) >= concurrencyCap (1) → must not dispatch taskB.
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
      expect(brain.decide).toHaveBeenCalledTimes(1)
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

    it('reconciles a completed agent on the heartbeat when its lifecycle event was missed', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      let agentStatus: AgentLifecycleStatus = 'busy'
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-heartbeat', cwd: '/tmp' },
        reason: 'test heartbeat reconciliation',
      }
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-heartbeat') },
        getAgentStatus: vi.fn(() => agentStatus),
      })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(1)
      expect(getTaskLogsByRun(db, run.id).some(l => l.status === 'active')).toBe(true)

      // Simulate persistence seeing completion while the in-process event was lost.
      agentStatus = 'completed'
      await vi.advanceTimersByTimeAsync(60_000)

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.taskId === taskId && l.status === 'done')).toBe(true)
    })

    it('reconciles completed agents across multiple active runs (P3-3)', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskA = insertTestTask(db, { id: 'mr-recon-a', repoId: 'repo-a', status: 'today', title: 'Recon A' })
      const taskB = insertTestTask(db, { id: 'mr-recon-b', repoId: 'repo-b', status: 'today', title: 'Recon B' })

      const decisionA: SchedulerBrainDecision = {
        taskId: taskA,
        spawnOptions: { repoId: 'repo-a', name: 'agent-recon-a', cwd: '/tmp' },
        reason: 'test multi-run reconciliation run-a',
      }
      const decisionB: SchedulerBrainDecision = {
        taskId: taskB,
        spawnOptions: { repoId: 'repo-b', name: 'agent-recon-b', cwd: '/tmp' },
        reason: 'test multi-run reconciliation run-b',
      }

      const agentStatuses: Record<string, AgentLifecycleStatus> = {
        'agent-recon-a': 'busy',
        'agent-recon-b': 'busy',
      }

      const brain = {
        decide: vi.fn()
          .mockResolvedValueOnce(decisionA)
          .mockResolvedValue(null),
      }
      const dispatch = { execute: vi.fn().mockImplementation((spawn) => spawn.name) }
      const deps = buildDeps(db, {
        brain,
        dispatch,
        getAgentStatus: vi.fn((id: string) => agentStatuses[id] ?? null),
      })
      scheduler = new OrchestratorScheduler(deps)

      // Start run-a (sprint-a), dispatch one task via tick
      const runA = scheduler.start({ sprintName: 'sprint-a', repoId: 'repo-a', taskIds: [taskA] })
      await vi.advanceTimersByTimeAsync(60_000) // tick 1: dispatches taskA into runA
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // Start run-b (sprint-b), wire brain to dispatch decisionB on next tick
      brain.decide.mockResolvedValueOnce(decisionB).mockResolvedValue(null)
      const runB = scheduler.start({ sprintName: 'sprint-b', repoId: 'repo-b', taskIds: [taskB] })
      await vi.advanceTimersByTimeAsync(60_000) // tick 2: dispatches taskB into runB
      expect(dispatch.execute).toHaveBeenCalledTimes(2)

      // Both agents now show as completed in persistence
      agentStatuses['agent-recon-a'] = 'completed'
      agentStatuses['agent-recon-b'] = 'completed'

      // Advance one tick — reconciliation should pick up BOTH
      await vi.advanceTimersByTimeAsync(60_000)

      const logsA = getTaskLogsByRun(db, runA.id)
      const logsB = getTaskLogsByRun(db, runB.id)
      expect(logsA.some(l => l.taskId === taskA && l.status === 'done')).toBe(true)
      expect(logsB.some(l => l.taskId === taskB && l.status === 'done')).toBe(true)
    })

    it('does not treat a temporary locked prompt as task completion', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-temporarily-locked', cwd: '/tmp' },
        reason: 'test temporary prompt',
      }
      const agentStatus: AgentLifecycleStatus = 'locked'
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-temporarily-locked') },
        getAgentStatus: vi.fn(() => agentStatus),
      })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(1)
      await vi.advanceTimersByTimeAsync(60_000)

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.taskId === taskId && l.status === 'active')).toBe(true)
      expect(logs.some(l => l.taskId === taskId && l.status === 'done')).toBe(false)
    })

    it('keeps an orchestrator agent running when its echoed prompt matches parser completion phrases (C-T2 incident)', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      // Built from fragments so this source never contains the literal phrases.
      const echoedPrompt = [
        'PROBLEM: the parser matches',
        ['task', 'completed'].join(' '),
        'and',
        ['✓', 'all', 'done'].join(' '),
        'in the prompt echoed at spawn.',
      ].join(' ')
      expect(new ClaudeCliOutputParser().parse(echoedPrompt)?.status).toBe('completed')

      // Mirrors agent-manager's PTY handler: parser output passes the trust gate
      // before it may change the orchestrator agent's lifecycle status.
      const parser = new ClaudeCliOutputParser()
      let agentStatus: AgentLifecycleStatus = 'busy'
      const applyPtyOutput = (chunk: string): void => {
        const parsed = gateParsedStatus(parser.parse(chunk), true)
        if (parsed) agentStatus = parsed.status
      }
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-echoed-prompt', cwd: '/tmp' },
        reason: 'test echoed prompt',
      }
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-echoed-prompt') },
        getAgentStatus: vi.fn(() => agentStatus),
      })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(1)

      applyPtyOutput(echoedPrompt)
      expect(agentStatus).toBe('busy')

      // Heartbeat reconciliation must not see a completion either.
      await vi.advanceTimersByTimeAsync(60_000)
      const taskStatus = (): string =>
        (db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string }).status
      let logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.taskId === taskId && l.status === 'active')).toBe(true)
      expect(logs.some(l => l.taskId === taskId && l.status === 'done')).toBe(false)
      expect(taskStatus()).toBe('in_progress')

      // The explicit MCP 'completed' signal (completeAgentFromTelegram → agent:completed) still completes it.
      agentStatus = 'completed'
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-echoed-prompt', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.taskId === taskId && l.status === 'done')).toBe(true)
      expect(taskStatus()).toBe('completed')
    })

    it('coalesces an immediate tick requested while another tick is in flight', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      let resolveFirst!: (value: SchedulerBrainDecision | null) => void
      const firstDecision = new Promise<SchedulerBrainDecision | null>((resolve) => {
        resolveFirst = resolve
      })
      const brain = {
        decide: vi.fn()
          .mockImplementationOnce(() => firstDecision)
          .mockResolvedValue(null),
      }
      scheduler = new OrchestratorScheduler(buildDeps(db, { brain }))
      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })

      // Drive the first tick directly so it remains blocked inside brain.decide().
      ;(scheduler as unknown as { suspendScheduling(): void }).suspendScheduling()
      const firstTick = (scheduler as unknown as { tick(): Promise<void> }).tick()
      await Promise.resolve()
      expect(brain.decide).toHaveBeenCalledTimes(1)

      scheduler.resume(run.id)
      await vi.advanceTimersByTimeAsync(1)
      resolveFirst(null)
      await firstTick
      await vi.advanceTimersByTimeAsync(1)

      expect(brain.decide).toHaveBeenCalledTimes(2)
    })

    it('keeps lifecycle listeners registered across kill-switch suspension and restart', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-reenabled', cwd: '/tmp' },
        reason: 'test listener reactivation',
      }
      scheduler = new OrchestratorScheduler(buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-reenabled') },
      }))

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(1)

      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orchestrator.enabled'").run()
      await vi.advanceTimersByTimeAsync(60_000)
      db.prepare("UPDATE settings SET value = 'true' WHERE key = 'orchestrator.enabled'").run()
      scheduler.start({ sprintName: 'sprint', repoId: 'repo-1', taskIds: [taskId] })

      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-reenabled', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      expect(getTaskLogsByRun(db, run.id).some(l => l.status === 'done')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Telegram lifecycle notifications
  // -------------------------------------------------------------------------

  describe('Telegram lifecycle notifications', () => {
    it('notifies when a task launches only when telegramNotify is enabled', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today', title: 'Launch task' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-launch') },
        sendTelegramNotification,
      })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({
        sprintName: 'notify-sprint',
        repoId: 'repo-1',
        taskIds: [taskId],
        telegramNotify: true,
      })
      await vi.advanceTimersByTimeAsync(1)

      expect(sendTelegramNotification).toHaveBeenCalledWith(
        expect.stringContaining('Launch task'),
        'task_launched',
        'repo-1',
        'agent-launch'
      )

      scheduler.stop()
      sendTelegramNotification.mockClear()
      db.prepare('UPDATE orchestrator_runs SET status = ?').run('cancelled')
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('today', taskId)
      vi.mocked(deps.brain.decide).mockResolvedValueOnce(decision).mockResolvedValue(null)
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'silent-sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(1)

      expect(deps.dispatch.execute).toHaveBeenCalledTimes(2)
      expect(sendTelegramNotification).not.toHaveBeenCalled()
    })

    it('notifies task and run completion', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today', title: 'Complete task' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-complete') },
        sendTelegramNotification,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({
        sprintName: 'notify-sprint',
        repoId: 'repo-1',
        taskIds: [taskId],
        telegramNotify: true,
      })
      await vi.advanceTimersByTimeAsync(1)

      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-complete', 'completed'),
      })

      expect(sendTelegramNotification).toHaveBeenCalledWith(
        expect.stringContaining('Complete task'),
        'task_completed',
        'repo-1',
        'agent-complete'
      )
      expect(sendTelegramNotification).toHaveBeenCalledWith(
        expect.stringContaining('notify-sprint'),
        'run_completed',
        'repo-1',
        undefined
      )
    })

    it('notifies task failure and the final failed run without changing retry behavior', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today', title: 'Fail task' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const sendTelegramNotification = vi.fn()
      const dispatch = { execute: vi.fn().mockReturnValue('agent-fail') }
      const deps = buildDeps(db, {
        brain: {
          decide: vi.fn()
            .mockResolvedValueOnce(decision)
            .mockResolvedValueOnce(decision)
            .mockResolvedValue(null),
        },
        dispatch,
        sendTelegramNotification,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({
        sprintName: 'notify-sprint',
        repoId: 'repo-1',
        taskIds: [taskId],
        telegramNotify: true,
      })
      await vi.advanceTimersByTimeAsync(1)

      emitOrchestratorEvent({ type: 'agent:failed', triageEvent: fakeTriageEvent('agent-fail', 'error') })
      await vi.advanceTimersByTimeAsync(1)
      emitOrchestratorEvent({ type: 'agent:failed', triageEvent: fakeTriageEvent('agent-fail', 'error') })

      expect(dispatch.execute).toHaveBeenCalledTimes(1)
      expect(sendTelegramNotification.mock.calls.filter(([, type]) => type === 'task_failed')).toHaveLength(1)
      expect(sendTelegramNotification).toHaveBeenCalledWith(
        expect.stringContaining('notify-sprint'),
        'run_failed',
        'repo-1',
        undefined
      )
    })

    it('does not interrupt task dispatch when notification delivery throws', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-resilient') },
        sendTelegramNotification: vi.fn(() => {
          throw new Error('Telegram unavailable')
        }),
      })
      scheduler = new OrchestratorScheduler(deps)
      const run = scheduler.start({
        sprintName: 'notify-sprint',
        repoId: 'repo-1',
        taskIds: [taskId],
        telegramNotify: true,
      })

      await vi.advanceTimersByTimeAsync(1)

      expect(getTaskLogsByRun(db, run.id)).toEqual([
        expect.objectContaining({ taskId, status: 'active', agentId: 'agent-resilient' }),
      ])
    })
  })

  // -------------------------------------------------------------------------
  // Retry state isolation per run
  // -------------------------------------------------------------------------

  describe('retry state isolation per run', () => {
    it('retry state from run1 does not leak into run2 for the same taskId', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })

      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-r1', cwd: '/tmp' },
        reason: 'test retry isolation',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-r1') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      // --- Run 1: dispatch, fail once (retry bumps count to 1), then cancel ---
      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(1) // immediate tick dispatches

      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // First failure in run1 → retry allowed (count 0 → 1)
      emitOrchestratorEvent({ type: 'agent:failed', triageEvent: fakeTriageEvent('agent-r1', 'error') })
      await vi.advanceTimersByTimeAsync(1)

      // Task is still in_progress (dispatch set it; retry branch does not reset)
      const afterRun1Fail = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string }
      expect(afterRun1Fail.status).toBe('in_progress')

      // Cancel run1 — retryMap entry (count=1) is NOT cleaned up
      scheduler.cancel(run1.id)

      // Reset task to dispatchable so run2 can pick it up
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('today', taskId)

      // --- Run 2: dispatch same task ---
      const decision2: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-r2', cwd: '/tmp' },
        reason: 'test retry isolation run2',
      }
      vi.mocked(brain.decide).mockResolvedValueOnce(decision2).mockResolvedValue(null)
      vi.mocked(dispatch.execute).mockReturnValue('agent-r2')

      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(1) // immediate tick dispatches

      expect(dispatch.execute).toHaveBeenCalledTimes(2)

      // First failure in run2 — must allow retry (fresh run, count should be 0)
      // BUG: with taskId-only key, retryMap sees count=1 from run1 → exhausted → backlog
      // FIX: with runId:taskId key, retryMap sees no entry for run2 → retry allowed
      emitOrchestratorEvent({ type: 'agent:failed', triageEvent: fakeTriageEvent('agent-r2', 'error') })
      await vi.advanceTimersByTimeAsync(1)

      const afterRun2Fail = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string }
      // With fix: retry allowed → task stays in_progress (not reset to backlog)
      // With bug: retry exhausted → task reset to backlog
      expect(afterRun2Fail.status).toBe('in_progress')
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

    it('returns activeRuns and queuedRuns alongside run field', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      const run2 = scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })
      const queued = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-3' })
      expect(queued.status).toBe('queued')

      const status = scheduler.getStatus()

      // backward-compat: run === activeRuns[0]
      expect(status.run).not.toBeNull()
      expect(status.run!.id).toBe(status.activeRuns[0].id)

      // new fields
      expect(status.activeRuns).toHaveLength(2)
      expect(status.activeRuns.map(r => r.id)).toContain(run1.id)
      expect(status.activeRuns.map(r => r.id)).toContain(run2.id)
      expect(status.queuedRuns).toHaveLength(1)
      expect(status.queuedRuns[0].id).toBe(queued.id)
    })

    it('returns empty activeRuns and queuedRuns when no run exists', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const status = scheduler.getStatus()

      expect(status.run).toBeNull()
      expect(status.activeRuns).toHaveLength(0)
      expect(status.queuedRuns).toHaveLength(0)
    })

    it('R-004: aggregates metrics across all active runs', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskId1 = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const taskId2 = insertTestTask(db, { repoId: 'repo-2', status: 'today' })

      const decision1: SchedulerBrainDecision = {
        taskId: taskId1,
        spawnOptions: { repoId: 'repo-1', name: 'agent-r1', cwd: '/tmp' },
        reason: 'test-r1',
      }
      const decision2: SchedulerBrainDecision = {
        taskId: taskId2,
        spawnOptions: { repoId: 'repo-2', name: 'agent-r2', cwd: '/tmp' },
        reason: 'test-r2',
      }

      const brain = {
        decide: vi.fn()
          .mockResolvedValueOnce(decision1)
          .mockResolvedValueOnce(decision2)
          .mockResolvedValue(null),
      }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-multi-test') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      // Two active runs, each scoped to one task in a different repo.
      scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1', taskIds: [taskId1] })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2', taskIds: [taskId2] })

      // Tick 1 (immediate at 0 ms): dispatches task1 from run1 (dispatched=true breaks the run loop).
      // Tick 2 (interval at 60 000 ms): dispatches task2 from run2.
      await vi.advanceTimersByTimeAsync(60_000)

      const status = scheduler.getStatus()
      // Pre-fix: totalCount === 1 (only run1 logs). Post-fix: totalCount === 2.
      expect(status.totalCount).toBe(2)
      expect(status.activeTasks).toHaveLength(2)
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

    it('writes an approved row to the DB and kicks a tick on approval', async () => {
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain, tickIntervalMs: 999_999 })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      insertApproval(db, { runId: run.id, taskId: 'task-approve', windowMinutes: 30 })
      brain.decide.mockClear()

      scheduler.approveTaskDispatch(run.id, 'task-approve', true)

      // Approving writes the row synchronously (before the scheduled tick runs).
      const approval = getApproval(db, run.id, 'task-approve')
      expect(approval?.status).toBe('approved')
      expect(approval?.respondedAt).toBeTruthy()

      // The scheduled tick then concludes the empty run and cleans up its approvals.
      await vi.advanceTimersByTimeAsync(1)
      expect(getApproval(db, run.id, 'task-approve')).toBeNull()
    })

    it('writes a denied row and skips pending logs on rejection', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint', repoId: 'repo-1' })
      insertApproval(db, { runId: run.id, taskId: 'task-deny', windowMinutes: 30 })
      const taskLog = insertTaskLog(db, { runId: run.id, taskId: 'task-deny', phase: 'dev' })

      scheduler.approveTaskDispatch(run.id, 'task-deny', false)

      const approval = getApproval(db, run.id, 'task-deny')
      expect(approval?.status).toBe('denied')
      expect(approval?.respondedAt).toBeTruthy()

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs.some(l => l.id === taskLog.id && l.status === 'skipped')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Approval gate state machine (tickBody)
  // -------------------------------------------------------------------------

  describe('approval gate (tickBody)', () => {
    function insertApprovalTask(db: Database.Database, id: string, title = 'Approval task'): void {
      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO tasks (id, repo_id, title, description, priority, status, requires_approval, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, 'repo-1', title, 'desc', 1, 'today', 1, now, now)
    }

    it('inserts a pending row and notifies, without dispatching, when no row exists', async () => {
      insertApprovalTask(db, 'gate-none')
      const notifyApproval = vi.fn()
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id') }
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain, dispatch, notifyApproval })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1', taskIds: ['gate-none'], telegramNotify: true })
      await vi.advanceTimersByTimeAsync(1)

      const approval = getApproval(db, run.id, 'gate-none')
      expect(approval?.status).toBe('pending')
      expect(notifyApproval).toHaveBeenCalledWith('gate-none', run.id, 'Approval task', 'repo-1', 's', 'desc')
      expect(brain.decide).not.toHaveBeenCalled()
      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('skips dispatch while a pending row exists and does not re-prompt', async () => {
      insertApprovalTask(db, 'gate-pending')
      const notifyApproval = vi.fn()
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id') }
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain, dispatch, notifyApproval })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1', taskIds: ['gate-pending'], telegramNotify: true })
      insertApproval(db, { runId: run.id, taskId: 'gate-pending', windowMinutes: 30 })

      await vi.advanceTimersByTimeAsync(1)

      expect(notifyApproval).not.toHaveBeenCalled()
      expect(brain.decide).not.toHaveBeenCalled()
      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('skips dispatch and does not re-insert/re-prompt when a denied row exists', async () => {
      insertApprovalTask(db, 'gate-denied')
      const notifyApproval = vi.fn()
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id') }
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain, dispatch, notifyApproval })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1', taskIds: ['gate-denied'], telegramNotify: true })
      db.prepare(
        `INSERT INTO orchestrator_approvals (id, run_id, task_id, status, requested_at, expires_at, responded_at, reminder_count)
         VALUES ('row-denied', ?, 'gate-denied', 'denied', datetime('now'), datetime('now', '+30 minutes'), datetime('now'), 0)`
      ).run(run.id)

      await vi.advanceTimersByTimeAsync(1)

      expect(notifyApproval).not.toHaveBeenCalled()
      expect(brain.decide).not.toHaveBeenCalled()
      expect(dispatch.execute).not.toHaveBeenCalled()

      const approval = getApproval(db, run.id, 'gate-denied')
      expect(approval?.status).toBe('denied') // still denied — not re-inserted
    })

    it('re-requests a fresh pending row when an expired row exists', async () => {
      insertApprovalTask(db, 'gate-expired')
      const notifyApproval = vi.fn()
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id') }
      const brain = { decide: vi.fn().mockResolvedValue(null) }
      const deps = buildDeps(db, { brain, dispatch, notifyApproval })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1', taskIds: ['gate-expired'], telegramNotify: true })
      db.prepare(
        `INSERT INTO orchestrator_approvals (id, run_id, task_id, status, requested_at, expires_at, responded_at, reminder_count)
         VALUES ('row-expired', ?, 'gate-expired', 'expired', datetime('now', '-60 minutes'), datetime('now', '-30 minutes'), datetime('now', '-30 minutes'), 2)`
      ).run(run.id)

      await vi.advanceTimersByTimeAsync(1)

      const approval = getApproval(db, run.id, 'gate-expired')
      expect(approval?.status).toBe('pending')
      expect(approval?.reminderCount).toBe(0)
      expect(notifyApproval).toHaveBeenCalledWith('gate-expired', run.id, 'Approval task', 'repo-1', 's', 'desc')
      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('dispatches when an approved row exists', async () => {
      insertApprovalTask(db, 'gate-approved')
      const decision: SchedulerBrainDecision = {
        taskId: 'gate-approved',
        spawnOptions: { repoId: 'repo-1', name: 'agent-approved', cwd: '/tmp' },
        reason: 'approved gate',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id-approved') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 's', repoId: 'repo-1', taskIds: ['gate-approved'] })
      insertApproval(db, { runId: run.id, taskId: 'gate-approved', windowMinutes: 30 })
      scheduler.approveTaskDispatch(run.id, 'gate-approved', true)

      // Flush the setTimeout(0) tick kicked by the approval
      await vi.advanceTimersByTimeAsync(1)

      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-1' }),
        'gate-approved',
        run.id
      )
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
        `INSERT INTO tasks (id, repo_id, title, description, priority, status, requires_approval, sprint_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('approval-blocker', 'repo-1', 'Needs approval', 'desc', 1, 'today', 1, 'test-sprint', now, now)
      // Task B does NOT require approval (priority 2)
      db.prepare(
        `INSERT INTO tasks (id, repo_id, title, description, priority, status, requires_approval, sprint_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('free-task', 'repo-1', 'Free task', 'desc', 2, 'today', 0, 'test-sprint', now, now)

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
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today', sprintName: 'sprint' })
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
  // fetchCandidateTasks() — sprint scoping (AH-2, run R06f)
  // -------------------------------------------------------------------------

  describe('sprint-scoped candidate fetch', () => {
    function candidateIdsSeenByBrain(deps: SchedulerDeps): string[] {
      const calls = (deps.brain.decide as ReturnType<typeof vi.fn>).mock.calls
      return calls.flatMap(c => (c[0] as { candidateTasks: Array<{ id: string }> }).candidateTasks.map(t => t.id))
    }

    it('a sprint run without taskIds only sees backlog tasks of its own sprint, not other sprints of the same repo', async () => {
      const own = insertTestTask(db, { id: 'own-1', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-A' })
      insertTestTask(db, { id: 'other-sprint', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-B' })
      insertTestTask(db, { id: 'no-sprint', repoId: 'repo-1', status: 'today' })

      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-A', repoId: 'repo-1' })
      await vi.advanceTimersByTimeAsync(1)

      const seen = candidateIdsSeenByBrain(deps)
      expect(seen).toContain(own)
      expect(seen).not.toContain('other-sprint')
      expect(seen).not.toContain('no-sprint')
    })

    it('a sprint run does not dispatch a same-repo backlog task that belongs to a different sprint', async () => {
      insertTestTask(db, { id: 'stray', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-B' })
      const decision: SchedulerBrainDecision = {
        taskId: 'stray',
        spawnOptions: { repoId: 'repo-1', name: 'agent-stray', cwd: '/tmp' },
        reason: 'test',
      }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-stray-id') }
      const deps = buildDeps(db, { brain: { decide: vi.fn().mockResolvedValue(decision) }, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-A', repoId: 'repo-1' })
      await vi.advanceTimersByTimeAsync(60_000)

      expect(dispatch.execute).not.toHaveBeenCalled()
    })

    it('a run with explicit taskIds dispatches only those tasks, whatever their sprintName', async () => {
      const picked = insertTestTask(db, { id: 'picked', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-B' })
      insertTestTask(db, { id: 'sibling', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-A' })

      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-A', repoId: 'repo-1', taskIds: [picked] })
      await vi.advanceTimersByTimeAsync(1)

      expect(new Set(candidateIdsSeenByBrain(deps))).toEqual(new Set([picked]))
    })

    it('a placeholder-named run (sprintName omitted => "manual") without taskIds still takes the whole repo backlog', async () => {
      insertTestTask(db, { id: 'm-1', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-A' })
      insertTestTask(db, { id: 'm-2', repoId: 'repo-1', status: 'today' })

      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ repoId: 'repo-1' })
      await vi.advanceTimersByTimeAsync(1)

      expect(new Set(candidateIdsSeenByBrain(deps))).toEqual(new Set(['m-1', 'm-2']))
    })

    it('a placeholder-named run (sprintName omitted => "manual") still dispatches a task whose sprintName is NULL', async () => {
      const taskId = insertTestTask(db, { id: 'null-sprint', repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-null-sprint', cwd: '/tmp' },
        reason: 'test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-null-sprint-id') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ repoId: 'repo-1' })
      await vi.advanceTimersByTimeAsync(1)

      expect(run.sprintName).toBe('manual')
      expect(dispatch.execute).toHaveBeenCalledWith(expect.objectContaining({ repoId: 'repo-1' }), taskId, run.id)
    })

    it('refuses a named sprint run without taskIds when its sprint has no dispatchable tasks, leaving no run behind', () => {
      insertTestTask(db, { id: 'elsewhere', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-B' })
      insertTestTask(db, { id: 'already-done', repoId: 'repo-1', status: 'done', sprintName: 'sprint-unknown' })

      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      expect(() => scheduler.start({ sprintName: 'sprint-unknown', repoId: 'repo-1' }))
        .toThrow(/ORCHESTRATOR_SPRINT_HAS_NO_TASKS.*sprint-unknown/)
      expect(getActiveRuns(db)).toHaveLength(0)
      expect(getQueuedRuns(db)).toHaveLength(0)
      const rows = db.prepare('SELECT COUNT(*) AS n FROM orchestrator_runs').get() as { n: number }
      expect(rows.n).toBe(0)
    })

    it('refuses an empty named sprint run even when the run would be queued (slots full)', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      insertTestTask(db, { id: 'a-1', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-A' })
      insertTestTask(db, { id: 'b-1', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-B' })
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'sprint-A', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-B', repoId: 'repo-1' })

      expect(() => scheduler.start({ sprintName: 'sprint-unknown', repoId: 'repo-1' }))
        .toThrow(/ORCHESTRATOR_SPRINT_HAS_NO_TASKS.*sprint-unknown/)
      expect(getQueuedRuns(db)).toHaveLength(0)
    })

    it('still starts a placeholder-named run with an empty repo backlog', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ repoId: 'repo-1' })

      expect(run.status).toBe('running')
    })

    it('still starts a named sprint run with explicit taskIds even if none of them is dispatchable', () => {
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'sprint-unknown', repoId: 'repo-1', taskIds: ['missing-task'] })

      expect(run.status).toBe('running')
    })

    it('startSingleTask() still dispatches its task regardless of the task sprintName', async () => {
      const taskId = insertTestTask(db, { id: 'solo', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-B' })
      insertTestTask(db, { id: 'bystander', repoId: 'repo-1', status: 'backlog', sprintName: 'sprint-B' })

      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      scheduler.startSingleTask({ taskId })
      await vi.advanceTimersByTimeAsync(1)

      expect(new Set(candidateIdsSeenByBrain(deps))).toEqual(new Set([taskId]))
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

    it('returns logs for a task whose run is not the most-recent active run (multi-run)', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const runA = scheduler.start({ sprintName: 'sprint-a', repoId: 'repo-a' })
      // runB is the "newer" active run — old code's getActiveRun() (ORDER BY updated_at DESC LIMIT 1) returns runB,
      // so any task belonging to runA would be invisible to the old getTaskLog() implementation
      const runB = scheduler.start({ sprintName: 'sprint-b', repoId: 'repo-b' })
      expect(runB.status).toBe('running')

      // Force runA to appear older so getActiveRun() always returns runB
      db.prepare("UPDATE orchestrator_runs SET updated_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(runA.id)

      insertTaskLog(db, { runId: runA.id, taskId: 'multi-run-task', phase: 'dev' })

      // Old code: getActiveRun() → runB → getTaskLogsByRun(runB.id).filter(taskId='multi-run-task') = []
      // New code: getTaskLogsByTask(db, 'multi-run-task') → [log in runA]
      const logs = scheduler.getTaskLog('multi-run-task')
      expect(logs).toHaveLength(1)
      expect(logs[0].taskId).toBe('multi-run-task')
      expect(logs[0].runId).toBe(runA.id)
    })
  })

  // -------------------------------------------------------------------------
  // Multi-run tickBody() — P3-1
  // -------------------------------------------------------------------------

  describe('multi-run tickBody()', () => {
    it('dispatches tasks from 2+ active runs across consecutive ticks', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskA = insertTestTask(db, { id: 'mr-task-a', repoId: 'repo-a', status: 'today', title: 'Task A' })
      const taskB = insertTestTask(db, { id: 'mr-task-b', repoId: 'repo-b', status: 'today', title: 'Task B' })

      const decisionA: SchedulerBrainDecision = {
        taskId: taskA,
        spawnOptions: { repoId: 'repo-a', name: 'agent-a', cwd: '/tmp' },
        reason: 'run-a task',
      }
      const decisionB: SchedulerBrainDecision = {
        taskId: taskB,
        spawnOptions: { repoId: 'repo-b', name: 'agent-b', cwd: '/tmp' },
        reason: 'run-b task',
      }

      const brain = { decide: vi.fn()
        .mockResolvedValueOnce(decisionA)
        .mockResolvedValueOnce(decisionB)
        .mockResolvedValue(null)
      }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-id') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const runA = scheduler.start({ sprintName: 'sprint-a', repoId: 'repo-a', taskIds: [taskA] })
      const runB = scheduler.start({ sprintName: 'sprint-b', repoId: 'repo-b', taskIds: [taskB] })
      expect(runA.status).toBe('running')
      expect(runB.status).toBe('running')

      // Tick 1: dispatches from the oldest run
      await vi.advanceTimersByTimeAsync(1)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // Tick 2: dispatches from the second run
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(2)

      // Verify both runs got a dispatch
      const callArgs = dispatch.execute.mock.calls
      const dispatchedRunIds = callArgs.map((args: unknown[]) => args[2])
      expect(dispatchedRunIds).toContain(runA.id)
      expect(dispatchedRunIds).toContain(runB.id)
    })

    it('dispatches from oldest-first (FIFO by createdAt)', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskOld = insertTestTask(db, { id: 'mr-task-old', repoId: 'repo-old', status: 'today', title: 'Old Task' })
      const taskNew = insertTestTask(db, { id: 'mr-task-new', repoId: 'repo-new', status: 'today', title: 'New Task' })

      const decisionOld: SchedulerBrainDecision = {
        taskId: taskOld,
        spawnOptions: { repoId: 'repo-old', name: 'agent-old', cwd: '/tmp' },
        reason: 'oldest run',
      }
      const decisionNew: SchedulerBrainDecision = {
        taskId: taskNew,
        spawnOptions: { repoId: 'repo-new', name: 'agent-new', cwd: '/tmp' },
        reason: 'newest run',
      }

      const brain = { decide: vi.fn()
        .mockResolvedValueOnce(decisionOld)
        .mockResolvedValueOnce(decisionNew)
        .mockResolvedValue(null)
      }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-fifo') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      // Start runs in order — runOld is created first (older createdAt)
      const runOld = scheduler.start({ sprintName: 'sprint-old', repoId: 'repo-old', taskIds: [taskOld] })
      const runNew = scheduler.start({ sprintName: 'sprint-new', repoId: 'repo-new', taskIds: [taskNew] })

      // Tick 1: the OLDEST run (by createdAt) must dispatch first
      await vi.advanceTimersByTimeAsync(1)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-old' }),
        taskOld,
        runOld.id
      )

      // Tick 2: now the newer run dispatches
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(2)
      expect(dispatch.execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ repoId: 'repo-new' }),
        taskNew,
        runNew.id
      )
    })

    it('dispatches at most 1 task per tick across all active runs', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskA = insertTestTask(db, { id: 'mr-throughput-a', repoId: 'repo-a', status: 'today' })
      const taskB = insertTestTask(db, { id: 'mr-throughput-b', repoId: 'repo-b', status: 'today' })
      const taskC = insertTestTask(db, { id: 'mr-throughput-c', repoId: 'repo-c', status: 'today' })

      const brain = { decide: vi.fn().mockImplementation(
        (ctx: { run: { repoId: string }; candidateTasks: Array<{ id: string }> }) => {
          const task = ctx.candidateTasks[0]
          if (!task) return Promise.resolve(null)
          return Promise.resolve({
            taskId: task.id,
            spawnOptions: { repoId: ctx.run.repoId, name: `agent-${task.id}`, cwd: '/tmp' },
            reason: 'throughput test',
          })
        }
      )}
      const dispatch = { execute: vi.fn().mockReturnValue('agent-throughput') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-a', repoId: 'repo-a', taskIds: [taskA] })
      scheduler.start({ sprintName: 'sprint-b', repoId: 'repo-b', taskIds: [taskB] })
      scheduler.start({ sprintName: 'sprint-c', repoId: 'repo-c', taskIds: [taskC] })

      // Single tick: must dispatch exactly 1 task, not 3
      await vi.advanceTimersByTimeAsync(1)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
    })

    it('skips a paused run and dispatches from the next active run', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskA = insertTestTask(db, { id: 'mr-paused-a', repoId: 'repo-a', status: 'today' })
      const taskB = insertTestTask(db, { id: 'mr-paused-b', repoId: 'repo-b', status: 'today' })

      const decisionB: SchedulerBrainDecision = {
        taskId: taskB,
        spawnOptions: { repoId: 'repo-b', name: 'agent-b', cwd: '/tmp' },
        reason: 'non-paused run',
      }
      const brain = { decide: vi.fn()
        .mockResolvedValueOnce(decisionB)
        .mockResolvedValue(null)
      }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-skip-paused') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const runA = scheduler.start({ sprintName: 'sprint-a', repoId: 'repo-a', taskIds: [taskA] })
      scheduler.start({ sprintName: 'sprint-b', repoId: 'repo-b', taskIds: [taskB] })

      // Pause the oldest run
      scheduler.pause(runA.id)

      // Tick: should skip paused runA and dispatch from runB
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-b' }),
        taskB,
        expect.any(String)
      )
    })

    it('budget exhaustion on one run does not block dispatch from another run', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskA = insertTestTask(db, { id: 'mr-budget-a', repoId: 'repo-a', status: 'today' })
      const taskB = insertTestTask(db, { id: 'mr-budget-b', repoId: 'repo-b', status: 'today' })

      const decisionB: SchedulerBrainDecision = {
        taskId: taskB,
        spawnOptions: { repoId: 'repo-b', name: 'agent-b', cwd: '/tmp' },
        reason: 'budget test',
      }
      const brain = { decide: vi.fn()
        .mockResolvedValueOnce(decisionB)
        .mockResolvedValue(null)
      }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-budget') }
      const deps = buildDeps(db, { brain, dispatch, maxAgents: 50 })
      scheduler = new OrchestratorScheduler(deps)

      const runA = scheduler.start({ sprintName: 'sprint-a', repoId: 'repo-a', taskIds: [taskA] })
      scheduler.start({ sprintName: 'sprint-b', repoId: 'repo-b', taskIds: [taskB] })

      // Exhaust budget on runA by setting agents_spawned to maxAgents
      db.prepare('UPDATE orchestrator_runs SET agents_spawned = 50 WHERE id = ?').run(runA.id)

      // Tick: runA budget exhausted → continue to runB → dispatch
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
      expect(dispatch.execute).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: 'repo-b' }),
        taskB,
        expect.any(String)
      )
    })

    it('agent:completed correlates to the correct run, not the most-recently-updated one (P3-2)', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()

      const taskA = insertTestTask(db, { id: 'mr-corr-a', repoId: 'repo-a', status: 'today', title: 'Corr A' })
      const taskB = insertTestTask(db, { id: 'mr-corr-b', repoId: 'repo-b', status: 'today', title: 'Corr B' })

      const decisionA: SchedulerBrainDecision = {
        taskId: taskA,
        spawnOptions: { repoId: 'repo-a', name: 'agent-a', cwd: '/tmp' },
        reason: 'run-a corr',
      }
      const decisionB: SchedulerBrainDecision = {
        taskId: taskB,
        spawnOptions: { repoId: 'repo-b', name: 'agent-b', cwd: '/tmp' },
        reason: 'run-b corr',
      }

      const brain = { decide: vi.fn()
        .mockResolvedValueOnce(decisionA)
        .mockResolvedValueOnce(decisionB)
        .mockResolvedValue(null)
      }
      const dispatch = { execute: vi.fn()
        .mockReturnValueOnce('agent-corr-a')
        .mockReturnValueOnce('agent-corr-b')
      }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const runA = scheduler.start({ sprintName: 'sprint-a', repoId: 'repo-a', taskIds: [taskA] })
      const runB = scheduler.start({ sprintName: 'sprint-b', repoId: 'repo-b', taskIds: [taskB] })

      // Tick 1: FIFO → dispatches from run-a (oldest), agent_id = 'agent-corr-a'
      await vi.advanceTimersByTimeAsync(1)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // Tick 2: dispatches from run-b, agent_id = 'agent-corr-b'
      // After this, run-b's updated_at > run-a's updated_at
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(2)

      // Emit completion for run-a's agent.
      // BUG (pre-fix): getActiveRun() returns run-b (most recently updated),
      // getActiveTaskLogByAgentId(runB.id, 'agent-corr-a') → null → event dropped.
      // FIX: run-agnostic lookup finds the task log in run-a directly.
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-corr-a', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      const logsA = getTaskLogsByRun(db, runA.id)
      expect(logsA.some(l => l.taskId === taskA && l.status === 'done')).toBe(true)

      // run-b's task should still be active (not affected by run-a's completion)
      const logsB = getTaskLogsByRun(db, runB.id)
      expect(logsB.some(l => l.taskId === taskB && l.status === 'active')).toBe(true)
    })

    it('budget gate uses run.agentLifetimeCap, not deps.maxAgents (P3-6 enforcement)', async () => {
      const taskA = insertTestTask(db, { id: 'alc-task-a', repoId: 'repo-1', status: 'today' })
      const taskB = insertTestTask(db, { id: 'alc-task-b', repoId: 'repo-1', status: 'today' })

      const decisionA: SchedulerBrainDecision = {
        taskId: taskA,
        spawnOptions: { repoId: 'repo-1', name: 'agent-alc-a', cwd: '/tmp' },
        reason: 'lifetime cap test',
      }
      const decisionB: SchedulerBrainDecision = {
        taskId: taskB,
        spawnOptions: { repoId: 'repo-1', name: 'agent-alc-b', cwd: '/tmp' },
        reason: 'lifetime cap test',
      }
      // Low per-run cap (1) but high global budget (50). Pre-fix, the gate checks
      // maxAgents=50 and would dispatch taskB on tick 2; with fix it checks
      // agentLifetimeCap=1 and blocks the second dispatch.
      const brain = { decide: vi.fn()
        .mockResolvedValueOnce(decisionA)
        .mockResolvedValueOnce(decisionB)
        .mockResolvedValue(null)
      }
      const dispatch = { execute: vi.fn()
        .mockReturnValueOnce('agent-alc-1')
        .mockReturnValueOnce('agent-alc-2')
      }
      const deps = buildDeps(db, { brain, dispatch, maxAgents: 50 })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-alc', repoId: 'repo-1', agentLifetimeCap: 1, taskIds: [taskA, taskB] })

      // Tick 1: dispatches taskA → agents_spawned reaches 1 (= agentLifetimeCap)
      await vi.advanceTimersByTimeAsync(1)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // Tick 2: budget gate fires at agentLifetimeCap=1 — must NOT dispatch taskB
      await vi.advanceTimersByTimeAsync(60_000)
      expect(dispatch.execute).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // promoteNextQueued()
  // -------------------------------------------------------------------------

  describe('promoteNextQueued()', () => {
    it('promotes a queued run to running when a slot frees on cancel', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })
      const queued = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-3' })
      expect(queued.status).toBe('queued')

      scheduler.cancel(run1.id)

      const promoted = getRun(db, queued.id)
      expect(promoted!.status).toBe('running')
    })

    it('promotes a queued run to running when a slot frees on completion', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const taskId = insertTestTask(db, { id: 'complete-task', repoId: 'repo-1', status: 'today' })
      // Add a task for repo-3 so the promoted run doesn't immediately complete
      const taskForQueued = insertTestTask(db, { id: 'queued-task', repoId: 'repo-3', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-complete', cwd: '/tmp' },
        reason: 'test',
      }
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-complete-id') },
      })
      scheduler = new OrchestratorScheduler(deps)

      scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1', taskIds: [taskId] })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })
      const queued = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-3', taskIds: [taskForQueued] })
      expect(queued.status).toBe('queued')

      // Dispatch the task in sprint-1
      await vi.advanceTimersByTimeAsync(1)

      // Complete the agent — triggers maybeCompleteRun
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-complete-id', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      const promoted = getRun(db, queued.id)
      expect(promoted!.status).toBe('running')
    })

    it('promotes queued runs in FIFO order (created_at ASC)', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })
      const queuedFirst = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-3' })
      const queuedSecond = scheduler.start({ sprintName: 'sprint-4', repoId: 'repo-4' })
      expect(queuedFirst.status).toBe('queued')
      expect(queuedSecond.status).toBe('queued')

      // Cancel run1 — should promote sprint-3 (first queued), NOT sprint-4
      scheduler.cancel(run1.id)

      expect(getRun(db, queuedFirst.id)!.status).toBe('running')
      expect(getRun(db, queuedSecond.id)!.status).toBe('queued')
    })

    it('does not promote when there are no queued runs', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })

      // Cancel run1 — no queued runs exist, should not throw or error
      scheduler.cancel(run1.id)

      const active = getActiveRuns(db)
      expect(active).toHaveLength(1)
      expect(getQueuedRuns(db)).toHaveLength(0)
    })

    it('does not promote when maxConcurrentRuns is 1 (legacy mode)', () => {
      // Default maxConcurrentRuns=1 — legacy mode never queues
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })

      // Manually insert a queued run to simulate edge case
      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO orchestrator_runs
           (id, sprint_name, repo_id, status, concurrency_cap, agents_spawned, created_at, updated_at)
         VALUES ('manual-queued', 'sprint-q', 'repo-q', 'queued', 3, 0, ?, ?)`
      ).run(now, now)

      scheduler.cancel(run1.id)

      // The manually-inserted queued run should NOT be promoted
      expect(getRun(db, 'manual-queued')!.status).toBe('queued')
    })

    it('does not over-promote past the concurrency cap', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      const run1 = scheduler.start({ sprintName: 'sprint-1', repoId: 'repo-1' })
      scheduler.start({ sprintName: 'sprint-2', repoId: 'repo-2' })
      const queued1 = scheduler.start({ sprintName: 'sprint-3', repoId: 'repo-3' })
      const queued2 = scheduler.start({ sprintName: 'sprint-4', repoId: 'repo-4' })

      // Cancel only 1 run — should promote exactly 1 queued run, not both
      scheduler.cancel(run1.id)

      const activeAfter = getActiveRuns(db)
      expect(activeAfter).toHaveLength(2)  // sprint-2 + sprint-3

      expect(getRun(db, queued1.id)!.status).toBe('running')
      expect(getRun(db, queued2.id)!.status).toBe('queued')
    })

    it('promotes queued runs after recoverOrphanedState fails stale runs', () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const deps = buildDeps(db)
      scheduler = new OrchestratorScheduler(deps)

      // Insert a stale run (>2h old, running, no active logs)
      db.prepare(
        `INSERT INTO orchestrator_runs
           (id, sprint_name, repo_id, status, concurrency_cap, agents_spawned, created_at, updated_at)
         VALUES ('stale-run-promote', 'old-sprint', 'repo-1', 'running', 3, 0,
                 datetime('now', '-3 hours'), datetime('now', '-3 hours'))`
      ).run()

      // Insert a healthy running run
      scheduler.start({ sprintName: 'healthy', repoId: 'repo-2' })

      // Insert a queued run
      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO orchestrator_runs
           (id, sprint_name, repo_id, status, concurrency_cap, agents_spawned, created_at, updated_at)
         VALUES ('queued-for-promote', 'waiting-sprint', 'repo-3', 'queued', 3, 0, ?, ?)`
      ).run(now, now)

      scheduler.recoverOrphanedState()

      // The stale run should be failed, and the queued run should be promoted
      expect(getRun(db, 'stale-run-promote')!.status).toBe('failed')
      expect(getRun(db, 'queued-for-promote')!.status).toBe('running')
    })
  })

  // -------------------------------------------------------------------------
  // cancel-then-complete race (H-1)
  // -------------------------------------------------------------------------

  describe('cancel-then-complete race (H-1)', () => {
    it('ignores agent:completed after run is cancelled', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-race', cwd: '/tmp' },
        reason: 'race test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-race-1') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'race-sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(60_000) // dispatch tick
      expect(dispatch.execute).toHaveBeenCalledTimes(1)

      // Cancel the run while the agent is still active
      scheduler.cancel(run.id)
      expect(getRun(db, run.id)!.status).toBe('cancelled')

      // Late agent:completed arrives after cancel
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-race-1', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      // The task log should NOT have been marked 'done' by the event handler —
      // cancel() already reset active logs to backlog via its own safeguard.
      const logs = getTaskLogsByRun(db, run.id)
      const doneLogs = logs.filter(l => l.taskId === taskId && l.status === 'done')
      expect(doneLogs.length).toBe(0)
    })

    it('ignores agent:failed after run is cancelled', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-race-f', cwd: '/tmp' },
        reason: 'race test fail',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-race-f1') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'race-sprint-f', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(60_000)

      scheduler.cancel(run.id)

      // Late agent:failed arrives after cancel
      emitOrchestratorEvent({
        type: 'agent:failed',
        triageEvent: fakeTriageEvent('agent-race-f1', 'error'),
      })
      await vi.advanceTimersByTimeAsync(1)

      // No retry should have been scheduled — the event was dropped
      const logs = getTaskLogsByRun(db, run.id)
      const failedByEvent = logs.filter(l => l.taskId === taskId && l.status === 'failed')
      // The late event must not create a 'failed' phase log (H-1 guard drops it),
      // and no retry dispatch should occur.
      expect(failedByEvent.length).toBe(0)
      expect(dispatch.execute).toHaveBeenCalledTimes(1) // no retry dispatch
    })

    it('ignores agent:completed after run has already completed', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-done', cwd: '/tmp' },
        reason: 'completion race test',
      }
      const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
      const dispatch = { execute: vi.fn().mockReturnValue('agent-done-1') }
      const deps = buildDeps(db, { brain, dispatch })
      scheduler = new OrchestratorScheduler(deps)

      const run = scheduler.start({ sprintName: 'done-sprint', repoId: 'repo-1', taskIds: [taskId] })
      await vi.advanceTimersByTimeAsync(60_000)

      // Complete the task normally
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-done-1', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      // Run should now be completed (single task, all done)
      const runAfter = getRun(db, run.id)!
      expect(runAfter.status).toBe('completed')

      // Duplicate agent:completed arrives (e.g. reconciliation + event race)
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-done-1', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      // Run should still be completed, no crash or state corruption
      expect(getRun(db, run.id)!.status).toBe('completed')
    })
  })

  // -------------------------------------------------------------------------
  // heartbeat
  // -------------------------------------------------------------------------

  describe('heartbeat', () => {
    it('emits heartbeat for active run with telegramNotify=true at the configured cadence', async () => {
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 3_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'hb-sprint', repoId: 'repo-1', telegramNotify: true })

      // Advance to the cadence boundary; the first tick at T+0 records the base time,
      // then the tick at T+3000 sees elapsed >= cadence and fires the heartbeat.
      await vi.advanceTimersByTimeAsync(3_000)

      const calls = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat')
      expect(calls).toHaveLength(1)
      expect(calls[0][0]).toContain('hb-sprint')
    })

    it('does not emit heartbeat when telegramNotify=false', async () => {
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 1_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'silent-sprint', repoId: 'repo-1', telegramNotify: false })

      await vi.advanceTimersByTimeAsync(5_000)

      const calls = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat')
      expect(calls).toHaveLength(0)
    })

    it('does not emit heartbeat for a paused run', async () => {
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 1_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      const run = scheduler.start({ sprintName: 'paused-hb', repoId: 'repo-1', telegramNotify: true })
      // Advance once to record base time, then pause
      await vi.advanceTimersByTimeAsync(0)
      scheduler.pause(run.id)
      sendTelegramNotification.mockClear()

      await vi.advanceTimersByTimeAsync(5_000)

      const calls = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat')
      expect(calls).toHaveLength(0)
    })

    it('does not emit heartbeat for a queued run', async () => {
      // Queued runs are not in the active-runs list, so the heartbeat pass skips them.
      // maxConcurrentRuns=1 is the default; a second start() returns the existing active run.
      // To get a truly queued run, we need maxConcurrentRuns=2 and fill both slots, then queue a third.
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '2')").run()
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 1_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'active-a', repoId: 'repo-1', telegramNotify: true })
      scheduler.start({ sprintName: 'active-b', repoId: 'repo-2', telegramNotify: true })
      const queued = scheduler.start({ sprintName: 'queued-hb', repoId: 'repo-3', telegramNotify: true })
      expect(queued.status).toBe('queued')
      sendTelegramNotification.mockClear()

      await vi.advanceTimersByTimeAsync(5_000)

      const calls = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat')
      const queuedCalls = calls.filter(([s]) => (s as string).includes('queued-hb'))
      expect(queuedCalls).toHaveLength(0)
    })

    it('deduplication: emits only once within the cadence window', async () => {
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 5_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'dedup-hb', repoId: 'repo-1', telegramNotify: true })

      // First cadence: T+0 base, T+5000 fires first heartbeat
      await vi.advanceTimersByTimeAsync(5_000)
      const after5s = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat').length
      expect(after5s).toBe(1)

      // 2s later (7s total): elapsed since last = 2s < 5s cadence → no second heartbeat
      await vi.advanceTimersByTimeAsync(2_000)
      const after7s = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat').length
      expect(after7s).toBe(1)

      // 4s more (11s total): elapsed since last = 6s >= 5s cadence → second heartbeat
      await vi.advanceTimersByTimeAsync(4_000)
      const after11s = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat').length
      expect(after11s).toBe(2)
    })

    it('emits heartbeat independently for each active run', async () => {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.maxConcurrentRuns', '3')").run()
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 2_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'multi-a', repoId: 'repo-1', telegramNotify: true })
      scheduler.start({ sprintName: 'multi-b', repoId: 'repo-2', telegramNotify: true })

      await vi.advanceTimersByTimeAsync(3_000)

      const calls = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat')
      const abeats = calls.filter(([s]) => (s as string).includes('multi-a'))
      const bbeats = calls.filter(([s]) => (s as string).includes('multi-b'))
      expect(abeats.length).toBeGreaterThanOrEqual(1)
      expect(bbeats.length).toBeGreaterThanOrEqual(1)
    })

    it('delivery failure does not affect run state or pause the run', async () => {
      const sendTelegramNotification = vi.fn(() => { throw new Error('network timeout') })
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 1_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      const run = scheduler.start({ sprintName: 'resilient-hb', repoId: 'repo-1', telegramNotify: true })

      await vi.advanceTimersByTimeAsync(5_000)

      expect(getRun(db, run.id)!.status).toBe('running')
    })

    it('heartbeat summary contains sprint name, task counts, and fits within 200 chars', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today', title: 'Widget build' })
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 1_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'content-sprint', repoId: 'repo-1', taskIds: [taskId], telegramNotify: true })

      await vi.advanceTimersByTimeAsync(2_000)

      const calls = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat')
      expect(calls.length).toBeGreaterThanOrEqual(1)
      const [summary, , repoId] = calls[0] as [string, string, string]
      expect(summary).toContain('content-sprint')
      expect(summary.length).toBeLessThanOrEqual(200)
      expect(repoId).toBe('repo-1')
    })

    it('stops emitting heartbeat after run completes', async () => {
      const taskId = insertTestTask(db, { repoId: 'repo-1', status: 'today', title: 'Complete task' })
      const decision: SchedulerBrainDecision = {
        taskId,
        spawnOptions: { repoId: 'repo-1', name: 'agent-1', cwd: '/tmp' },
        reason: 'test',
      }
      const sendTelegramNotification = vi.fn()
      const deps = buildDeps(db, {
        brain: { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) },
        dispatch: { execute: vi.fn().mockReturnValue('agent-hb-complete') },
        sendTelegramNotification,
        tickIntervalMs: 1_000,
        heartbeatIntervalMs: 2_000,
      })
      scheduler = new OrchestratorScheduler(deps)
      scheduler.start({ sprintName: 'done-sprint', repoId: 'repo-1', taskIds: [taskId], telegramNotify: true })
      await vi.advanceTimersByTimeAsync(0)

      // Complete the task and run
      emitOrchestratorEvent({
        type: 'agent:completed',
        triageEvent: fakeTriageEvent('agent-hb-complete', 'completed'),
      })
      await vi.advanceTimersByTimeAsync(1)

      // Run is now completed; clear all call history
      expect(getRun(db, scheduler.getStatus().activeRuns[0]?.id ?? 'x')?.status ?? 'completed').toBe('completed')
      sendTelegramNotification.mockClear()

      // Advance well past cadence — no more heartbeats
      await vi.advanceTimersByTimeAsync(5_000)
      const calls = sendTelegramNotification.mock.calls.filter(([, t]) => t === 'run_heartbeat')
      expect(calls).toHaveLength(0)
    })
  })
})

// ===========================================================================
// C-T1 (Sprint C, RED): Anamnesis event emission + M4 sprint inventory check.
// Real in-memory SQLite with ALL migrations (getDb(':memory:')), not the hand-rolled schema above.
// ===========================================================================
import log from 'electron-log/main'
import { getDb, closeDb, resetDb } from '../db/connection'
import { insertRepo } from '../db/queries/repos.queries'
import { insertAgent, purgeDeadAgents } from '../db/queries/agents.queries'
import { insertTask as insertKanbanTask, updateTask } from '../db/queries/tasks.queries'
import { insertSBAR } from '../db/queries/sbar.queries'
import { getEventsByTask } from '../db/queries/task-events.queries'
import { storeAnamnesisSecret } from './secret-store'

// Electron boundary — safeStorage needs a running Electron process (used by secret-store for M4).
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plain: string) => Buffer.from(`enc:${plain}`, 'utf8'),
    decryptString: (buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''),
  },
}))

const SBAR_TEXT = {
  situation: 'Situation: orchestrated task finished',
  background: 'Background: changed the writer',
  assessment: 'Assessment: all green',
  recommendation: 'Recommendation: go to review gate',
}

describe('OrchestratorScheduler — Anamnesis events (real migrated DB)', () => {
  let rdb: Database.Database
  let scheduler: OrchestratorScheduler
  let repoId: string
  let agentId: string
  let taskId: string

  beforeEach(() => {
    vi.useFakeTimers()
    resetDb()
    rdb = getDb(':memory:')
    rdb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.enabled', 'true')").run()
    repoId = insertRepo(rdb, { name: 'repo-a', path: '/tmp/repo-a' }).id
    agentId = insertAgent(rdb, { repoId, name: 'agent-1', cwd: '/tmp/repo-a' }).id
    taskId = insertKanbanTask(rdb, { repoId, title: 'Orchestrated task', status: 'today' }).id
  })

  afterEach(() => {
    scheduler?.stop()
    closeDb()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** Dispatch the task to `agentId` the way service-orchestrator does: link agent_id, leave status to the scheduler. */
  async function startAndDispatch(): Promise<string> {
    const decision: SchedulerBrainDecision = {
      taskId,
      spawnOptions: { repoId, name: 'agent-1', cwd: '/tmp/repo-a' },
      reason: 'test',
    }
    const brain = { decide: vi.fn().mockResolvedValueOnce(decision).mockResolvedValue(null) }
    const dispatch = {
      execute: vi.fn((_opts: unknown, tid: string) => {
        updateTask(rdb, tid, { agentId })
        return agentId
      }),
    }
    scheduler = new OrchestratorScheduler(
      buildDeps(rdb, { brain, dispatch: dispatch as unknown as SchedulerDeps['dispatch'] })
    )
    const run = scheduler.start({ sprintName: 'sprint-c', repoId, taskIds: [taskId] })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(dispatch.execute).toHaveBeenCalledTimes(1)
    return run.id
  }

  function seedSbar(): void {
    insertSBAR(rdb, { agentId, agentName: 'agent-1', repoId, ...SBAR_TEXT })
  }

  async function completeAgent(): Promise<void> {
    emitOrchestratorEvent({ type: 'agent:completed', triageEvent: fakeTriageEvent(agentId, 'completed') })
    await vi.advanceTimersByTimeAsync(1)
  }

  const completedEvents = (): TaskEvent[] => getEventsByTask(rdb, taskId).filter((e) => e.eventType === 'CARD_COMPLETED')

  it('records the dispatch transition today → in_progress exactly once (scheduler.ts:760)', async () => {
    await startAndDispatch()

    const moves = getEventsByTask(rdb, taskId).filter(
      (e) => e.eventType === 'CARD_TRANSITION' && e.fromStatus === 'today' && e.toStatus === 'in_progress'
    )
    expect(moves).toHaveLength(1)
  })

  it('emits exactly 1 CARD_COMPLETED carrying the SBAR payload on agent:completed', async () => {
    await startAndDispatch()
    seedSbar()

    await completeAgent()

    const events = completedEvents()
    expect(events).toHaveLength(1)
    expect(events[0].toStatus).toBe('completed')
    expect(events[0].agentId).toBe(agentId)
    const payload = JSON.parse(events[0].payloadJson) as { sbar: Record<string, string> }
    expect(payload.sbar).toMatchObject(SBAR_TEXT)
  })

  it('still emits CARD_COMPLETED when the task is already completed (tasks.queries.ts:107 race)', async () => {
    await startAndDispatch()
    seedSbar()
    rdb.prepare("UPDATE tasks SET status = 'completed' WHERE id = ?").run(taskId)

    await completeAgent()

    expect(completedEvents()).toHaveLength(1)
  })

  it('copies the SBAR into the task log summary_json (existing updateTaskLogSummary)', async () => {
    const runId = await startAndDispatch()
    seedSbar()

    await completeAgent()

    const taskLog = getTaskLogsByRun(rdb, runId).find((l) => l.taskId === taskId)
    expect(taskLog?.summaryJson).toBeTruthy()
    expect(taskLog?.summaryJson).toContain(SBAR_TEXT.situation)
  })

  it('keeps the SBAR in the event and in summary_json after purgeDeadAgents deletes the SBAR rows', async () => {
    const runId = await startAndDispatch()
    seedSbar()
    await completeAgent()
    rdb.prepare("UPDATE agents SET status = 'completed', updated_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(agentId)

    expect(purgeDeadAgents(rdb, 24)).toBe(1)

    expect(rdb.prepare('SELECT COUNT(*) AS n FROM sbar_handoffs').get()).toEqual({ n: 0 })
    const events = completedEvents()
    expect(events).toHaveLength(1)
    expect((JSON.parse(events[0].payloadJson) as { sbar: Record<string, string> }).sbar).toMatchObject(SBAR_TEXT)
    const taskLog = getTaskLogsByRun(rdb, runId).find((l) => l.taskId === taskId)
    expect(taskLog?.summaryJson).toContain(SBAR_TEXT.situation)
  })

  it('records the reset transition in_progress → backlog when an active task is cancelled (scheduler.ts:371)', async () => {
    const runId = await startAndDispatch()

    scheduler.cancel(runId)

    const resets = getEventsByTask(rdb, taskId).filter(
      (e) => e.eventType === 'CARD_TRANSITION' && e.fromStatus === 'in_progress' && e.toStatus === 'backlog'
    )
    expect(resets).toHaveLength(1)
  })
})

describe('OrchestratorScheduler — M4 sprint inventory check (real secret-store)', () => {
  let rdb: Database.Database
  let scheduler: OrchestratorScheduler
  let repoId: string
  let warnSpy: ReturnType<typeof vi.spyOn>

  type FetchCall = { url: URL; init?: RequestInit }

  /** External HTTP boundary: fake Anamnesis. GET /projects/{name} resolves the repo; any other GET returns `records`. */
  function stubAnamnesis(records: unknown[]): FetchCall[] {
    const calls: FetchCall[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input))
        calls.push({ url, init })
        if (url.pathname.startsWith('/projects/')) {
          return new Response(JSON.stringify({ id: 'proj-uuid' }), { status: 200 })
        }
        return new Response(
          JSON.stringify({ records, total_candidates: records.length, budget_used: 0, token_budget: 20000, detail_level: 'summary', gaps: [] }),
          { status: 200 }
        )
      })
    )
    return calls
  }

  /** Real recall(domain=sprint_inventory) record shape: `content` is a JSON STRING; status/sprint_name live in its nested `content`. */
  function inventoryRecord(sprintName: string, status: string): Record<string, unknown> {
    return {
      memory_id: 'mem-1',
      layer: 'episodic',
      source_entity: 'hephaestus',
      project_id: 'proj-uuid',
      domain: null,
      content: JSON.stringify({
        layer: 'procedural',
        pattern_type: 'sprint_structure',
        domain: 'sprint_inventory',
        content: { sprint_name: sprintName, status },
      }),
    }
  }

  async function startSprint(sprintName: string): Promise<void> {
    scheduler = new OrchestratorScheduler(buildDeps(rdb))
    scheduler.start({ sprintName, repoId })
    await vi.advanceTimersByTimeAsync(10) // let the fire-and-forget M4 promise chain settle
  }

  beforeEach(() => {
    vi.useFakeTimers()
    resetDb()
    rdb = getDb(':memory:')
    rdb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orchestrator.enabled', 'true')").run()
    repoId = insertRepo(rdb, { name: 'repo-a', path: '/tmp/repo-a' }).id
    warnSpy = vi.spyOn(log, 'warn')
    vi.stubEnv('OPTIMAEUS_SYSTEM', 'true') // S90: M4 runs in system mode only
  })

  afterEach(() => {
    scheduler?.stop()
    closeDb()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reads the secret from secret-store, not from process.env (env would win today)', async () => {
    storeAnamnesisSecret('stored-secret')
    vi.stubEnv('ANAMNESIS_AUTH_SECRET', 'env-secret')
    const calls = stubAnamnesis([])

    await startSprint('sprint-c')

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      const headers = call.init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer stored-secret')
    }
  })

  // S89: the M4 bearer goes through the shared https/loopback validation like the writer/reader.
  it('S89: withholds the bearer when ANAMNESIS_URL is plain http to a non-loopback host', async () => {
    storeAnamnesisSecret('stored-secret')
    vi.stubEnv('ANAMNESIS_URL', 'http://anamnesis.example.test:9300')
    insertKanbanTask(rdb, { repoId, title: 'S89 task', sprintName: 'sprint-s89' })
    const calls = stubAnamnesis([])

    await startSprint('sprint-s89')

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      const headers = call.init?.headers as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
      expect(JSON.stringify(headers)).not.toContain('stored-secret')
    }
  })

  it('S89: still sends the bearer to a loopback http ANAMNESIS_URL', async () => {
    storeAnamnesisSecret('stored-secret')
    vi.stubEnv('ANAMNESIS_URL', 'http://127.0.0.1:9300')
    insertKanbanTask(rdb, { repoId, title: 'S89 task', sprintName: 'sprint-s89' })
    const calls = stubAnamnesis([])

    await startSprint('sprint-s89')

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      const headers = call.init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer stored-secret')
    }
  })

  it('is skipped (no HTTP) when only the env var is set and nothing is stored', async () => {
    vi.stubEnv('ANAMNESIS_AUTH_SECRET', 'env-secret')
    const calls = stubAnamnesis([])

    await startSprint('sprint-c')

    expect(calls).toHaveLength(0)
  })

  it('queries the real retrieve endpoint for the sprint_inventory domain with a resolved project id', async () => {
    storeAnamnesisSecret('stored-secret')
    const calls = stubAnamnesis([])

    await startSprint('sprint-c')

    // S90: side-effect-free lookup — GET /projects/{name}, never POST /projects
    const projectCall = calls.find((c) => c.url.pathname === '/projects/repo-a')
    expect(projectCall).toBeDefined()
    expect((projectCall?.init?.method ?? 'GET').toUpperCase()).toBe('GET')
    expect(projectCall?.init?.body).toBeUndefined()

    const retrieve = calls.find((c) => c.url.pathname === '/memory/retrieve')
    expect(retrieve, 'expected GET /memory/retrieve (what recall(domain=sprint_inventory) calls)').toBeDefined()
    expect(retrieve?.url.searchParams.get('project_id')).toBe('proj-uuid')
    expect(retrieve?.url.searchParams.get('query')).toContain('sprint_inventory')
    expect(calls.some((c) => c.url.pathname.startsWith('/api/v1'))).toBe(false)
  })

  it('warns when the retrieve response holds a done/in_progress inventory record for this sprint', async () => {
    storeAnamnesisSecret('stored-secret')
    stubAnamnesis([inventoryRecord('sprint-c', 'done')])

    await startSprint('sprint-c')

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('M4 sprint inventory found existing work'),
      expect.objectContaining({ sprintName: 'sprint-c', existingStatus: 'done' })
    )
  })

  // C-T5f (RED): S90 — the pre-flight check is side-effect free and runs only in system mode.
  it('S90: never POSTs /projects on sprint start; resolves the project with GET /projects/{name}', async () => {
    vi.stubEnv('OPTIMAEUS_SYSTEM', 'true')
    storeAnamnesisSecret('stored-secret')
    const calls: FetchCall[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input))
        calls.push({ url, init })
        if (url.pathname === '/projects/repo-a') return new Response(JSON.stringify({ id: 'proj-uuid' }), { status: 200 })
        if (url.pathname === '/memory/retrieve') return new Response(JSON.stringify({ records: [] }), { status: 200 })
        return new Response('{}', { status: 404 })
      })
    )

    await startSprint('sprint-c')

    expect(calls.filter((c) => (c.init?.method ?? 'GET').toUpperCase() !== 'GET')).toHaveLength(0)
    expect(calls.some((c) => c.url.pathname === '/projects/repo-a')).toBe(true)
    const retrieve = calls.find((c) => c.url.pathname === '/memory/retrieve')
    expect(retrieve?.url.searchParams.get('project_id')).toBe('proj-uuid')
  })

  it('S90: stops without retrieving when the project is not registered in Anamnesis (404)', async () => {
    vi.stubEnv('OPTIMAEUS_SYSTEM', 'true')
    storeAnamnesisSecret('stored-secret')
    const calls: FetchCall[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: new URL(String(input)), init })
        return new Response('{"detail":"not found"}', { status: 404 })
      })
    )

    await startSprint('sprint-c')

    expect(calls.map((c) => c.url.pathname)).toEqual(['/projects/repo-a'])
  })

  it('S90: is skipped (no HTTP) outside system mode even with a stored secret', async () => {
    vi.stubEnv('OPTIMAEUS_SYSTEM', 'false')
    storeAnamnesisSecret('stored-secret')
    const calls = stubAnamnesis([])

    await startSprint('sprint-c')

    expect(calls).toHaveLength(0)
  })

  it('does not warn for a not_done record or a different sprint', async () => {
    storeAnamnesisSecret('stored-secret')
    const calls = stubAnamnesis([inventoryRecord('sprint-c', 'not_done'), inventoryRecord('other-sprint', 'done')])

    await startSprint('sprint-c')

    // guard against a vacuous pass: the inventory must actually have been fetched
    expect(calls.some((c) => c.url.pathname === '/memory/retrieve')).toBe(true)
    const found = warnSpy.mock.calls.filter(([msg]) => String(msg).includes('found existing work'))
    expect(found).toHaveLength(0)
  })
})
