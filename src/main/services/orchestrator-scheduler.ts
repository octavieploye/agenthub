import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { SlidingWindowLimiter } from './helpers/rate-limiter'
import {
  onOrchestratorEvent,
  offOrchestratorEvent,
  type OrchestratorAgentEvent,
} from './agent-lifecycle-bus'
import { getDispatchableTasks } from './helpers/dependency-solver'
import {
  getRun,
  getActiveRuns,
  getQueuedRuns,
  insertRun,
  updateRunStatus,
  updateRunTimestamp,
  incrementAgentsSpawned,
  getAgentsSpawned,
  insertTaskLog,
  updateTaskLogStatus,
  getTaskLogsByRun,
  getActiveTaskLogs,
  getActiveTaskLogByAgentId,
  getActiveTaskLogByAgentIdAnyRun,
  getTaskLogsByTask,
  getCompletedTaskIds,
  insertApproval,
  getApproval,
  updateApprovalStatus,
  resetApprovalToPending,
  deleteApprovalsForRun,
  updateRunTelegramNotify,
  resetRunStartedAt,
} from '../db/queries/orchestrator.queries'
import { getTasksByRepo, getTaskById, updateTask } from '../db/queries/tasks.queries'
import { getDependencyMap } from '../db/queries/task-dependencies.queries'
import { isOrchestratorEnabled, getApprovalWindowMinutes, getMaxConcurrentRuns } from './orchestrator-settings'
import type { OrchestratorLifecycleNotificationType } from '../db/queries/telegram-notifications.queries'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import { DEFAULT_ANAMNESIS_URL } from '../../shared/constants/defaults'
import type {
  OrchestratorRun,
  OrchestratorRunStatus,
  OrchestratorStatusResponse,
  OrchestratorTaskLog,
  OrchestratorStatusChangePayload,
  OrchestratorTriggerSource,
} from '../../shared/types/orchestrator.types'
import type { AgentLifecycleStatus, AgentSpawnOptions } from '../../shared/types/agent.types'
import type { TaskItem } from '../../shared/types/task.types'

// ---------------------------------------------------------------------------
// Brain / Validator / Dispatch contract types
// ---------------------------------------------------------------------------

export interface SchedulerBrainContext {
  run: OrchestratorRun
  candidateTasks: TaskItem[]
  activeLogs: OrchestratorTaskLog[]
  completedTaskIds: string[]
  agentsSpawned: number
  maxAgents: number
  tickCount: number
}

export interface SchedulerBrainDecision {
  taskId: string
  spawnOptions: AgentSpawnOptions
  reason: string
}

export interface ValidationOutcome {
  valid: boolean
  failures: string[]
}

// ---------------------------------------------------------------------------
// Public dependency interface
// ---------------------------------------------------------------------------

export interface SchedulerDeps {
  db: Database.Database
  brain: { decide(context: SchedulerBrainContext): Promise<SchedulerBrainDecision | null> }
  validator: { validate(decision: SchedulerBrainDecision, run: OrchestratorRun): ValidationOutcome }
  dispatch: { execute(spawnOptions: AgentSpawnOptions, taskId: string, runId: string): string | null }
  emitToRenderer: (channel: string, ...args: unknown[]) => void
  maxAgents: number
  tickIntervalMs?: number
  getAgentStatus?: (agentId: string) => AgentLifecycleStatus | null
  notifyApproval?: (taskId: string, runId: string, title: string, repoId: string, sprintName?: string, description?: string) => void
  sendTelegramNotification?: (summary: string, type: OrchestratorLifecycleNotificationType, repoId?: string, agentId?: string) => void
}

// ---------------------------------------------------------------------------
// In-memory retry tracking
// ---------------------------------------------------------------------------

interface RetryRecord {
  count: number
}

// ---------------------------------------------------------------------------
// OrchestratorScheduler
// ---------------------------------------------------------------------------

export class OrchestratorScheduler {
  private readonly db: Database.Database
  private readonly deps: SchedulerDeps
  private readonly rateLimiter: SlidingWindowLimiter
  private readonly tickIntervalMs: number

  private tickHandle: ReturnType<typeof setInterval> | null = null
  private immediateTickHandle: ReturnType<typeof setTimeout> | null = null
  private tickCount = 0
  private tickInFlight = false
  private tickRequested = false
  private pausedRunIds = new Set<string>()
  private retryMap = new Map<string, RetryRecord>()

  // Bound handlers stored so we can remove them in stop()
  private readonly onCompleted: (e: OrchestratorAgentEvent) => void
  private readonly onFailed: (e: OrchestratorAgentEvent) => void

  /** Composite key for retryMap scoped to a specific run */
  private retryKey(runId: string, taskId: string): string {
    return `${runId}:${taskId}`
  }

  constructor(deps: SchedulerDeps) {
    this.deps = deps
    this.db = deps.db
    this.tickIntervalMs = deps.tickIntervalMs ?? 60_000

    // Allow at most maxAgents dispatches per tickInterval window
    this.rateLimiter = new SlidingWindowLimiter(deps.maxAgents, this.tickIntervalMs)

    this.onCompleted = (e) => this.handleAgentEvent(e)
    this.onFailed = (e) => this.handleAgentEvent(e)

    onOrchestratorEvent('agent:completed', this.onCompleted)
    onOrchestratorEvent('agent:failed', this.onFailed)
  }

