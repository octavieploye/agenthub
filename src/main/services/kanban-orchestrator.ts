import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type {
  OrchestratorRun,
  OrchestratorTaskLog,
  OrchestratorStartInput,
  OrchestratorStatusResponse,
  OrchestratorPhase,
  OrchestratorStatusChangePayload,
  OrchestratorTaskPhaseChangePayload,
  RetryFailure,
} from '../../shared/types/orchestrator.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type { AgentSpawnOptions, AgentState } from '../../shared/types/agent.types'
import {
  insertRun,
  getRun,
  getActiveRun,
  updateRunStatus,
  updateRunTimestamp,
  getTaskLogsByRun,
  getTaskLogsByTask,
  getActiveTaskLogs,
  insertTaskLog,
  updateTaskLogStatus,
  getActiveTaskLogByAgentId,
  getUnacknowledgedRetryFailures,
  acknowledgeRetryFailures as dbAcknowledgeRetryFailures,
  insertRetryFailure,
} from '../db/queries/orchestrator.queries'
import { getTasksByRepo, getTaskById, updateTask } from '../db/queries/tasks.queries'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import { getDependencyMap } from '../db/queries/task-dependencies.queries'
import { getDispatchableTasks, type DependencyTask } from './helpers/dependency-solver'
import { buildExecutionSummary } from './helpers/execution-summary-builder'
import { checkOllamaHealthWithRetry } from './helpers/ollama-cloud-health'
import { recommendForPhase } from './model-dispatcher'
import { validateModelOverride } from './helpers/model-validator'
import {
  onOrchestratorEvent,
  offOrchestratorEvent,
  type OrchestratorAgentEvent,
} from './orchestrator-events'

const TICK_INTERVAL_MS = 30_000
const STUCK_THRESHOLD_MS = 30 * 60 * 1000

const NEXT_PHASE: Record<OrchestratorPhase, OrchestratorPhase | 'done'> = {
  dev: 'review',
  review: 'security',
  security: 'commit',
  commit: 'push',
  push: 'done',
}

/** Injected dependencies for testability — real implementations come from service-orchestrator. */
export interface OrchestratorDeps {
  spawnAgent: (options: AgentSpawnOptions) => AgentState
  getRepoPath: (repoId: string) => string | null
  gitStageAll: (repoPath: string) => void
  gitCommit: (repoPath: string, message: string) => string
  gitPush: (repoPath: string) => void
  onEventInserted?: () => void
  emitToRenderer?: (channel: string, ...args: unknown[]) => void
  sendTelegramNotification?: (summary: string, type: 'completed' | 'failed') => void
}

export class KanbanOrchestratorService {
  private db: Database.Database
  private deps: OrchestratorDeps | null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private completedHandler: ((event: OrchestratorAgentEvent) => void) | null = null
  private failedHandler: ((event: OrchestratorAgentEvent) => void) | null = null
  /** Task 2.10: synchronous git mutex — one commit/push per repo at a time */
  private gitLockActive = new Map<string, boolean>()

  constructor(db: Database.Database, deps?: OrchestratorDeps) {
    this.db = db
    this.deps = deps ?? null
  }

  start(input: OrchestratorStartInput): OrchestratorRun {
    // Task 2.1: Wrap ONLY DB operations in transaction, forward singleTaskId
    const updated = this.db.transaction(() => {
      const existing = getActiveRun(this.db)
      if (existing) {
        throw new Error(`Orchestrator already running: ${existing.id} (${existing.sprintName})`)
      }

      const run = insertRun(this.db, {
        sprintName: input.sprintName,
        repoId: input.repoId,
        projectId: input.projectId,
        concurrencyCap: input.concurrencyCap ?? 3,
        telegramNotify: input.telegramNotify ?? false,
        singleTaskId: input.singleTaskId,
      })

      updateRunStatus(this.db, run.id, 'running')
      return getRun(this.db, run.id)!
    })()

    // Event subscriptions and tick timer happen OUTSIDE transaction
    this.completedHandler = (event) => this.onAgentCompleted(event)
    this.failedHandler = (event) => this.onAgentFailed(event)
    onOrchestratorEvent('agent:completed', this.completedHandler)
    onOrchestratorEvent('agent:failed', this.failedHandler)

    // Start consistency poll
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS)

