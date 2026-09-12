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
  getActiveRun,
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
  getTaskLogsByTask,
  getCompletedTaskIdsFromAllRuns,
} from '../db/queries/orchestrator.queries'
import { getTasksByRepo, getTaskById, updateTask } from '../db/queries/tasks.queries'
import { getDependencyMap } from '../db/queries/task-dependencies.queries'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type {
  OrchestratorRun,
  OrchestratorRunStatus,
  OrchestratorStatusResponse,
  OrchestratorTaskLog,
  OrchestratorStatusChangePayload,
} from '../../shared/types/orchestrator.types'
import type { AgentSpawnOptions } from '../../shared/types/agent.types'
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
  notifyApproval?: (taskId: string, runId: string, title: string, repoId: string) => void
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
  private tickCount = 0
  private tickInFlight = false
  private pausedRunIds = new Set<string>()
  private retryMap = new Map<string, RetryRecord>()
  private pendingApproval = new Set<string>()
  private approvedTasks = new Set<string>()

  // Bound handlers stored so we can remove them in stop()
  private readonly onCompleted: (e: OrchestratorAgentEvent) => void
  private readonly onFailed: (e: OrchestratorAgentEvent) => void

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
  // Kill-switch check — private
  // -------------------------------------------------------------------------

  private isOrchestratorEnabled(): boolean {
    try {
      const row = this.db
        .prepare("SELECT value FROM settings WHERE key = 'orchestrator.enabled'")
        .get() as { value: string } | undefined
      return row?.value !== '0' && row?.value !== 'false'
    } catch {
      return true
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle — public API consumed by service-orchestrator.ts
  // -------------------------------------------------------------------------

  start(input: { sprintName?: string; taskIds?: string[]; repoId?: string; concurrencyCap?: number; telegramNotify?: boolean }): OrchestratorRun {
    if (!this.isOrchestratorEnabled()) {
      throw new Error('ORCHESTRATOR_DISABLED: orchestrator.enabled is not set to true')
    }

    const existing = getActiveRun(this.db)
    if (existing) {
      log.warn('OrchestratorScheduler: start() called while run already active', { runId: existing.id })
      if (input.telegramNotify && !existing.telegramNotify) {
        this.db.prepare("UPDATE orchestrator_runs SET telegram_notify = 1 WHERE id = ?").run(existing.id)
      }
      if (!this.tickHandle) {
        this.tickHandle = setInterval(() => this.tick(), this.tickIntervalMs)
        setTimeout(() => this.tick(), 0)
      }
      return { ...existing, telegramNotify: input.telegramNotify ?? existing.telegramNotify }
    }

    const run = insertRun(this.db, {
      sprintName: input.sprintName ?? 'manual',
      repoId: input.repoId ?? 'default',
      taskIds: input.taskIds,
      triggerSource: 'manual',
      concurrencyCap: input.concurrencyCap,
      telegramNotify: input.telegramNotify ?? false,
    })

    updateRunStatus(this.db, run.id, 'running')
    this.emitStatusChange(run.id, 'running', run.sprintName)

    // M1: Validate that all blockedBy references point to tasks in the run's scope
    this.validateDependencies(run)

    // M4: Anamnesis sprint inventory check (non-blocking, fire-and-forget with 3s timeout)
    this.checkSprintInventory(run.sprintName, run.repoId)

    if (!this.tickHandle) {
      this.tickHandle = setInterval(() => this.tick(), this.tickIntervalMs)
      setTimeout(() => this.tick(), 0)
    }

    log.info('OrchestratorScheduler: run started', { runId: run.id, sprintName: run.sprintName })
    return { ...run, status: 'running' }
  }

  startSingleTask(input: { taskId: string; telegramNotify?: boolean }): OrchestratorRun {
    if (!this.isOrchestratorEnabled()) {
      throw new Error('ORCHESTRATOR_DISABLED: orchestrator.enabled is not set to true')
    }

    const existing = getActiveRun(this.db)
    if (existing) {
      log.warn('OrchestratorScheduler: startSingleTask() called while run already active', { runId: existing.id })
      if (input.telegramNotify && !existing.telegramNotify) {
        this.db.prepare("UPDATE orchestrator_runs SET telegram_notify = 1 WHERE id = ?").run(existing.id)
      }
      return { ...existing, telegramNotify: input.telegramNotify ?? existing.telegramNotify }
    }

    const task = getTaskById(this.db, input.taskId)
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`)
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

    if (!this.tickHandle) {
      this.tickHandle = setInterval(() => this.tick(), this.tickIntervalMs)
      setTimeout(() => this.tick(), 0)
    }

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
    if (!this.isOrchestratorEnabled()) {
      throw new Error('ORCHESTRATOR_DISABLED: cannot resume — orchestrator.enabled is not set to true')
    }
    this.pausedRunIds.delete(runId)
    updateRunStatus(this.db, runId, 'running')
    this.emitStatusChange(runId, 'running', this.getSprintName(runId))
    log.info('OrchestratorScheduler: run resumed', { runId })

    // Kick off a tick soon so the run doesn't wait a full interval
    setTimeout(() => this.tick(), 0)
  }

  cancel(runId: string): void {
    this.pausedRunIds.delete(runId)
    updateRunStatus(this.db, runId, 'cancelled')

    // Safeguard: sync kanban task statuses based on task log outcomes
    const allLogs = getTaskLogsByRun(this.db, runId)
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

    this.emitStatusChange(runId, 'cancelled', this.getSprintName(runId))
    log.info('OrchestratorScheduler: run cancelled', { runId })
  }

  stop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle)
      this.tickHandle = null
    }
    offOrchestratorEvent('agent:completed', this.onCompleted)
    offOrchestratorEvent('agent:failed', this.onFailed)
    log.info('OrchestratorScheduler: stopped')
  }

  recoverOrphanedState(): { staleRuns: number; orphanedTasks: number } {
    // Find runs stuck in 'running' or 'paused' with no active task logs
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

    return { staleRuns, orphanedTasks }
  }

  // -------------------------------------------------------------------------
  // Status — public API consumed by IPC handlers
  // -------------------------------------------------------------------------

  getStatus(): OrchestratorStatusResponse {
    const run = getActiveRun(this.db)
    if (!run) {
      return { run: null, activeTasks: [], completedCount: 0, totalCount: 0, failedCount: 0, singleTaskId: null }
    }

    const allLogs = getTaskLogsByRun(this.db, run.id)
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
    }
  }

  getTaskLog(taskId: string): OrchestratorTaskLog[] {
    const run = getActiveRun(this.db)
    if (!run) return []
    return getTaskLogsByRun(this.db, run.id).filter(l => l.taskId === taskId)
  }

  // -------------------------------------------------------------------------
  // Approval — public API consumed by IPC handler
  // -------------------------------------------------------------------------

  approveTaskDispatch(runId: string, taskId: string, approved: boolean): void {
    const run = getRun(this.db, runId)
    if (!run) {
      log.warn('OrchestratorScheduler: approveTaskDispatch — run not found', { runId })
      return
    }

    this.pendingApproval.delete(taskId)

    if (!approved) {
      log.info('OrchestratorScheduler: task dispatch rejected', { runId, taskId })
      // Mark any pending log for this task as skipped
      const logs = getTaskLogsByRun(this.db, runId).filter(l => l.taskId === taskId && l.status === 'pending')
      for (const tl of logs) {
        updateTaskLogStatus(this.db, tl.id, 'skipped')
      }
      return
    }

    this.approvedTasks.add(taskId)
    log.info('OrchestratorScheduler: task dispatch approved, kicking tick', { runId, taskId })
    setTimeout(() => this.tick(), 0)
  }

  // -------------------------------------------------------------------------
  // Core tick — private
  // -------------------------------------------------------------------------

  private async tick(): Promise<void> {
    if (this.tickInFlight) return
    this.tickInFlight = true
    try {
      await this.tickBody()
    } finally {
      this.tickInFlight = false
    }
  }

  private async tickBody(): Promise<void> {
    this.tickCount++
    const currentTick = this.tickCount

    // Kill-switch: read from DB every tick
    if (!this.isOrchestratorEnabled()) {
      log.info('OrchestratorScheduler: kill-switch active — tick aborted', { tick: currentTick })
      this.stop()
      return
    }

    const run = getActiveRun(this.db)
    if (!run) return

    if (this.pausedRunIds.has(run.id) || run.status === 'paused') return

    // Budget gate
    const spawned = getAgentsSpawned(this.db, run.id)
    if (spawned >= this.deps.maxAgents) {
      log.info('OrchestratorScheduler: agent budget exhausted', { tick: currentTick, runId: run.id, spawned, maxAgents: this.deps.maxAgents })
      return
    }

    // Fetch candidate tasks
    const candidateTasks = this.fetchCandidateTasks(run)
    if (candidateTasks.length === 0) {
      this.maybeCompleteRun(run)
      return
    }

    // Build active/completed sets for dependency resolution
    const activeLogs = getActiveTaskLogs(this.db, run.id)
    const allLogs = getTaskLogsByRun(this.db, run.id)
    const activeIds = new Set(activeLogs.map(l => l.taskId))
    const completedIds = new Set(allLogs.filter(l => l.status === 'done').map(l => l.taskId))

    const slotsAvailable = this.deps.maxAgents - activeIds.size
    if (slotsAvailable <= 0) return

    const dispatchable = getDispatchableTasks(
      candidateTasks.map(t => ({ id: t.id, priority: t.priority, blockedBy: t.blockedBy })),
      activeIds,
      completedIds,
      slotsAvailable
    )

    if (dispatchable.length === 0) return

    // Throughput ceiling: dispatch at most 1 task per tick (60 s).
    // This prevents a burst of tasks from overwhelming agent slots when a
    // sprint starts with many ready tasks.  The next tick will pick up the
    // next candidate.
    // Iterate dispatchable list so an approval-gated task does not block the queue.
    let dispatched = false
    for (const candidate of dispatchable) {
      const fullTask = candidateTasks.find(t => t.id === candidate.id)
      if (!fullTask) continue

      // Approval gate — hold task if requiresApproval and not yet approved
      if (fullTask.requiresApproval && !this.pendingApproval.has(fullTask.id) && !this.approvedTasks.has(fullTask.id)) {
        this.pendingApproval.add(fullTask.id)
        this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_APPROVAL_NEEDED, {
          runId: run.id,
          taskId: fullTask.id,
          title: fullTask.title,
        })
        if (run.telegramNotify) {
          this.deps.notifyApproval?.(fullTask.id, run.id, fullTask.title, run.repoId)
        }
        log.info('OrchestratorScheduler: task gated on approval', { runId: run.id, taskId: fullTask.id })
        continue // skip this task, try the next one
      }

      // Still waiting for user to respond to the approval prompt
      if (fullTask.requiresApproval && this.pendingApproval.has(fullTask.id)) {
        continue
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

      dispatched = true
      break // throughput ceiling: 1 dispatch per tick
    }

    if (!dispatched) {
      log.debug('OrchestratorScheduler: no task dispatched this tick', { tick: currentTick, runId: run.id })
    }
  }

  // -------------------------------------------------------------------------
  // Agent event handler — private
  // -------------------------------------------------------------------------

  private handleAgentEvent(event: OrchestratorAgentEvent): void {
    const { type, triageEvent } = event
    const agentId = triageEvent.agentId

    const run = getActiveRun(this.db)
    if (!run) return

    const taskLog = getActiveTaskLogByAgentId(this.db, run.id, agentId)
    if (!taskLog) return

    if (type === 'agent:completed') {
      updateTaskLogStatus(this.db, taskLog.id, 'done', agentId)
      updateTask(this.db, taskLog.taskId, { status: 'completed' })
      this.retryMap.delete(taskLog.taskId)
      log.info('OrchestratorScheduler: agent completed — kanban task marked completed', { agentId, taskId: taskLog.taskId, runId: run.id })

      this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE, {
        runId: run.id,
        taskId: taskLog.taskId,
        phase: taskLog.phase,
        status: 'done',
      })

      this.maybeCompleteRun(run)
      // Schedule next tick after completion without blocking current call stack
      setTimeout(() => this.tick(), 0)
      return
    }

    if (type === 'agent:failed') {
      const retryRecord = this.retryMap.get(taskLog.taskId) ?? { count: 0 }

      if (retryRecord.count < 1) {
        retryRecord.count++
        this.retryMap.set(taskLog.taskId, retryRecord)
        // Mark current log failed, allow next tick to re-dispatch
        updateTaskLogStatus(this.db, taskLog.id, 'failed', agentId)
        log.warn('OrchestratorScheduler: agent failed, will retry', { agentId, taskId: taskLog.taskId, attempt: retryRecord.count })
        setTimeout(() => this.tick(), 0)
      } else {
        updateTaskLogStatus(this.db, taskLog.id, 'failed', agentId)
        updateTask(this.db, taskLog.taskId, { status: 'backlog' })
        this.retryMap.delete(taskLog.taskId)
        log.error('OrchestratorScheduler: agent failed after retry, giving up — kanban task reset to backlog', { agentId, taskId: taskLog.taskId })
        this.maybeCompleteRun(run)

        this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE, {
          runId: run.id,
          taskId: taskLog.taskId,
          phase: taskLog.phase,
          status: 'failed',
        })
      }
    }
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

    // Cross-run dedup: filter out tasks already completed in ANY previous run
    const globallyDone = getCompletedTaskIdsFromAllRuns(this.db)
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
      if (failedIds.has(t.id) && !this.retryMap.has(t.id)) return false
      return true
    })

    if (remainingTasks.length === 0) {
      const hasFailed = allLogs.some(l => l.status === 'failed')
      const finalStatus: OrchestratorRunStatus = hasFailed ? 'failed' : 'completed'
      updateRunStatus(this.db, run.id, finalStatus)
      this.emitStatusChange(run.id, finalStatus, run.sprintName)
      log.info('OrchestratorScheduler: run concluded', { runId: run.id, status: finalStatus })
    }
  }

  private emitStatusChange(runId: string, status: OrchestratorRunStatus, sprintName: string): void {
    const payload: OrchestratorStatusChangePayload = { runId, status, sprintName }
    this.deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE, payload)
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
        const anamnesisUrl = process.env['ANAMNESIS_URL'] ?? 'http://localhost:9300'

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

    // Fire-and-forget
    doCheck().catch(() => {})
  }
}