  // -------------------------------------------------------------------------
  // Lifecycle — public API consumed by service-orchestrator.ts
  // -------------------------------------------------------------------------

  start(input: {
    sprintName?: string
    taskIds?: string[]
    repoId?: string
    projectId?: string
    concurrencyCap?: number
    telegramNotify?: boolean
    agentLifetimeCap?: number
    startedBy?: string
    singleTaskId?: string
    triggerSource?: OrchestratorTriggerSource
  }): OrchestratorRun {
    if (!isOrchestratorEnabled(this.db)) {
      throw new Error('ORCHESTRATOR_DISABLED: orchestrator.enabled is not set to true')
    }

    // M-4: a run must never silently fall back to a fake 'default' repo. Require a
    // real repoId up front rather than persisting a run that matches no repository.
    if (!input.repoId || input.repoId.trim() === '') {
      throw new Error('ORCHESTRATOR_START_REQUIRES_REPO_ID: repoId is required')
    }
    const repoId = input.repoId

    // Slot-aware admission: queue when active-run count reaches maxConcurrentRuns
    const activeRuns = getActiveRuns(this.db)
    const maxConcurrentRuns = getMaxConcurrentRuns(this.db)

    // Legacy P0 behaviour: at the default setting (maxConcurrentRuns=1),
    // re-use the existing active run instead of queueing a second one.
    if (maxConcurrentRuns === 1 && activeRuns.length >= 1) {
      const existing = activeRuns[0]
      if (input.telegramNotify && !existing.telegramNotify) {
        updateRunTelegramNotify(this.db, existing.id, true)
      }
      this.ensureTicking()
      // M-1: promote-only — updateRunTelegramNotify only ever sets true (never demotes),
      // so the effective value is `existing || input`. `??` would wrongly report false
      // when input is explicitly false while the persisted run still notifies.
      return { ...existing, telegramNotify: existing.telegramNotify || (input.telegramNotify ?? false) }
    }

    if (activeRuns.length >= maxConcurrentRuns) {
      const run = insertRun(this.db, {
        sprintName: input.sprintName ?? 'manual',
        repoId,
        projectId: input.projectId,
        taskIds: input.taskIds,
        triggerSource: input.triggerSource ?? 'manual',
        startedBy: input.startedBy,
        singleTaskId: input.singleTaskId,
        concurrencyCap: input.concurrencyCap,
        agentLifetimeCap: input.agentLifetimeCap,
        telegramNotify: input.telegramNotify ?? false,
        status: 'queued',
      })

      log.info('OrchestratorScheduler: run queued (slots full)', {
        runId: run.id,
        sprintName: run.sprintName,
        activeRuns: activeRuns.length,
        maxConcurrentRuns,
      })
      return run
    }

    const run = insertRun(this.db, {
      sprintName: input.sprintName ?? 'manual',
      repoId: input.repoId ?? 'default',
      projectId: input.projectId,
      taskIds: input.taskIds,
      triggerSource: input.triggerSource ?? 'manual',
      startedBy: input.startedBy,
      singleTaskId: input.singleTaskId,
      concurrencyCap: input.concurrencyCap,
      agentLifetimeCap: input.agentLifetimeCap,
      telegramNotify: input.telegramNotify ?? false,
    })

    updateRunStatus(this.db, run.id, 'running')
    this.emitStatusChange(run.id, 'running', run.sprintName)

    // M1: Validate that all blockedBy references point to tasks in the run's scope
    this.validateDependencies(run)

    // M4: Anamnesis sprint inventory check (non-blocking, fire-and-forget with 3s timeout)
    this.checkSprintInventory(run.sprintName, run.repoId)

    this.ensureTicking()

    log.info('OrchestratorScheduler: run started', { runId: run.id, sprintName: run.sprintName })
    return { ...run, status: 'running' }
  }