    log.info('Orchestrator started', { runId: updated.id, sprint: updated.sprintName })
    this.emitStatusChange(updated.id, 'running', updated.sprintName)
    this.notifyTelegram(updated, `Sprint "${updated.sprintName}" started`, 'completed')
    return updated
  }

  /** Task 2.2: Start a single task pipeline (no tick timer, immediate dispatch) */
  startSingleTask(input: OrchestratorStartInput): OrchestratorRun {
    if (!input.singleTaskId) {
      throw new Error('startSingleTask requires singleTaskId')
    }

    // Validate task exists in DB
    const task = getTaskById(this.db, input.singleTaskId)
    if (!task) {
      throw new Error(`Task not found: ${input.singleTaskId}`)
    }

    // If task has no sprintName, generate one
    const sprintName = input.sprintName || task.sprintName || `pipeline-${input.singleTaskId.slice(0, 8)}`

    // Create the run via transaction
    const updated = this.db.transaction(() => {
      const existing = getActiveRun(this.db)
      if (existing) {
        throw new Error(`Orchestrator already running: ${existing.id} (${existing.sprintName})`)
      }

      const run = insertRun(this.db, {
        sprintName,
        repoId: input.repoId,
        projectId: input.projectId,
        concurrencyCap: input.concurrencyCap ?? 1,
        telegramNotify: input.telegramNotify ?? false,
        singleTaskId: input.singleTaskId,
      })

      updateRunStatus(this.db, run.id, 'running')
      return getRun(this.db, run.id)!
    })()

    // Subscribe event listeners (same as start, but NO tick timer)
    this.completedHandler = (event) => this.onAgentCompleted(event)
    this.failedHandler = (event) => this.onAgentFailed(event)
    onOrchestratorEvent('agent:completed', this.completedHandler)
    onOrchestratorEvent('agent:failed', this.failedHandler)

    log.info('Orchestrator single-task started', {
      runId: updated.id,
      taskId: input.singleTaskId,
      sprint: updated.sprintName,
    })
    this.emitStatusChange(updated.id, 'running', updated.sprintName)
    this.notifyTelegram(updated, `Single task "${task.title}" started`, 'completed')

    // Dispatch immediately (no tick timer = no auto-dispatch otherwise)
    this.dispatchNextTasks(updated)

    return updated
  }

  /** Task 2.3: Cancel an active run */
  cancel(runId: string): void {
    const run = getRun(this.db, runId)
    if (!run) {
      throw new Error(`Run not found: ${runId}`)
    }
    if (run.status !== 'running' && run.status !== 'paused') {
      throw new Error(`Cannot cancel run with status "${run.status}" — must be running or paused`)
    }

    // Mark run as failed
    updateRunStatus(this.db, runId, 'failed')

    // Mark all active task logs for this run as failed
    const activeLogs = getActiveTaskLogs(this.db, runId)
    for (const taskLog of activeLogs) {
      updateTaskLogStatus(this.db, taskLog.id, 'failed')
    }

    // Clean up event listeners and tick timer
    this.stop()

    // Emit status change
    this.emitStatusChange(runId, 'failed', run.sprintName)

    log.info('Orchestrator cancelled', { runId, sprintName: run.sprintName })

    // Send telegram notification if enabled
    if (run.telegramNotify) {
      this.notifyTelegram(run, `Sprint "${run.sprintName}" cancelled`, 'failed')
    }
  }

  pause(runId: string): void {
    updateRunStatus(this.db, runId, 'paused')
    this.stopTick()
    const run = getRun(this.db, runId)
    this.emitStatusChange(runId, 'paused', run?.sprintName ?? '')
    log.info('Orchestrator paused', { runId })
  }

  resume(runId: string): void {
    updateRunStatus(this.db, runId, 'running')
    if (!this.tickTimer) {
      this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS)
    }
    const run = getRun(this.db, runId)
    this.emitStatusChange(runId, 'running', run?.sprintName ?? '')
    log.info('Orchestrator resumed', { runId })
  }

  private notifyTelegram(run: OrchestratorRun, summary: string, type: 'completed' | 'failed'): void {
    if (!run.telegramNotify) return
    this.deps?.sendTelegramNotification?.(summary, type)
  }

  private emitStatusChange(runId: string, status: string, sprintName: string): void {
    const payload: OrchestratorStatusChangePayload = {
      runId,
      status: status as OrchestratorStatusChangePayload['status'],
      sprintName,
    }
    this.deps?.emitToRenderer?.(IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE, payload)
  }

  private emitTaskPhaseChange(runId: string, taskId: string, phase: OrchestratorPhase, status: string): void {
    const payload: OrchestratorTaskPhaseChangePayload = {
      runId,
      taskId,
      phase,
      status: status as OrchestratorTaskPhaseChangePayload['status'],
    }
    this.deps?.emitToRenderer?.(IPC_EVENTS.ORCHESTRATOR.TASK_PHASE_CHANGE, payload)
  }

  getStatus(): OrchestratorStatusResponse {
    const run = getActiveRun(this.db)
    if (!run) {
      return { run: null, activeTasks: [], completedCount: 0, totalCount: 0, failedCount: 0, singleTaskId: null }
    }

    const allLogs = getTaskLogsByRun(this.db, run.id)
    const activeTasks = allLogs.filter(l => l.status === 'active')

    // Task 2.5: Branch for single-task mode
    if (run.singleTaskId) {
      const taskLogs = allLogs.filter(l => l.taskId === run.singleTaskId)
      const pushLog = taskLogs.find(l => l.phase === 'push')
      const completedCount = pushLog?.status === 'done' ? 1 : 0
      const failedCount = taskLogs.some(l => l.status === 'failed') ? 1 : 0

      return {
        run,
        activeTasks,
        completedCount,
        totalCount: 1,
        failedCount,
        singleTaskId: run.singleTaskId,
      }
    }

    // Batch mode: count at task level, group logs by taskId, check push phase
    const taskLogsByTask = new Map<string, typeof allLogs>()
    for (const l of allLogs) {
      const existing = taskLogsByTask.get(l.taskId) ?? []
      existing.push(l)
      taskLogsByTask.set(l.taskId, existing)
    }
    let completedCount = 0
    let failedCount = 0
    for (const [, logs] of taskLogsByTask) {
      const pushLog = logs.find(l => l.phase === 'push')
      if (pushLog?.status === 'done') completedCount++
      else if (logs.some(l => l.status === 'failed')) failedCount++
    }

    // Get total kanban tasks for the repo
    const tasks = getTasksByRepo(this.db, run.repoId)
    const totalCount = tasks.length

    return { run, activeTasks, completedCount, totalCount, failedCount, singleTaskId: run.singleTaskId ?? null }
  }

  getTaskLog(taskId: string): OrchestratorTaskLog[] {
    return getTaskLogsByTask(this.db, taskId)
  }

  getNextDispatchableTasks(runId: string): Array<{ id: string; title: string; priority: number }> {
    const run = getRun(this.db, runId)
    if (!run) return []

    const tasks = getTasksByRepo(this.db, run.repoId)
    const depMap = getDependencyMap(this.db)
    const allLogs = getTaskLogsByRun(this.db, runId)

    // Tasks currently being processed (any phase active)
    const activeLogs = new Set(allLogs.filter(l => l.status === 'active').map(l => l.taskId))

    // Tasks that have completed all phases (push phase done)
    const completedTasks = new Set<string>()
    const taskLogsByTask = new Map<string, typeof allLogs>()
    for (const l of allLogs) {
      const existing = taskLogsByTask.get(l.taskId) ?? []
      existing.push(l)
      taskLogsByTask.set(l.taskId, existing)
    }
    for (const [taskId, logs] of taskLogsByTask) {
      const pushLog = logs.find(l => l.phase === 'push')
      if (pushLog?.status === 'done') {
        completedTasks.add(taskId)
      }
    }

    // Build dependency-aware task list
    const depTasks: Array<DependencyTask & { title: string }> = tasks.map(t => ({
      id: t.id,
      priority: t.priority,
      blockedBy: depMap.get(t.id) ?? [],
      title: t.title,
    }))

    const dispatchable = getDispatchableTasks(depTasks, activeLogs, completedTasks, run.concurrencyCap)
    return dispatchable.map(t => ({ id: t.id, title: t.title, priority: t.priority }))
  }

  // ---------------------------------------------------------------------------
  // Phase dispatchers (B-1 through B-4)
  // ---------------------------------------------------------------------------

  dispatchDevPhase(taskId: string, run: OrchestratorRun): OrchestratorTaskLog | null {
    if (!this.deps) {
      log.warn('Orchestrator: no deps injected, cannot dispatch')
      return null
    }

    const task = getTaskById(this.db, taskId)
    if (!task) {
      log.warn('Orchestrator: task not found', { taskId })
      return null
    }

    const repoPath = this.deps.getRepoPath(run.repoId)
    if (!repoPath) {
      log.warn('Orchestrator: repo path not found', { repoId: run.repoId })
      return null
    }

    // Task 2.7: Respect modelOverride/providerOverride from task
    const { model, provider } = this.resolveModelForPhase('dev', task.description || task.title, task.modelOverride, task.providerOverride)

    // Task 2.9: Re-validate model at dispatch time
    const validationError = validateModelOverride(model, provider)
    if (validationError) {
      log.warn('Orchestrator: model validation failed at dispatch', { taskId, model, provider, error: validationError })
      const failedLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'dev', modelUsed: model, providerUsed: provider })
      updateTaskLogStatus(this.db, failedLog.id, 'failed')
      this.emitTaskPhaseChange(run.id, taskId, 'dev', 'failed')
      return null
    }

    const agent = this.deps.spawnAgent({
      repoId: run.repoId,
      name: `[orch] ${task.title}`,
      cwd: repoPath,
      model,
      provider: provider as AgentSpawnOptions['provider'],
      taskDescription: task.description || task.title,
      skipPermissions: true,
    })

    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase: 'dev',
      modelUsed: model,
      providerUsed: provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'active', agent.id)
    updateTask(this.db, taskId, { status: 'in_progress' })
    this.emitTaskPhaseChange(run.id, taskId, 'dev', 'active')

    log.info('Orchestrator: dev phase dispatched', {
      taskId, agentId: agent.id, model,
    })
    return taskLog
  }

  dispatchReviewPhase(taskId: string, run: OrchestratorRun): OrchestratorTaskLog | null {
    if (!this.deps) return null

    const task = getTaskById(this.db, taskId)
    if (!task) return null

    const repoPath = this.deps.getRepoPath(run.repoId)
    if (!repoPath) return null

    // Task 2.7: Respect modelOverride/providerOverride from task
    const { model, provider } = this.resolveModelForPhase('review', task.description || task.title, task.modelOverride, task.providerOverride)

    // Task 2.9: Re-validate model at dispatch time
    const validationError = validateModelOverride(model, provider)
    if (validationError) {
      log.warn('Orchestrator: model validation failed at dispatch', { taskId, model, provider, error: validationError })
      const failedLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'review', modelUsed: model, providerUsed: provider })
      updateTaskLogStatus(this.db, failedLog.id, 'failed')
      this.emitTaskPhaseChange(run.id, taskId, 'review', 'failed')
      return null
    }

    const reviewPrompt = [
      `Review the code changes for task: ${task.title}`,
      task.description ? `Description: ${task.description}` : '',
      'Check for: conflicts with existing code, friction points, tech debt, breaking changes, pattern mismatches.',
      'Output structured JSON with issues array.',
    ].filter(Boolean).join('\n')

    const agent = this.deps.spawnAgent({
      repoId: run.repoId,
      name: `[review] ${task.title}`,
      cwd: repoPath,
      model,
      provider: provider as AgentSpawnOptions['provider'],
      taskDescription: reviewPrompt,
      skipPermissions: true,
    })

    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase: 'review',
      modelUsed: model,
      providerUsed: provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'active', agent.id)
    this.emitTaskPhaseChange(run.id, taskId, 'review', 'active')

    log.info('Orchestrator: review phase dispatched', { taskId, agentId: agent.id })
    return taskLog
  }

  dispatchSecurityPhase(taskId: string, run: OrchestratorRun): OrchestratorTaskLog | null {
    if (!this.deps) return null

    const task = getTaskById(this.db, taskId)
    if (!task) return null

    const repoPath = this.deps.getRepoPath(run.repoId)
    if (!repoPath) return null

    // Task 2.7: Respect modelOverride/providerOverride from task
    const { model, provider } = this.resolveModelForPhase('security', task.description || task.title, task.modelOverride, task.providerOverride)

    // Task 2.9: Re-validate model at dispatch time
    const validationError = validateModelOverride(model, provider)
    if (validationError) {
      log.warn('Orchestrator: model validation failed at dispatch', { taskId, model, provider, error: validationError })
      const failedLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'security', modelUsed: model, providerUsed: provider })
      updateTaskLogStatus(this.db, failedLog.id, 'failed')
      this.emitTaskPhaseChange(run.id, taskId, 'security', 'failed')
      return null
    }

    // Select security team based on task properties
    const desc = (task.description || '').toLowerCase()
    let securityTeam = 'sec-devops'
    if (desc.includes('auth') || desc.includes('session') || desc.includes('token')) {
      securityTeam = 'insider-threat'
    } else if (desc.includes('user-input') || desc.includes('form') || desc.includes('query')) {
      securityTeam = 'threat-defense'
    }

    const securityPrompt = [
      `Security scan for task: ${task.title}`,
      `Security team: ${securityTeam}`,
      task.description ? `Description: ${task.description}` : '',
      'Scan for: OWASP top 10, injection, XSS, CSRF, data leakage, sovereignty violations.',
      'Output JSON: { "findings": [...], "recommendation": "pass|block|review" }',
    ].filter(Boolean).join('\n')

    const agent = this.deps.spawnAgent({
      repoId: run.repoId,
      name: `[security] ${task.title}`,
      cwd: repoPath,
      model,
      provider: provider as AgentSpawnOptions['provider'],
      taskDescription: securityPrompt,
      skipPermissions: true,
    })

    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase: 'security',
      modelUsed: model,
      providerUsed: provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'active', agent.id)
    this.emitTaskPhaseChange(run.id, taskId, 'security', 'active')

    log.info('Orchestrator: security phase dispatched', { taskId, agentId: agent.id, team: securityTeam })
    return taskLog
  }

  executeCommitPhase(taskId: string, run: OrchestratorRun, securityBlocked: boolean): boolean {
    if (!this.deps) return false

    const task = getTaskById(this.db, taskId)
    if (!task) return false

    const repoPath = this.deps.getRepoPath(run.repoId)
    if (!repoPath) return false

    if (securityBlocked) {
      log.warn('Orchestrator: security blocked commit', { taskId })
      this.pause(run.id)
      this.notifyTelegram(run, `CRITICAL: Security blocked task "${task.title}" — sprint paused`, 'failed')
      return false
    }

    // Task 2.10: Git mutex — skip if another commit/push is active for this repo
    if (this.gitLockActive.get(run.repoId)) {
      log.warn('Orchestrator: git lock active for repo, skipping commit (will retry on next tick)', { taskId, repoId: run.repoId })
      return false
    }

    // Commit phase
    const commitLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'commit' })
    updateTaskLogStatus(this.db, commitLog.id, 'active')
    this.emitTaskPhaseChange(run.id, taskId, 'commit', 'active')

    this.gitLockActive.set(run.repoId, true)
    try {
      this.deps.gitStageAll(repoPath)
      const scope = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
      const message = `feat(${scope}): ${task.title} [task-${taskId.slice(0, 8)}]`
      const hash = this.deps.gitCommit(repoPath, message)
      updateTaskLogStatus(this.db, commitLog.id, 'done')
      this.emitTaskPhaseChange(run.id, taskId, 'commit', 'done')

      log.info('Orchestrator: commit phase done', { taskId, hash: hash.slice(0, 8) })

      // Push phase
      const pushLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'push' })
      updateTaskLogStatus(this.db, pushLog.id, 'active')
      this.emitTaskPhaseChange(run.id, taskId, 'push', 'active')

      this.deps.gitPush(repoPath)
      updateTaskLogStatus(this.db, pushLog.id, 'done')
      this.emitTaskPhaseChange(run.id, taskId, 'push', 'done')

      // Mark task as tested (completed through orchestrator)
      updateTask(this.db, taskId, { status: 'tested' })

      // Build execution summary and emit ORCHESTRATOR_TASK_COMMITTED event
      const taskLogs = getTaskLogsByTask(this.db, taskId)
      const summary = buildExecutionSummary(taskId, task.title, taskLogs)

      insertTaskEvent(this.db, {
        taskId,
        eventType: 'ORCHESTRATOR_TASK_COMMITTED',
        fromStatus: 'push',
        toStatus: 'done',
        agentId: null,
        payload: { summary },
      })
      this.deps.onEventInserted?.()

      log.info('Orchestrator: push phase done, task complete', { taskId })
      return true
    } catch (err) {
      updateTaskLogStatus(this.db, commitLog.id, 'failed')
      this.notifyTelegram(run, `Commit/push failed for "${task.title}": ${String(err).slice(0, 100)}`, 'failed')
      log.error('Orchestrator: commit/push failed', { taskId, err: String(err) })
      return false
    } finally {
      this.gitLockActive.set(run.repoId, false)
    }
  }

  // ---------------------------------------------------------------------------
  // Phase transition coordinator (B-5)
  // ---------------------------------------------------------------------------

  private advancePhase(taskId: string, currentPhase: OrchestratorPhase, currentLogId: string, run: OrchestratorRun): void {
    // Mark current phase as done
    updateTaskLogStatus(this.db, currentLogId, 'done')
    this.emitTaskPhaseChange(run.id, taskId, currentPhase, 'done')

    const next = NEXT_PHASE[currentPhase]

    if (next === 'done') {
      log.info('Orchestrator: task fully completed', { taskId })

      // Task 2.6: Auto-complete for single-task mode
      if (run.singleTaskId) {
        // Verify push phase actually completed (not just that we reached 'done' state)
        const taskLogs = getTaskLogsByTask(this.db, taskId)
        const pushLog = taskLogs.find(l => l.phase === 'push')
        if (pushLog?.status === 'done') {
          updateRunStatus(this.db, run.id, 'completed')
          this.emitStatusChange(run.id, 'completed', run.sprintName)
          log.info('Orchestrator: single-task pipeline completed', { runId: run.id, taskId })
          this.notifyTelegram(run, `Task "${run.sprintName}" pipeline completed`, 'completed')
          this.stop()
          return
        }
      }

      this.dispatchNextTasks(run)
      return
    }

    // Dispatch next phase
    switch (next) {
      case 'review':
        this.dispatchReviewPhase(taskId, run)
        break
      case 'security':
        this.dispatchSecurityPhase(taskId, run)
        break
      case 'commit':
        this.executeCommitPhase(taskId, run, false)
        // After commit+push, dispatch next tasks
        this.dispatchNextTasks(run)
        break
      case 'push':
        // push is handled within executeCommitPhase
        break
    }
  }

  private dispatchNextTasks(run: OrchestratorRun): void {
    // Task 2.4: singleTaskId filter — skip dependency solver, only consider the single task
    if (run.singleTaskId) {
      const allLogs = getTaskLogsByRun(this.db, run.id)
      const taskLogs = allLogs.filter(l => l.taskId === run.singleTaskId)

      // Check if task already has an active log (any phase)
      const hasActive = taskLogs.some(l => l.status === 'active')
      if (hasActive) return

      // Check if push phase is done (task fully completed)
      const pushLog = taskLogs.find(l => l.phase === 'push')
      if (pushLog?.status === 'done') {
        // Task 2.6: Auto-complete single-task run
        updateRunStatus(this.db, run.id, 'completed')
        this.emitStatusChange(run.id, 'completed', run.sprintName)
        log.info('Orchestrator: single-task pipeline completed (via dispatchNextTasks)', { runId: run.id, taskId: run.singleTaskId })
        this.notifyTelegram(run, `Task "${run.sprintName}" pipeline completed`, 'completed')
        this.stop()
        return
      }

      // If no logs exist yet, dispatch dev phase
      if (taskLogs.length === 0) {
        this.dispatchDevPhase(run.singleTaskId, run)
      }
      // Otherwise, phase transitions are handled by advancePhase
      return
    }

    // Batch mode: use dependency solver
    const dispatchable = this.getNextDispatchableTasks(run.id)
    for (const task of dispatchable) {
      this.dispatchDevPhase(task.id, run)
    }

    // Check if all tasks are done
    const allLogs = getTaskLogsByRun(this.db, run.id)
    const tasks = getTasksByRepo(this.db, run.repoId)
    const taskLogsByTask = new Map<string, typeof allLogs>()
    for (const l of allLogs) {
      const existing = taskLogsByTask.get(l.taskId) ?? []
      existing.push(l)
      taskLogsByTask.set(l.taskId, existing)
    }
    let completedCount = 0
    for (const [, logs] of taskLogsByTask) {
      const pushLog = logs.find(l => l.phase === 'push')
      if (pushLog?.status === 'done') completedCount++
    }

    if (completedCount >= tasks.length && tasks.length > 0) {
      updateRunStatus(this.db, run.id, 'completed')
      this.emitStatusChange(run.id, 'completed', run.sprintName)
      log.info('Orchestrator: sprint completed', { runId: run.id, sprintName: run.sprintName })
      this.notifyTelegram(run, `Sprint "${run.sprintName}" completed — ${completedCount}/${tasks.length} tasks done`, 'completed')

      // Emit ORCHESTRATOR_SPRINT_COMPLETED event (taskId = run ID prefixed to distinguish from task IDs)
      insertTaskEvent(this.db, {
        taskId: `run:${run.id}`,
        eventType: 'ORCHESTRATOR_SPRINT_COMPLETED',
        fromStatus: 'running',
        toStatus: 'completed',
        agentId: null,
        payload: {
          runId: run.id,
          sprintName: run.sprintName,
          repoId: run.repoId,
          taskCount: tasks.length,
          completedCount,
        },
      })
      this.deps?.onEventInserted?.()
    }
  }

  tick(): void {
    const run = getActiveRun(this.db)
    if (!run || run.status !== 'running') return

    updateRunTimestamp(this.db, run.id)

    // Detect stuck agents (>30min in active state)
    const activeLogs = getActiveTaskLogs(this.db, run.id)
    for (const taskLog of activeLogs) {
      if (taskLog.startedAt) {
        const elapsed = Date.now() - new Date(taskLog.startedAt).getTime()
        if (elapsed > STUCK_THRESHOLD_MS) {
          log.warn('Orchestrator: stuck agent detected, marking as failed', {
            taskLogId: taskLog.id,
            taskId: taskLog.taskId,
            phase: taskLog.phase,
            elapsedMs: elapsed,
          })
          updateTaskLogStatus(this.db, taskLog.id, 'failed')
        }
      }
    }

    // Dispatch next tasks if slots available
    this.dispatchNextTasks(run)

    log.debug('Orchestrator tick', { runId: run.id, activeCount: activeLogs.length })
  }

  // ---------------------------------------------------------------------------
  // Retry failure queries (Task 3.12, 3.14)
  // ---------------------------------------------------------------------------

  getRetryFailures(): RetryFailure[] {
    return getUnacknowledgedRetryFailures(this.db)
  }

  acknowledgeRetryFailures(): void {
    dbAcknowledgeRetryFailures(this.db)
  }

  // ---------------------------------------------------------------------------
  // Task 3.3: Retry-wrapped spawn for ollama-cloud/local providers
  // ---------------------------------------------------------------------------

  private async retrySpawnWithHealthCheck(
    taskId: string,
    run: OrchestratorRun,
    phase: OrchestratorPhase,
    spawnFn: () => void,
    provider: string,
    baseUrl: string
  ): Promise<boolean> {
    const health = await checkOllamaHealthWithRetry(baseUrl)

    if (health.available) {
      spawnFn()
      return true
    }

    // Task 3.5: Record retry failure in DB
    insertRetryFailure(this.db, {
      taskId,
      provider,
      attempts: health.attempts,
      lastError: health.lastError,
      diagnostics: health.diagnostics,
    })

    // Set task note and mark as interrupted
    const task = getTaskById(this.db, taskId)
    if (task) {
      updateTask(this.db, taskId, {
        status: 'backlog',
      })
    }

    // Mark the task log as failed
    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase,
      providerUsed: provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'failed')
    this.emitTaskPhaseChange(run.id, taskId, phase, 'failed')

    // Task 3.4: Telegram notification on retry exhaustion
    this.notifyTelegram(
      run,
      `Retry exhausted for "${task?.title ?? taskId}" (${provider}, ${health.attempts} attempts): ${health.lastError ?? 'unknown error'}`,
      'failed'
    )

    log.warn('Orchestrator: retry exhausted for provider', {
      taskId,
      phase,
      provider,
      attempts: health.attempts,
      lastError: health.lastError,
    })

    return false
  }

  stop(): void {
    this.stopTick()
    if (this.completedHandler) {
      offOrchestratorEvent('agent:completed', this.completedHandler)
      this.completedHandler = null
    }
    if (this.failedHandler) {
      offOrchestratorEvent('agent:failed', this.failedHandler)
      this.failedHandler = null
    }
  }

  // ---------------------------------------------------------------------------
  // Task 2.7: Model/provider resolution helper
  // ---------------------------------------------------------------------------

  /** Resolve model + provider for a dispatch phase, respecting task-level overrides. */
  private resolveModelForPhase(
    phase: OrchestratorPhase,
    taskDescription: string,
    modelOverride: string | null,
    providerOverride: string | null
  ): { model: string; provider: string } {
    // If both overrides are set, use them directly
    if (modelOverride && providerOverride) {
      return { model: modelOverride, provider: providerOverride }
    }

    // If only provider is set, use recommendForPhase but with the overridden provider
    // (recommendForPhase picks the default model for the phase)
    if (providerOverride && !modelOverride) {
      const rec = recommendForPhase(phase, taskDescription, providerOverride === 'ollama-cloud')
      return { model: rec.model, provider: providerOverride }
    }

    // No overrides — use standard recommendation
    const rec = recommendForPhase(phase, taskDescription, false)
    return { model: rec.model, provider: rec.provider }
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  private onAgentCompleted(event: OrchestratorAgentEvent): void {
    const run = getActiveRun(this.db)
    if (!run) return

    const agentId = event.triageEvent.agentId
    const activeLog = getActiveTaskLogByAgentId(this.db, run.id, agentId)

    if (!activeLog) {
      log.debug('Orchestrator: completed agent not tracked by orchestrator', { agentId })
      return
    }

    log.info('Orchestrator: agent completed, advancing phase', {
      agentId,
      taskId: activeLog.taskId,
      phase: activeLog.phase,
    })

    this.advancePhase(activeLog.taskId, activeLog.phase, activeLog.id, run)
  }

  private onAgentFailed(event: OrchestratorAgentEvent): void {
    const run = getActiveRun(this.db)
    if (!run) return

    const agentId = event.triageEvent.agentId
    const activeLog = getActiveTaskLogByAgentId(this.db, run.id, agentId)

    if (!activeLog) {
      log.debug('Orchestrator: failed agent not tracked by orchestrator', { agentId })
      return
    }

    log.warn('Orchestrator: agent failed', {
      agentId,
      taskId: activeLog.taskId,
      phase: activeLog.phase,
    })

    updateTaskLogStatus(this.db, activeLog.id, 'failed')

    // Dispatch next tasks (other tasks may be unblocked)
    this.dispatchNextTasks(run)
  }
}