  startSingleTask(input: { taskId: string; telegramNotify?: boolean }): OrchestratorRun {
    if (!isOrchestratorEnabled(this.db)) {
      throw new Error('ORCHESTRATOR_DISABLED: orchestrator.enabled is not set to true')
    }

    const task = getTaskById(this.db, input.taskId)
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`)
    }

    // Slot-aware admission: queue when active-run count reaches maxConcurrentRuns
    const activeRuns = getActiveRuns(this.db)
    const maxConcurrentRuns = getMaxConcurrentRuns(this.db)

    // Legacy P0 behaviour: at the default setting (maxConcurrentRuns=1),
    // re-use the existing active run instead of queueing a second one.
    if (maxConcurrentRuns === 1 && activeRuns.length >= 1) {
      const existing = activeRuns[0]
      if (input.telegramNotify && !existing.telegramNotify) {
        updateRunTelegramNotify(this.db, existing.id, true)
      }
      this.ensureTicking()
      // M-1: promote-only — updateRunTelegramNotify only ever sets true (never demotes),
      // so the effective value is `existing || input`. `??` would wrongly report false
      // when input is explicitly false while the persisted run still notifies.
      return { ...existing, telegramNotify: existing.telegramNotify || (input.telegramNotify ?? false) }
    }

    if (activeRuns.length >= maxConcurrentRuns) {
      const run = insertRun(this.db, {
        sprintName: `single:${task.title}`,
        repoId: task.repoId,
        singleTaskId: input.taskId,
        taskIds: [input.taskId],
        triggerSource: 'single-task',
        telegramNotify: input.telegramNotify ?? false,
        status: 'queued',
      })

      log.info('OrchestratorScheduler: single-task run queued (slots full)', {
        runId: run.id,
        taskId: input.taskId,
        activeRuns: activeRuns.length,
        maxConcurrentRuns,
      })
      return run
    }

    const run = insertRun(this.db, {
      sprintName: `single:${task.title}`,
      repoId: task.repoId,
      singleTaskId: input.taskId,
      taskIds: [input.taskId],
      triggerSource: 'single-task',
      telegramNotify: input.telegramNotify ?? false,
    })

    updateRunStatus(this.db, run.id, 'running')
    this.emitStatusChange(run.id, 'running', run.sprintName)

    this.ensureTicking()

    log.info('OrchestratorScheduler: single-task run started', { runId: run.id, taskId: input.taskId })
    return { ...run, status: 'running' }
  }

  pause(runId: string): void {
    this.pausedRunIds.add(runId)
    updateRunStatus(this.db, runId, 'paused')
    this.emitStatusChange(runId, 'paused', this.getSprintName(runId))
    log.info('OrchestratorScheduler: run paused', { runId })
  }

  resume(runId: string): void {
    if (!isOrchestratorEnabled(this.db)) {
      throw new Error('ORCHESTRATOR_DISABLED: cannot resume — orchestrator.enabled is not set to true')
    }
    this.pausedRunIds.delete(runId)
    updateRunStatus(this.db, runId, 'running')
    this.emitStatusChange(runId, 'running', this.getSprintName(runId))
    log.info('OrchestratorScheduler: run resumed', { runId })

    // Kick off a tick soon so the run doesn't wait a full interval
    this.requestTick()
  }

  extendRunWallClock(runId: string): boolean {
    const run = getRun(this.db, runId)
    if (!run) {
      log.warn('OrchestratorScheduler: extendRunWallClock — run not found', { runId })
      return false
    }
    if (run.status !== 'paused') {
      log.warn('OrchestratorScheduler: extendRunWallClock — run is not paused', { runId, status: run.status })
      return false
    }
    resetRunStartedAt(this.db, runId)
    try {
      this.resume(runId)
    } catch (err) {
      log.error('OrchestratorScheduler: extendRunWallClock — resume failed', { runId, err })
      return false
    }
    log.info('OrchestratorScheduler: run wall-clock extended', { runId })
    return true
  }

  cancel(runId: string): void {
    this.pausedRunIds.delete(runId)
    updateRunStatus(this.db, runId, 'cancelled')
    deleteApprovalsForRun(this.db, runId)

    // Safeguard: sync kanban task statuses based on task log outcomes.
    // Iterate newest-first so the latest phase status wins per task.
    const allLogs = getTaskLogsByRun(this.db, runId).reverse()
    const processedTaskIds = new Set<string>()
    for (const tl of allLogs) {
      if (processedTaskIds.has(tl.taskId)) continue
      processedTaskIds.add(tl.taskId)
      if (tl.status === 'done') {
        updateTask(this.db, tl.taskId, { status: 'completed' })
        log.info('OrchestratorScheduler: cancel — marked done task as completed', { taskId: tl.taskId, runId })
      } else if (tl.status === 'active') {
        updateTask(this.db, tl.taskId, { status: 'backlog' })
        log.info('OrchestratorScheduler: cancel — reset active task to backlog', { taskId: tl.taskId, runId })
      }
    }

    // M-2: mark any still-active task logs terminal so late agent events cannot
    // resurrect them (the H-1 guard also rejects events for a cancelled run, but
    // this keeps the persisted phase state consistent with the cancelled run).
    for (const activeLog of getActiveTaskLogs(this.db, runId)) {
      updateTaskLogStatus(this.db, activeLog.id, 'skipped')
    }

    this.emitStatusChange(runId, 'cancelled', this.getSprintName(runId))
    log.info('OrchestratorScheduler: run cancelled', { runId })
    this.promoteNextQueued()
  }

  stop(): void {
    this.suspendScheduling()
    offOrchestratorEvent('agent:completed', this.onCompleted)
    offOrchestratorEvent('agent:failed', this.onFailed)
    log.info('OrchestratorScheduler: stopped')
  }

  private suspendScheduling(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle)
      this.tickHandle = null
    }
    if (this.immediateTickHandle) {
      clearTimeout(this.immediateTickHandle)
      this.immediateTickHandle = null
    }
    this.tickRequested = false
  }

  private ensureTicking(): void {
    if (!this.tickHandle) {
      this.tickHandle = setInterval(() => { void this.tick() }, this.tickIntervalMs)
    }
    this.requestTick()
  }

  private requestTick(): void {
    this.tickRequested = true
    if (this.tickInFlight || this.immediateTickHandle) return

    this.immediateTickHandle = setTimeout(() => {
      this.immediateTickHandle = null
      void this.tick()
    }, 0)
  }

  recoverOrphanedState(): { staleRuns: number; orphanedTasks: number } {
    // Find runs stuck in 'running' or 'paused' with no active task logs.
    // 'queued' runs are excluded: they legitimately wait for queue promotion
    // (P2) and may have an old updated_at without being orphaned.
    const rows = this.db
      .prepare(
        `SELECT id, sprint_name FROM orchestrator_runs
         WHERE status IN ('running', 'paused')
         AND updated_at < datetime('now', '-2 hours')`
      )
      .all() as { id: string; sprint_name: string }[]

    let staleRuns = 0
    let orphanedTasks = 0

    for (const row of rows) {
      const activeLogs = getActiveTaskLogs(this.db, row.id)
      if (activeLogs.length === 0) {
        updateRunStatus(this.db, row.id, 'failed')
        staleRuns++
        log.warn('OrchestratorScheduler: recovered stale run', { runId: row.id })
      } else {
        for (const tl of activeLogs) {
          updateTaskLogStatus(this.db, tl.id, 'failed')
          orphanedTasks++
          log.warn('OrchestratorScheduler: recovered orphaned task log', { taskLogId: tl.id, runId: row.id })
        }
        updateRunStatus(this.db, row.id, 'failed')
        log.warn('OrchestratorScheduler: recovered stale run with orphaned tasks', { runId: row.id })
      }
    }

    this.promoteNextQueued()

    return { staleRuns, orphanedTasks }
  }

  private promoteNextQueued(): void {
    const maxConcurrent = getMaxConcurrentRuns(this.db)
    if (maxConcurrent <= 1) return

    const queued = getQueuedRuns(this.db)
    if (queued.length === 0) return

    for (const q of queued) {
      if (getActiveRuns(this.db).length >= maxConcurrent) break

      updateRunStatus(this.db, q.id, 'running')
      this.emitStatusChange(q.id, 'running', q.sprintName)
      this.validateDependencies(q)
      this.checkSprintInventory(q.sprintName, q.repoId)
      log.info('OrchestratorScheduler: promoted queued run', { runId: q.id, sprintName: q.sprintName })
    }

    this.requestTick()
  }

  resumeIfActive(): boolean {
    const activeRuns = getActiveRuns(this.db)
    if (activeRuns.length === 0) return false
    if (this.tickHandle) return true // already ticking

    this.ensureTicking()
    log.info('OrchestratorScheduler: resumed active runs on startup', { count: activeRuns.length })
    return true
  }

  // -------------------------------------------------------------------------
  // Status — public API consumed by IPC handlers
  // -------------------------------------------------------------------------

  getStatus(): OrchestratorStatusResponse {
    const activeRuns = getActiveRuns(this.db)
    const run = activeRuns[0] ?? null

    if (!run) {
      return {
        run: null,
        activeTasks: [],
        completedCount: 0,
        totalCount: 0,
        failedCount: 0,
        singleTaskId: null,
        activeRuns: [],
        queuedRuns: getQueuedRuns(this.db),
      }
    }

    const allLogs = activeRuns.flatMap((r) => getTaskLogsByRun(this.db, r.id))
    const activeTasks = allLogs.filter(l => l.status === 'active')
    const completedCount = allLogs.filter(l => l.status === 'done').length
    const failedCount = allLogs.filter(l => l.status === 'failed').length

    return {
      run,
      activeTasks,
      completedCount,
      totalCount: allLogs.length,
      failedCount,
      singleTaskId: run.singleTaskId,
      activeRuns,
      queuedRuns: getQueuedRuns(this.db),
    }
  }

  getTaskLog(taskId: string): OrchestratorTaskLog[] {
    return getTaskLogsByTask(this.db, taskId)
  }

  // -------------------------------------------------------------------------
  // Approval — public API consumed by IPC handler
  // -------------------------------------------------------------------------

  approveTaskDispatch(runId: string, taskId: string, approved: boolean): boolean {
    const run = getRun(this.db, runId)
    if (!run) {
      log.warn('OrchestratorScheduler: approveTaskDispatch — run not found', { runId })
      return false
    }

    if (run.status !== 'running' && run.status !== 'paused') {
      log.warn('OrchestratorScheduler: approveTaskDispatch — run not active', { runId, status: run.status })
      return false
    }

    if (!approved) {
      updateApprovalStatus(this.db, runId, taskId, 'denied')
      log.info('OrchestratorScheduler: task dispatch rejected', { runId, taskId })
      // Mark any pending log for this task as skipped
      const logs = getTaskLogsByRun(this.db, runId).filter(l => l.taskId === taskId && l.status === 'pending')
      for (const tl of logs) {
        updateTaskLogStatus(this.db, tl.id, 'skipped')
      }
      return true
    }

    updateApprovalStatus(this.db, runId, taskId, 'approved')
    log.info('OrchestratorScheduler: task dispatch approved, kicking tick', { runId, taskId })
    this.requestTick()
    return true
  }

  // -------------------------------------------------------------------------
  // Core tick — private
  // -------------------------------------------------------------------------

  private async tick(): Promise<void> {
    if (this.tickInFlight) {
      this.tickRequested = true
      return
    }
    this.tickInFlight = true
    this.tickRequested = false
    try {
      await this.tickBody()
    } finally {
      this.tickInFlight = false
      if (this.tickRequested) this.requestTick()
    }
  }

  private async tickBody(): Promise<void> {
    this.tickCount++
    const currentTick = this.tickCount

    // Kill-switch: read from DB every tick
    if (!isOrchestratorEnabled(this.db)) {
      log.info('OrchestratorScheduler: kill-switch active — tick aborted', { tick: currentTick })
      // Suspend timers but retain lifecycle listeners. Re-enabling the same
      // scheduler instance must not silently lose completion events.
      this.suspendScheduling()
      return
    }

    // Event delivery is the fast path. This DB-backed consistency pass is the
    // safety path for parser races, process restarts, and other missed events.
    this.reconcileActiveAgents()

    // Fetch all active runs, sorted FIFO (oldest createdAt first).
    // getActiveRuns() returns updated_at DESC — re-sort by createdAt ASC
    // so the oldest run dispatches first.
    const activeRuns = getActiveRuns(this.db)
    if (activeRuns.length === 0) return
    activeRuns.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    // Throughput ceiling: dispatch at most 1 task per tick across ALL runs.
    // This prevents a burst of tasks from overwhelming agent slots when
    // multiple sprints start with many ready tasks. The next tick will
    // round-robin to the next run.
    let dispatched = false

    for (const runSnapshot of activeRuns) {
      if (dispatched) break

      // Re-read run: reconcileActiveAgents() may have changed its status.
      const run = getRun(this.db, runSnapshot.id)
      if (!run || run.status !== 'running') continue

      if (this.pausedRunIds.has(run.id)) continue

      // Budget gate — per-run: each active run independently capped at
      // run.agentLifetimeCap (defaults to 50 via mapRunRow).
      const spawned = getAgentsSpawned(this.db, run.id)
      if (spawned >= run.agentLifetimeCap) {
        log.info('OrchestratorScheduler: agent budget exhausted', { tick: currentTick, runId: run.id, spawned, agentLifetimeCap: run.agentLifetimeCap })
        continue
      }

      // Fetch candidate tasks
      const candidateTasks = this.fetchCandidateTasks(run)
      if (candidateTasks.length === 0) {
        this.maybeCompleteRun(run)
        continue
      }

      // Build active/completed sets for dependency resolution
      const activeLogs = getActiveTaskLogs(this.db, run.id)
      const allLogs = getTaskLogsByRun(this.db, run.id)
      const activeIds = new Set(activeLogs.map(l => l.taskId))
      const completedIds = new Set(allLogs.filter(l => l.status === 'done').map(l => l.taskId))

      // Concurrency gate — use the run's concurrencyCap (NOT the global
      // deps.maxAgents budget). The monitor enforces the same cap, so using
      // maxAgents here lets the scheduler spawn in parallel while the monitor
      // flags a false-positive breach and pauses the run. getDispatchableTasks
      // subtracts activeIds.size internally, so pass the raw cap.
      const concurrencyCap = run.concurrencyCap ?? this.deps.maxAgents
      if (activeIds.size >= concurrencyCap) continue

      const dispatchable = getDispatchableTasks(
        candidateTasks.map(t => ({ id: t.id, priority: t.priority, blockedBy: t.blockedBy })),
        activeIds,
        completedIds,
        concurrencyCap
      )

      if (dispatchable.length === 0) continue

      // Iterate dispatchable list so an approval-gated task does not block the queue.
      for (const candidate of dispatchable) {
        if (dispatched) break

        const fullTask = candidateTasks.find(t => t.id === candidate.id)
        if (!fullTask) continue

        // Approval gate — deterministic state machine backed by orchestrator_approvals.
        if (fullTask.requiresApproval) {
          const approval = getApproval(this.db, run.id, fullTask.id)
          if (!approval || approval.status === 'expired') {
            // First request, OR re-request after a never-ran B-reset (status 'expired').
            if (approval) {
              resetApprovalToPending(this.db, run.id, fullTask.id, getApprovalWindowMinutes(this.db))
            } else {
              insertApproval(this.db, {
                runId: run.id,
                taskId: fullTask.id,
                windowMinutes: getApprovalWindowMinutes(this.db),
              })
            }
            this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_APPROVAL_NEEDED, {
              runId: run.id,
              taskId: fullTask.id,
              title: fullTask.title,
              repoId: run.repoId,
              sprintName: run.sprintName,
              description: fullTask.description,
            })
            if (run.telegramNotify) {
              this.deps.notifyApproval?.(fullTask.id, run.id, fullTask.title, run.repoId, run.sprintName, fullTask.description)
            }
            log.info('OrchestratorScheduler: task gated on approval', { runId: run.id, taskId: fullTask.id })
            continue // skip this task, try the next one
          }
          if (approval.status === 'pending' || approval.status === 'denied') {
            continue // waiting on user, OR rejected — do NOT re-prompt
          }
          // approval.status === 'approved' → fall through to dispatch
        }

        // hasActiveLogForPhase guard: skip if task already has an active log in this run
        if (this.hasActiveLogForPhase(run.id, fullTask.id, 'dev')) {
          log.warn('OrchestratorScheduler: duplicate dispatch blocked — task already has active log', { runId: run.id, taskId: fullTask.id })
          continue
        }

        const context: SchedulerBrainContext = {
          run,
          candidateTasks: [fullTask],
          activeLogs,
          completedTaskIds: [...completedIds],
          agentsSpawned: spawned,
          maxAgents: this.deps.maxAgents,
          tickCount: currentTick,
        }

        let decision: SchedulerBrainDecision | null = null
        try {
          decision = await Promise.race([
            this.deps.brain.decide(context),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
          ])
        } catch (err) {
          log.error('OrchestratorScheduler: brain.decide threw', { tick: currentTick, runId: run.id, err })
          continue
        }

        if (!decision) {
          log.info('OrchestratorScheduler: brain returned null decision', { tick: currentTick, runId: run.id })
          continue
        }

        // Validate decision
        const outcome = this.deps.validator.validate(decision, run)
        if (!outcome.valid) {
          log.warn('OrchestratorScheduler: validation failed', { tick: currentTick, runId: run.id, taskId: decision.taskId, failures: outcome.failures })
          continue
        }

        // Rate limiter gate — consume token only after validation passes (FIX H4)
        if (!this.rateLimiter.tryAcquire()) {
          log.debug('OrchestratorScheduler: rate limiter blocked dispatch', { tick: currentTick, runId: run.id, taskId: decision.taskId })
          break // no more capacity this window — stop trying
        }

        // Insert task log entry
        const taskLog = insertTaskLog(this.db, { runId: run.id, taskId: decision.taskId, phase: 'dev' })

        // Dispatch
        const agentId = this.deps.dispatch.execute(decision.spawnOptions, decision.taskId, run.id)
        if (!agentId) {
          log.warn('OrchestratorScheduler: dispatch returned null agentId', { tick: currentTick, runId: run.id, taskId: decision.taskId })
          updateTaskLogStatus(this.db, taskLog.id, 'failed')
          continue
        }

        updateTaskLogStatus(this.db, taskLog.id, 'active', agentId)
        updateTask(this.db, decision.taskId, { status: 'in_progress' })
        incrementAgentsSpawned(this.db, run.id)
        updateRunTimestamp(this.db, run.id)

        log.info('OrchestratorScheduler: task dispatched — kanban task marked in_progress', {
          tick: currentTick,
          runId: run.id,
          taskId: decision.taskId,
          agentId,
          reason: decision.reason,
        })

        this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE, {
          runId: run.id,
          taskId: decision.taskId,
          phase: 'dev',
          status: 'active',
        })

        this.notifyLifecycle(
          run,
          'task_launched',
          `${fullTask.title}\nSprint: ${run.sprintName}`,
          agentId
        )

        dispatched = true
        break // throughput ceiling: 1 dispatch per tick
      }
    }

    if (!dispatched) {
      log.debug('OrchestratorScheduler: no task dispatched this tick', { tick: currentTick })
    }
  }

  // -------------------------------------------------------------------------
  // Agent event handler — private
  // -------------------------------------------------------------------------

  private handleAgentEvent(event: OrchestratorAgentEvent): void {
    const { type, triageEvent } = event
    const agentId = triageEvent.agentId

    const taskLog = getActiveTaskLogByAgentIdAnyRun(this.db, agentId)
    if (!taskLog) return

    const run = getRun(this.db, taskLog.runId)
    if (!run) return

    if (run.status !== 'running') {
      log.debug('OrchestratorScheduler: ignoring agent event for non-running run', {
        agentId,
        runId: run.id,
        runStatus: run.status,
        eventType: type,
      })
      return
    }

    if (type === 'agent:completed') {
      this.completeActiveTask(run, taskLog, agentId, 'event')
      return
    }

    if (type === 'agent:failed') {
      this.failActiveTask(run, taskLog, agentId, 'event')
    }
  }

  /**
   * Reconcile persisted agent state with active orchestrator logs.
   * Safe to call from both the scheduler heartbeat and the independent monitor:
   * each transition first re-reads the active log, so an event and a poll racing
   * for the same agent can only apply the terminal transition once.
   */
  reconcileActiveAgents(): number {
    if (!this.deps.getAgentStatus) return 0

    const activeRuns = getActiveRuns(this.db)
    let reconciled = 0

    for (const runSnapshot of activeRuns) {
      if (runSnapshot.status !== 'running') continue

      for (const snapshot of getActiveTaskLogs(this.db, runSnapshot.id)) {
        if (!snapshot.agentId) continue
        let status: AgentLifecycleStatus | null
        try {
          status = this.deps.getAgentStatus(snapshot.agentId)
        } catch (error) {
          log.warn('OrchestratorScheduler: agent status reconciliation failed', {
            runId: runSnapshot.id,
            agentId: snapshot.agentId,
            error: String(error),
          })
          continue
        }
        const activeLog = getActiveTaskLogByAgentId(this.db, runSnapshot.id, snapshot.agentId)
        if (!activeLog) continue

        if (status === 'completed') {
          this.completeActiveTask(runSnapshot, activeLog, snapshot.agentId, 'reconciliation')
          reconciled++
        } else if (status === 'error') {
          this.failActiveTask(runSnapshot, activeLog, snapshot.agentId, 'reconciliation')
          reconciled++
        }
      }
    }

    if (reconciled > 0) {
      log.info('OrchestratorScheduler: active-agent reconciliation applied', {
        reconciled,
      })
    }
    return reconciled
  }

  private completeActiveTask(
    run: OrchestratorRun,
    taskLog: OrchestratorTaskLog,
    agentId: string,
    source: 'event' | 'reconciliation'
  ): void {
    updateTaskLogStatus(this.db, taskLog.id, 'done', agentId)
    updateTask(this.db, taskLog.taskId, { status: 'completed' })
    this.retryMap.delete(this.retryKey(run.id, taskLog.taskId))
    log.info('OrchestratorScheduler: agent completed — kanban task marked completed', {
      agentId,
      taskId: taskLog.taskId,
      runId: run.id,
      source,
    })

    this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE, {
      runId: run.id,
      taskId: taskLog.taskId,
      phase: taskLog.phase,
      status: 'done',
    })

    const taskTitle = getTaskById(this.db, taskLog.taskId)?.title ?? taskLog.taskId
    this.notifyLifecycle(run, 'task_completed', `${taskTitle}\nSprint: ${run.sprintName}`, agentId)
    this.maybeCompleteRun(run)
    this.requestTick()
  }

  private failActiveTask(
    run: OrchestratorRun,
    taskLog: OrchestratorTaskLog,
    agentId: string,
    source: 'event' | 'reconciliation'
  ): void {
    const retryRecord = this.retryMap.get(this.retryKey(run.id, taskLog.taskId)) ?? { count: 0 }
    const taskTitle = getTaskById(this.db, taskLog.taskId)?.title ?? taskLog.taskId
    const willRetry = retryRecord.count < 1

    this.notifyLifecycle(
      run,
      'task_failed',
      `${taskTitle}\n${willRetry ? 'Retry scheduled' : 'Retries exhausted'} · ${run.sprintName}`,
      agentId
    )

    if (willRetry) {
      retryRecord.count++
      this.retryMap.set(this.retryKey(run.id, taskLog.taskId), retryRecord)
      updateTaskLogStatus(this.db, taskLog.id, 'failed', agentId)
      log.warn('OrchestratorScheduler: agent failed, will retry', {
        agentId,
        taskId: taskLog.taskId,
        attempt: retryRecord.count,
        source,
      })
      this.requestTick()
      return
    }

    updateTaskLogStatus(this.db, taskLog.id, 'failed', agentId)
    updateTask(this.db, taskLog.taskId, { status: 'backlog' })
    this.retryMap.delete(this.retryKey(run.id, taskLog.taskId))
    log.error('OrchestratorScheduler: agent failed after retry, giving up — kanban task reset to backlog', {
      agentId,
      taskId: taskLog.taskId,
      source,
    })
    this.maybeCompleteRun(run)

    this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE, {
      runId: run.id,
      taskId: taskLog.taskId,
      phase: taskLog.phase,
      status: 'failed',
    })
  }

  // -------------------------------------------------------------------------
  // Helpers — private
  // -------------------------------------------------------------------------

  private fetchCandidateTasks(run: OrchestratorRun): TaskItem[] {
    const isDispatchable = (t: TaskItem | null): t is TaskItem =>
      t !== null && (t.status === 'backlog' || t.status === 'today')

    let candidates: TaskItem[]
    if (run.taskIds && run.taskIds.length > 0) {
      // Scoped run: only the explicitly listed task IDs that are queued
      candidates = run.taskIds
        .map(id => getTaskById(this.db, id))
        .filter(isDispatchable)
    } else {
      // Sprint-scoped run: all queued tasks for this repo
      candidates = getTasksByRepo(this.db, run.repoId).filter(isDispatchable)
    }

    // Cross-run dedup: filter out tasks already completed in a previous run of
    // the SAME repo+sprint (scoped so a different repo's run never skips a task).
    const globallyDone = getCompletedTaskIds(this.db, { repoId: run.repoId, sprintName: run.sprintName })
    const before = candidates.length
    candidates = candidates.filter(t => !globallyDone.has(t.id))
    if (before !== candidates.length) {
      log.info('OrchestratorScheduler: cross-run dedup removed candidates already done', {
        runId: run.id,
        removed: before - candidates.length,
        remaining: candidates.length,
      })
    }

    return candidates
  }

  private maybeCompleteRun(run: OrchestratorRun): void {
    const allLogs = getTaskLogsByRun(this.db, run.id)
    const activeLogs = allLogs.filter(l => l.status === 'active')
    if (activeLogs.length > 0) return

    const candidateTasks = this.fetchCandidateTasks(run)
    const completedIds = new Set(allLogs.filter(l => l.status === 'done').map(l => l.taskId))
    const failedIds = new Set(allLogs.filter(l => l.status === 'failed').map(l => l.taskId))
    // A task is still "remaining" (pending dispatch) only if it hasn't completed AND
    // isn't retry-exhausted. Retry-exhausted = failed log exists AND no retryMap entry.
    const remainingTasks = candidateTasks.filter(t => {
      if (completedIds.has(t.id)) return false
      if (failedIds.has(t.id) && !this.retryMap.has(this.retryKey(run.id, t.id))) return false
      return true
    })

    if (remainingTasks.length === 0) {
      const hasFailed = allLogs.some(l => l.status === 'failed')
      const finalStatus: OrchestratorRunStatus = hasFailed ? 'failed' : 'completed'
      updateRunStatus(this.db, run.id, finalStatus)
      deleteApprovalsForRun(this.db, run.id)
      this.emitStatusChange(run.id, finalStatus, run.sprintName)
      this.notifyLifecycle(
        run,
        finalStatus === 'failed' ? 'run_failed' : 'run_completed',
        `${run.sprintName}\n${completedIds.size} completed · ${failedIds.size} failed`
      )
      log.info('OrchestratorScheduler: run concluded', { runId: run.id, status: finalStatus })
      this.promoteNextQueued()
    }
  }

  private emitStatusChange(runId: string, status: OrchestratorRunStatus, sprintName: string): void {
    const run = getRun(this.db, runId)
    const payload: OrchestratorStatusChangePayload = {
      runId,
      status,
      sprintName,
      repoId: run?.repoId ?? '',
    }
    this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE, payload)
  }

  private notifyLifecycle(
    run: OrchestratorRun,
    type: OrchestratorLifecycleNotificationType,
    summary: string,
    agentId?: string
  ): void {
    if (!run.telegramNotify) return
    try {
      this.deps.sendTelegramNotification?.(summary, type, run.repoId, agentId)
    } catch (err) {
      log.warn('OrchestratorScheduler: lifecycle Telegram notification failed', {
        runId: run.id,
        type,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private getSprintName(runId: string): string {
    const run = getRun(this.db, runId)
    return run?.sprintName ?? runId
  }

  /**
   * Guard: returns true if there is already an active log for this task+phase in this run.
   * Ported from old kanban-orchestrator.ts to prevent duplicate dispatches.
   */
  private hasActiveLogForPhase(runId: string, taskId: string, phase: string): boolean {
    const logs = getTaskLogsByTask(this.db, taskId)
    return logs.some(l => l.runId === runId && l.phase === phase && l.status === 'active')
  }

  /**
   * M1: Validate that all blockedBy references in the run's tasks point to tasks
   * that exist in the run's scope. Logs a warning (does not throw) if broken deps found.
   * Ported from old kanban-orchestrator.ts validateDependencies.
   */
  private validateDependencies(run: OrchestratorRun): void {
    try {
      const tasks = this.fetchCandidateTasks(run)
      const taskIds = new Set(tasks.map(t => t.id))
      const depMap = getDependencyMap(this.db)

      for (const [taskId, deps] of depMap) {
        if (!taskIds.has(taskId)) continue
        for (const depId of deps) {
          if (!taskIds.has(depId)) {
            log.warn('OrchestratorScheduler: M1 broken dependency detected', {
              runId: run.id,
              taskId,
              missingDepId: depId,
            })
          }
        }
      }
    } catch (err) {
      log.warn('OrchestratorScheduler: M1 dependency validation failed', { runId: run.id, error: String(err) })
    }
  }

  /**
   * M4: Anamnesis sprint inventory check. Non-blocking fire-and-forget with 3s timeout.
   * If the sprint is already done/in_progress in Anamnesis, logs a warning.
   * Ported from old kanban-orchestrator.ts checkSprintInventory.
   */
  private checkSprintInventory(sprintName: string, repoId: string): void {
    const doCheck = async (): Promise<void> => {
      try {
        const authSecret = process.env['ANAMNESIS_AUTH_SECRET']
        if (!authSecret) {
          log.debug('OrchestratorScheduler: M4 sprint inventory check skipped — no ANAMNESIS_AUTH_SECRET')
          return
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        const anamnesisUrl = process.env['ANAMNESIS_URL'] ?? DEFAULT_ANAMNESIS_URL

        const resp = await fetch(
          `${anamnesisUrl}/api/v1/memory/procedural?domain=sprint_inventory&query=${encodeURIComponent(sprintName)}`,
          {
            headers: {
              'X-Optimaeus-Caller': 'hephaestus',
              'Authorization': `Bearer ${authSecret}`,
            },
            signal: controller.signal,
          }
        )
        clearTimeout(timeout)

        if (!resp.ok) return

        const data = (await resp.json()) as {
          memories?: Array<{ content?: { status?: string } }>
        }
        const doneMatch = data.memories?.find(
          (m) => m.content?.status === 'done' || m.content?.status === 'in_progress'
        )

        if (doneMatch) {
          const status = doneMatch.content?.status ?? 'unknown'
          log.warn('OrchestratorScheduler: M4 sprint inventory found existing work', {
            sprintName,
            repoId,
            existingStatus: status,
          })
        }
      } catch (err) {
        log.warn('OrchestratorScheduler: M4 sprint inventory check failed (non-blocking)', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Fire-and-forget — doCheck() has internal try/catch and never rejects
    void doCheck()
  }
}
