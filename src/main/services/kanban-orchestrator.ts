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
import { CODEX_MODELS } from '../../shared/constants/model-catalog'
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
  updateTaskLogSummary,
  getActiveTaskLogByAgentId,
  getUnacknowledgedRetryFailures,
  acknowledgeRetryFailures as dbAcknowledgeRetryFailures,
} from '../db/queries/orchestrator.queries'
import { getTasksByRepo, getTasksBySprint, getTaskById, updateTask } from '../db/queries/tasks.queries'
import type { TaskItem } from '../../shared/types/task.types'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import { getDependencyMap } from '../db/queries/task-dependencies.queries'
import { getDispatchableTasks, type DependencyTask } from './helpers/dependency-solver'
import { buildExecutionSummary } from './helpers/execution-summary-builder'
import { isSupervisedCategory } from '../../shared/constants/category-classifier'
import { recommendForPhase } from './model-dispatcher'
import { validateModelOverride } from './helpers/model-validator'
import { parseSecurityOutput, type SecurityParseResult } from './helpers/security-output-parser'
import { getPhaseProfile, shouldSkipSecurity, shouldLoopBack } from './helpers/phase-profile'
import {
  onOrchestratorEvent,
  offOrchestratorEvent,
  type OrchestratorAgentEvent,
} from './orchestrator-events'
import { isOrchestratorEnabled } from './orchestrator-settings'
import { getAnamnesisReader } from './anamnesis-reader'
import { GUARDRAIL_PROMPTS, OPERATING_RULES } from './orchestrator-rules'

const TICK_INTERVAL_MS = 30_000
const STUCK_THRESHOLD_MS = 30 * 60 * 1000

/** R-004: Shared auto-trigger check — triggers that bypass the manual confirmation gate */
const AUTO_TRIGGER_SOURCES = new Set(['date-watcher', 'sprint-watcher', 'single-task'])

const NEXT_PHASE: Record<OrchestratorPhase, OrchestratorPhase | 'done'> = OPERATING_RULES.phaseOrder.reduce(
  (acc, phase, index) => {
    acc[phase] = OPERATING_RULES.phaseOrder[index + 1] ?? 'done'
    return acc
  },
  {} as Record<OrchestratorPhase, OrchestratorPhase | 'done'>
)

/** Injected dependencies for testability — real implementations come from service-orchestrator. */
export interface OrchestratorDeps {
  spawnAgent: (options: AgentSpawnOptions) => AgentState
  getRepoPath: (repoId: string) => string | null
  gitStageAll: (repoPath: string) => void
  gitCommit: (repoPath: string, message: string) => string
  gitPush: (repoPath: string) => void
  getAgentOutput?: (agentId: string) => string | null
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
  /** Security loop-back cycle count per task (C1-C3, loop-back) */
  private securityCycleCount = new Map<string, number>()
  /** Phase retry count per task+phase key (C4) */
  private phaseRetryCount = new Map<string, number>()
  /** Tasks awaiting security approval from the user (C3) */
  private pendingSecurityApproval = new Map<string, SecurityParseResult>()
  /** S5: total agents spawned per run (budget cap) */
  private agentsSpawnedByRun = new Map<string, number>()

  constructor(db: Database.Database, deps?: OrchestratorDeps) {
    this.db = db
    this.deps = deps ?? null
  }

  start(input: OrchestratorStartInput): OrchestratorRun {
    if (!isOrchestratorEnabled(this.db)) {
      throw new Error('ORCHESTRATOR_DISABLED: orchestrator.enabled is not set to true')
    }

    // S4 + S73: Manual start requires confirmation; auto-triggers are pre-authorized
    const isAutoTrigger = AUTO_TRIGGER_SOURCES.has(input.triggerSource ?? '')
    if (!isAutoTrigger && input.confirmed !== true) {
      throw new Error('ORCHESTRATOR_NOT_CONFIRMED: manual start requires confirmed: true')
    }
    if (isAutoTrigger) {
      log.info('Orchestrator: auto-dispatch authorized via trigger source', { triggerSource: input.triggerSource })
    }

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
        startedBy: input.startedBy ?? 'user',
        triggerSource: input.triggerSource ?? 'manual',
        taskIds: input.taskIds,
      })

      updateRunStatus(this.db, run.id, 'running')
      return getRun(this.db, run.id)!
    })()

    // M1: Validate all dependency IDs exist before starting (scoped to the run's task set)
    this.validateDependencies(this.resolveRunTasks(updated))

    // M4: Pre-flight — check Anamnesis sprint inventory for duplicate work (non-blocking)
    this.checkSprintInventory(updated.sprintName, updated.repoId).catch((err) => {
      log.warn('Orchestrator: sprint inventory pre-flight check failed (non-blocking)', { error: String(err) })
    })

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

    // R-002: When singleTaskId is present via start(), dispatch immediately like startSingleTask()
    if (updated.singleTaskId) {
      this.dispatchNextTasks(updated)
    }

    return updated
  }

  /**
   * S4: Resolve the scoped task list for a manual start WITHOUT creating a run
   * or dispatching anything. Returns the pick-list the user must confirm.
   */
  previewRun(input: OrchestratorStartInput): { id: string; title: string; priority: number }[] {
    const throwaway: OrchestratorRun = {
      id: '',
      sprintName: input.sprintName,
      projectId: input.projectId ?? null,
      repoId: input.repoId,
      status: 'idle',
      concurrencyCap: input.concurrencyCap ?? 3,
      telegramNotify: input.telegramNotify ?? false,
      createdAt: '',
      updatedAt: '',
      startedAt: null,
      completedAt: null,
      singleTaskId: input.singleTaskId ?? null,
      startedBy: input.startedBy ?? null,
      triggerSource: input.triggerSource ?? null,
      taskIds: input.taskIds ?? null,
    }
    return this.resolveRunTasks(throwaway).map((t) => ({ id: t.id, title: t.title, priority: t.priority }))
  }

  /** Task 2.2: Start a single task pipeline (no tick timer, immediate dispatch) */
  startSingleTask(input: OrchestratorStartInput): OrchestratorRun {
    if (!isOrchestratorEnabled(this.db)) {
      throw new Error('ORCHESTRATOR_DISABLED: orchestrator.enabled is not set to true')
    }

    // S76: Require confirmation for manual single-task starts; auto-triggers are pre-authorized
    // Default triggerSource for single-task is 'single-task' (resolved here before the gate)
    const resolvedTriggerSource = input.triggerSource ?? 'single-task'
    if (!AUTO_TRIGGER_SOURCES.has(resolvedTriggerSource) && input.confirmed !== true) {
      throw new Error('ORCHESTRATOR_NOT_CONFIRMED: manual start requires confirmed: true')
    }

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
        startedBy: input.startedBy ?? 'user',
        triggerSource: input.triggerSource ?? 'single-task',
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

  /**
   * Task 2.3: Cancel an active run.
   * R-006: Intentionally NOT gated on isOrchestratorEnabled — cancel is a shutdown
   * action that must work even when the kill-switch is disabled, so a runaway
   * orchestrator can always be stopped.
   */
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
    // S72: Block resume when kill-switch is off
    if (!isOrchestratorEnabled(this.db)) {
      throw new Error('ORCHESTRATOR_DISABLED: cannot resume — orchestrator.enabled is not set to true')
    }
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

  /**
   * M4: Non-blocking Anamnesis sprint_inventory pre-flight check.
   * Queries Anamnesis procedural memory for existing sprint work.
   * If the sprint is already done or in_progress, logs a warning and notifies via Telegram.
   * Never blocks dispatch — all errors are caught silently.
   */
  private async checkSprintInventory(sprintName: string, repoId: string): Promise<void> {
    const reader = getAnamnesisReader()
    if (!reader) return

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const anamnesisUrl = process.env['ANAMNESIS_URL'] ?? 'http://localhost:9300'
      const authSecret = process.env['ANAMNESIS_AUTH_SECRET'] ?? process.env['AUTH_SECRET'] ?? ''

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
        log.warn('Orchestrator: sprint inventory pre-flight found existing work', {
          sprintName,
          repoId,
          existingStatus: status,
        })
        // Non-blocking warning — does not prevent dispatch
        this.deps?.sendTelegramNotification?.(
          `Sprint "${sprintName}" may already exist in Anamnesis (status: ${status}). Proceeding anyway.`,
          'failed'
        )
      }
    } catch {
      // Circuit breaker: never block dispatch if Anamnesis is down
    }
  }

  /** S5: Gate a spawn on the run's agent + wall-clock budget. Returns false (and pauses) on breach. */
  private checkBudget(run: OrchestratorRun): boolean {
    const fresh = getRun(this.db, run.id) ?? run
    const { maxAgents, maxWallClockMs } = OPERATING_RULES.limits

    const spawned = this.agentsSpawnedByRun.get(run.id) ?? 0
    if (spawned >= maxAgents) {
      this.pauseForBudget(fresh, `agent budget exceeded (${spawned}/${maxAgents} agents spawned)`)
      return false
    }

    if (fresh.startedAt) {
      const elapsed = Date.now() - new Date(fresh.startedAt).getTime()
      if (elapsed > maxWallClockMs) {
        this.pauseForBudget(
          fresh,
          `wall-clock budget exceeded (${Math.round(elapsed / 60_000)}min > ${Math.round(maxWallClockMs / 60_000)}min)`
        )
        return false
      }
    }

    return true
  }

  private pauseForBudget(run: OrchestratorRun, reason: string): void {
    this.pause(run.id)
    this.notifyTelegram(run, `Orchestrator auto-paused: ${reason}`, 'failed')
    log.warn('Orchestrator: budget breach, auto-paused', { runId: run.id, reason })
  }

  private recordSpawn(runId: string): void {
    this.agentsSpawnedByRun.set(runId, (this.agentsSpawnedByRun.get(runId) ?? 0) + 1)
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

    // Get total kanban tasks for the run's scope
    const tasks = this.resolveRunTasks(run)
    const totalCount = tasks.length

    return { run, activeTasks, completedCount, totalCount, failedCount, singleTaskId: run.singleTaskId ?? null }
  }

  getTaskLog(taskId: string): OrchestratorTaskLog[] {
    return getTaskLogsByTask(this.db, taskId)
  }

  getNextDispatchableTasks(runId: string): Array<{ id: string; title: string; priority: number }> {
    const run = getRun(this.db, runId)
    if (!run) return []

    const tasks = this.resolveRunTasks(run)
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

    // C4: Exclude tasks whose retry count is exhausted
    const permanentlyFailed = new Set<string>()
    for (const [key, count] of this.phaseRetryCount) {
      if (count >= OPERATING_RULES.maxPhaseRetries) {
        const taskId = key.split(':')[0]
        permanentlyFailed.add(taskId)
      }
    }

    // Build dependency-aware task list (excluding permanently failed tasks)
    const depTasks: Array<DependencyTask & { title: string }> = tasks
      .filter(t => !permanentlyFailed.has(t.id))
      .map(t => ({
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

  /** Guard: returns true if there is already an active log for this task+phase in this run. */
  private hasActiveLogForPhase(runId: string, taskId: string, phase: OrchestratorPhase): boolean {
    const logs = getTaskLogsByTask(this.db, taskId)
    return logs.some(l => l.runId === runId && l.phase === phase && l.status === 'active')
  }

  dispatchDevPhase(taskId: string, run: OrchestratorRun): OrchestratorTaskLog | null {
    if (!this.deps) {
      log.warn('Orchestrator: no deps injected, cannot dispatch')
      return null
    }

    if (!this.checkBudget(run)) return null

    if (this.hasActiveLogForPhase(run.id, taskId, 'dev')) {
      log.warn('Orchestrator: duplicate dev dispatch blocked', { taskId })
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
      taskDescription: [
        GUARDRAIL_PROMPTS.dev,
        '[TASK CONTENT START]',
        task.description || task.title,
        '[TASK CONTENT END]',
      ].filter(Boolean).join('\n\n'),
      skipPermissions: true,
    })
    this.recordSpawn(run.id)

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

    if (!this.checkBudget(run)) return null

    if (this.hasActiveLogForPhase(run.id, taskId, 'review')) {
      log.warn('Orchestrator: duplicate review dispatch blocked', { taskId })
      return null
    }

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
      GUARDRAIL_PROMPTS.review,
      'Check for: conflicts with existing code, friction points, tech debt, breaking changes, pattern mismatches.',
      'Output structured JSON with issues array.',
      '[TASK CONTENT START]',
      `Review the code changes for task: ${task.title}`,
      task.description ? `Description: ${task.description}` : '',
      '[TASK CONTENT END]',
    ].filter(Boolean).join('\n\n')

    const agent = this.deps.spawnAgent({
      repoId: run.repoId,
      name: `[review] ${task.title}`,
      cwd: repoPath,
      model,
      provider: provider as AgentSpawnOptions['provider'],
      taskDescription: reviewPrompt,
      skipPermissions: true,
    })
    this.recordSpawn(run.id)

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

    if (!this.checkBudget(run)) return null

    if (this.hasActiveLogForPhase(run.id, taskId, 'security')) {
      log.warn('Orchestrator: duplicate security dispatch blocked', { taskId })
      return null
    }

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
      GUARDRAIL_PROMPTS.security,
      'Scan for: OWASP top 10, injection, XSS, CSRF, data leakage, sovereignty violations.',
      'Output JSON: { "findings": [...], "recommendation": "pass|block|review" }',
      '[TASK CONTENT START]',
      `Security scan for task: ${task.title}`,
      `Security team: ${securityTeam}`,
      task.description ? `Description: ${task.description}` : '',
      '[TASK CONTENT END]',
    ].filter(Boolean).join('\n\n')

    const agent = this.deps.spawnAgent({
      repoId: run.repoId,
      name: `[security] ${task.title}`,
      cwd: repoPath,
      model,
      provider: provider as AgentSpawnOptions['provider'],
      taskDescription: securityPrompt,
      skipPermissions: true,
    })
    this.recordSpawn(run.id)

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

      // Push phase — separate try/catch so commit log stays 'done' if push fails
      const pushLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'push' })
      updateTaskLogStatus(this.db, pushLog.id, 'active')
      this.emitTaskPhaseChange(run.id, taskId, 'push', 'active')

      try {
        this.deps.gitPush(repoPath)
        updateTaskLogStatus(this.db, pushLog.id, 'done')
        this.emitTaskPhaseChange(run.id, taskId, 'push', 'done')
      } catch (pushErr) {
        // M2: Push failed — mark push log (not commit log) as failed
        updateTaskLogStatus(this.db, pushLog.id, 'failed')
        this.emitTaskPhaseChange(run.id, taskId, 'push', 'failed')
        this.notifyTelegram(run, `Push failed for "${task.title}": ${String(pushErr).slice(0, 100)}`, 'failed')
        log.error('Orchestrator: push failed (commit succeeded)', { taskId, err: String(pushErr) })
        return false
      }

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
      this.emitTaskPhaseChange(run.id, taskId, 'commit', 'failed')
      this.notifyTelegram(run, `Commit failed for "${task.title}": ${String(err).slice(0, 100)}`, 'failed')
      log.error('Orchestrator: commit failed', { taskId, err: String(err) })
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
      case 'security': {
        // Category-based phase profile: skip security for design/ui/style tasks
        const task = getTaskById(this.db, taskId)
        const profile = getPhaseProfile(task?.category ?? null)
        if (shouldSkipSecurity(profile)) {
          log.info('Orchestrator: skipping security phase (category profile)', { taskId, category: task?.category })
          // R-005: Record skipped phase in audit trail
          const skippedLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'security', modelUsed: 'n/a', providerUsed: 'n/a' })
          updateTaskLogStatus(this.db, skippedLog.id, 'skipped')
          this.emitTaskPhaseChange(run.id, taskId, 'security', 'skipped')
          // Skip security, go straight to commit — only dispatch next if commit succeeds
          const committed = this.executeCommitPhase(taskId, run, false)
          if (committed) this.dispatchNextTasks(run)
        } else {
          this.dispatchSecurityPhase(taskId, run)
        }
        break
      }
      case 'commit': {
        // C1+C2: Parse security output and gate on CRITICAL findings
        const secResult = this.getSecurityResult(taskId, run.id)
        if (secResult.hasCritical || secResult.recommendation === 'block') {
          // Check if loop-back is possible
          const task = getTaskById(this.db, taskId)
          const profile = getPhaseProfile(task?.category ?? null)
          const cycleCount = this.securityCycleCount.get(taskId) ?? 0
          if (shouldLoopBack(profile, cycleCount)) {
            // Loop back: security → dev → review → security
            this.securityCycleCount.set(taskId, cycleCount + 1)
            log.info('Orchestrator: security loop-back, restarting dev phase', {
              taskId, cycle: cycleCount + 1, maxCycles: profile.maxSecurityCycles,
            })
            this.notifyTelegram(run,
              `Security loop-back for "${task?.title ?? taskId}" (cycle ${cycleCount + 1}/${profile.maxSecurityCycles}): ${secResult.findings.length} findings`,
              'failed')
            // Re-dispatch dev phase with security findings as context
            this.dispatchDevPhaseWithSecurityContext(taskId, run, secResult)
          } else {
            // C3: Max cycles reached or no loop-back — pause and escalate
            this.pendingSecurityApproval.set(taskId, secResult)
            this.executeCommitPhase(taskId, run, true)
          }
        } else {
          const committed = this.executeCommitPhase(taskId, run, false)
          if (committed) this.dispatchNextTasks(run)
        }
        break
      }
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

      // C4: Check if max retries exhausted for this task
      const hasExhaustedRetries = Array.from(this.phaseRetryCount.entries())
        .some(([key, count]) => key.startsWith(run.singleTaskId!) && count >= OPERATING_RULES.maxPhaseRetries)

      if (hasExhaustedRetries) {
        updateRunStatus(this.db, run.id, 'failed')
        this.emitStatusChange(run.id, 'failed', run.sprintName)
        log.error('Orchestrator: single-task max retries exhausted', { runId: run.id, taskId: run.singleTaskId })
        this.notifyTelegram(run, `Task "${run.sprintName}" failed after max retries`, 'failed')
        this.stop()
        return
      }

      // If no logs exist yet, dispatch dev phase
      if (taskLogs.length === 0) {
        this.dispatchDevPhase(run.singleTaskId, run)
        return
      }

      // C4: If last phase failed but retries remain, re-dispatch same phase
      const lastLog = taskLogs.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0]
      if (lastLog?.status === 'failed') {
        // Re-dispatch the failed phase
        switch (lastLog.phase) {
          case 'dev':
            this.dispatchDevPhase(run.singleTaskId, run)
            break
          case 'review':
            this.dispatchReviewPhase(run.singleTaskId, run)
            break
          case 'security':
            this.dispatchSecurityPhase(run.singleTaskId, run)
            break
          default:
            // commit/push failures are not retried via agent dispatch
            break
        }
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
    const tasks = this.resolveRunTasks(run)
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
    // S72: Runtime kill-switch — auto-pause if disabled mid-run
    // R-001: Clear timer FIRST to guarantee shutdown even if pause() throws
    if (!isOrchestratorEnabled(this.db)) {
      if (this.tickTimer) {
        clearInterval(this.tickTimer)
        this.tickTimer = null
      }
      const activeRun = getActiveRun(this.db)
      if (activeRun && activeRun.status === 'running') {
        log.warn('Orchestrator: kill-switch disabled at runtime, auto-pausing', { runId: activeRun.id })
        try {
          this.pause(activeRun.id)
        } catch (err) {
          log.error('Orchestrator: failed to pause on kill-switch disable', { runId: activeRun.id, error: String(err) })
        }
        this.notifyTelegram(activeRun, 'Orchestrator auto-paused: kill-switch disabled at runtime', 'failed')
      }
      return
    }

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

    // Task 4.5: Check date triggers before dispatching
    this.checkDateTriggers(run)

    // Dispatch next tasks if slots available
    this.dispatchNextTasks(run)

    log.debug('Orchestrator tick', { runId: run.id, activeCount: activeLogs.length })
  }

  // ---------------------------------------------------------------------------
  // Task 4.1-4.6, 4.8: Date trigger checking for active-run mode
  // ---------------------------------------------------------------------------

  /**
   * Check tasks in the active run for date triggers.
   * Tasks with sectionTargetDate within [today - 1 day, today] that haven't
   * been triggered yet get either promoted or dispatched based on category/approval.
   */
  checkDateTriggers(run: OrchestratorRun): void {
    // Skip for single-task runs — no date trigger logic needed
    if (run.singleTaskId) return

    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

    const tasks = this.resolveRunTasks(run)

    for (const task of tasks) {
      // Skip tasks without target dates
      if (!task.sectionTargetDate) continue

      // Task 4.6: Guard against re-triggering — already fired today
      if (task.dateTriggerFiredAt === today) continue

      // Only trigger tasks in eligible statuses (backlog or today)
      if (task.status !== 'backlog' && task.status !== 'today') continue

      // Task 4.15 (inline): Staleness window — only [yesterday, today]
      if (task.sectionTargetDate < yesterday || task.sectionTargetDate > today) continue

      // Task 4.4: Set date_trigger_fired_at to persist dedup
      updateTask(this.db, task.id, { dateTriggerFiredAt: today })

      // Emit DATE_TRIGGER_FIRED event
      insertTaskEvent(this.db, {
        taskId: task.id,
        eventType: 'DATE_TRIGGER_FIRED',
        fromStatus: task.status,
        toStatus: task.status,
        agentId: null,
        payload: { sectionTargetDate: task.sectionTargetDate, today },
      })
      this.deps?.onEventInserted?.()

      // Task 4.2: Apply category safety gate
      if (isSupervisedCategory(task.category)) {
        // Supervised: always promote to "Today" + notify, never auto-dispatch
        if (task.status !== 'today') {
          updateTask(this.db, task.id, { status: 'today' })
        }
        this.notifyTelegram(run, `Date trigger: "${task.title}" promoted to Today (supervised category)`, 'completed')
        log.info('Orchestrator: date trigger — promoted supervised task', { taskId: task.id, category: task.category })
        continue
      }

      // Task 4.3: Unsupervised category — check requiresApproval
      if (task.requiresApproval) {
        // Requires approval: promote to "Today" + notify, do not auto-dispatch
        if (task.status !== 'today') {
          updateTask(this.db, task.id, { status: 'today' })
        }
        this.notifyTelegram(run, `Date trigger: "${task.title}" promoted to Today (requires approval)`, 'completed')
        log.info('Orchestrator: date trigger — promoted task (requires approval)', { taskId: task.id })
        continue
      }

      // Unsupervised + no approval needed = auto-dispatch via pipeline
      // Task will be picked up by dispatchNextTasks() on the next pass
      if (task.status !== 'today') {
        updateTask(this.db, task.id, { status: 'today' })
      }
      this.notifyTelegram(run, `Date trigger: "${task.title}" auto-dispatching (unsupervised)`, 'completed')
      log.info('Orchestrator: date trigger — auto-dispatching unsupervised task', { taskId: task.id, category: task.category })
    }
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
    // Clear run-scoped state to prevent stale data between runs
    this.securityCycleCount.clear()
    this.phaseRetryCount.clear()
    this.pendingSecurityApproval.clear()
    this.gitLockActive.clear()
    this.agentsSpawnedByRun.clear()
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
      // openai-codex has no recommendForPhase support — default to first Codex model
      if (providerOverride === 'openai-codex') {
        return { model: CODEX_MODELS[0].id, provider: 'openai-codex' }
      }
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

  // ---------------------------------------------------------------------------
  // M1: Validate dependency IDs before starting
  // ---------------------------------------------------------------------------

  /**
   * Resolve the task list a run is allowed to touch.
   *
   * Precedence:
   * 1. Explicit `taskIds` (date-watcher batch, single-task batch) — filter by ID.
   * 2. A real sprint name (not the synthetic `date-trigger-*` label) — sprint-scoped.
   * 3. Fallback — repo-wide (legacy runs where sprintName was a cosmetic label).
   */
  private resolveRunTasks(run: OrchestratorRun): TaskItem[] {
    if (run.taskIds && run.taskIds.length > 0) {
      const idSet = new Set(run.taskIds)
      return getTasksByRepo(this.db, run.repoId).filter((t) => idSet.has(t.id))
    }

    if (run.sprintName && !run.sprintName.startsWith('date-trigger-')) {
      const sprintTasks = getTasksBySprint(this.db, run.repoId, run.sprintName)
      if (sprintTasks.length > 0) return sprintTasks
    }

    return getTasksByRepo(this.db, run.repoId)
  }

  private validateDependencies(tasks: TaskItem[]): void {
    const taskIds = new Set(tasks.map(t => t.id))
    const depMap = getDependencyMap(this.db)

    for (const [taskId, deps] of depMap) {
      if (!taskIds.has(taskId)) continue // dependency for a task outside the run's scope
      for (const depId of deps) {
        if (!taskIds.has(depId)) {
          throw new Error(
            `Broken dependency: task ${taskId} depends on ${depId} which does not exist in the run's task set`
          )
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // C1/C2: Retrieve and parse security result for a task
  // ---------------------------------------------------------------------------

  private getSecurityResult(taskId: string, runId: string): SecurityParseResult {
    const taskLogs = getTaskLogsByTask(this.db, taskId)
    // Find the most recent security phase log for THIS run only
    const securityLogs = taskLogs
      .filter(l => l.phase === 'security' && l.status === 'done' && l.runId === runId)
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

    const latestSecLog = securityLogs[0]
    if (!latestSecLog?.summaryJson) {
      // No stored output — try getting it from the agent directly
      if (latestSecLog?.agentId && this.deps?.getAgentOutput) {
        const rawOutput = this.deps.getAgentOutput(latestSecLog.agentId)
        return parseSecurityOutput(rawOutput)
      }
      // No output available — default to 'review' (safe)
      return parseSecurityOutput(null)
    }

    // Parse the stored summaryJson — reconstruct directly if it's our own structure
    try {
      const stored = JSON.parse(latestSecLog.summaryJson) as Record<string, unknown>
      if (stored.recommendation && Array.isArray(stored.findings)) {
        return {
          recommendation: stored.recommendation as SecurityParseResult['recommendation'],
          findings: stored.findings as SecurityParseResult['findings'],
          hasCritical: Boolean(stored.hasCritical),
          hasHigh: Boolean(stored.hasHigh),
          raw: latestSecLog.summaryJson,
        }
      }
    } catch (parseErr) {
      log.warn('Orchestrator: invalid JSON in security summaryJson, falling back to raw parse', { taskId, error: String(parseErr) })
    }

    return parseSecurityOutput(latestSecLog.summaryJson)
  }

  // ---------------------------------------------------------------------------
  // Loop-back: Re-dispatch dev phase with security findings as context
  // ---------------------------------------------------------------------------

  private dispatchDevPhaseWithSecurityContext(
    taskId: string,
    run: OrchestratorRun,
    secResult: SecurityParseResult
  ): void {
    if (!this.deps) {
      log.warn('Orchestrator: no deps injected, cannot dispatch loop-back', { taskId })
      return
    }

    if (!this.checkBudget(run)) return

    const task = getTaskById(this.db, taskId)
    if (!task) {
      log.warn('Orchestrator: task not found for loop-back', { taskId })
      return
    }

    const repoPath = this.deps.getRepoPath(run.repoId)
    if (!repoPath) {
      log.warn('Orchestrator: repo path not found for loop-back', { repoId: run.repoId })
      return
    }

    // Build a prompt that includes the security findings
    const findingsSummary = secResult.findings
      .map(f => `[${f.severity.toUpperCase()}] ${f.category}: ${f.description}${f.file ? ` (${f.file}:${f.line ?? '?'})` : ''}`)
      .join('\n')

    const { model, provider } = this.resolveModelForPhase(
      'dev', task.description || task.title,
      task.modelOverride, task.providerOverride
    )

    const validationError = validateModelOverride(model, provider)
    if (validationError) {
      log.warn('Orchestrator: model validation failed during loop-back', { taskId, error: validationError })
      return
    }

    const cycleCount = this.securityCycleCount.get(taskId) ?? 1
    const loopBackPrompt = [
      GUARDRAIL_PROMPTS.dev,
      `SECURITY LOOP-BACK (cycle ${cycleCount}): Fix the security findings listed below.`,
      `Security recommendation: ${secResult.recommendation}`,
      'Security findings to fix:',
      findingsSummary,
      'Fix ALL findings above. Do not introduce new security issues.',
      '[TASK CONTENT START]',
      task.title,
      task.description ? `Description: ${task.description}` : '',
      '[TASK CONTENT END]',
    ].filter(Boolean).join('\n\n')

    const agent = this.deps.spawnAgent({
      repoId: run.repoId,
      name: `[fix-sec] ${task.title}`,
      cwd: repoPath,
      model,
      provider: provider as AgentSpawnOptions['provider'],
      taskDescription: loopBackPrompt,
      skipPermissions: true,
    })
    this.recordSpawn(run.id)

    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase: 'dev',
      modelUsed: model,
      providerUsed: provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'active', agent.id)
    this.emitTaskPhaseChange(run.id, taskId, 'dev', 'active')

    log.info('Orchestrator: dev phase dispatched (security loop-back)', {
      taskId, agentId: agent.id, cycle: cycleCount,
    })
  }

  // ---------------------------------------------------------------------------
  // C3: Human approval gate for security findings
  // ---------------------------------------------------------------------------

  approveSecurityFindings(runId: string, taskId: string, approved: boolean): void {
    const run = getRun(this.db, runId)
    if (!run) throw new Error(`Run not found: ${runId}`)
    if (run.status !== 'running' && run.status !== 'paused') {
      throw new Error(`Cannot approve security for run with status "${run.status}" — must be running or paused`)
    }

    const pending = this.pendingSecurityApproval.get(taskId)
    if (!pending) throw new Error(`No pending security approval for task: ${taskId}`)

    this.pendingSecurityApproval.delete(taskId)

    if (approved) {
      log.info('Orchestrator: security findings approved by human, proceeding to commit', { runId, taskId })
      // Resume run if it was paused by the security gate
      if (run.status === 'paused') {
        this.resume(runId)
      }
      this.executeCommitPhase(taskId, run, false)
      this.dispatchNextTasks(run)
    } else {
      log.info('Orchestrator: security findings rejected by human, failing task', { runId, taskId })
      // Mark task as permanently failed — set retry count to max to prevent re-dispatch
      updateTask(this.db, taskId, { status: 'backlog' })
      this.phaseRetryCount.set(`${taskId}:security`, OPERATING_RULES.maxPhaseRetries)
      this.notifyTelegram(run, `Task "${taskId}" rejected after security review`, 'failed')
      this.dispatchNextTasks(run)
    }
  }

  // ---------------------------------------------------------------------------
  // Agent event handlers
  // ---------------------------------------------------------------------------

  private onAgentCompleted(event: OrchestratorAgentEvent): void {
    const run = getActiveRun(this.db)
    if (!run) return

    const agentId = event.triageEvent.agentId
    const activeLog = getActiveTaskLogByAgentId(this.db, run.id, agentId)

    if (!activeLog) {
      log.debug('Orchestrator: completed agent not tracked by orchestrator', { agentId })
      return
    }

    // C1: Store security phase output for later parsing
    if (activeLog.phase === 'security' && this.deps?.getAgentOutput) {
      const rawOutput = this.deps.getAgentOutput(agentId)
      if (rawOutput) {
        const parsed = parseSecurityOutput(rawOutput)
        const summaryJson = JSON.stringify({
          recommendation: parsed.recommendation,
          findings: parsed.findings,
          hasCritical: parsed.hasCritical,
          hasHigh: parsed.hasHigh,
        })
        const issuesJson = parsed.findings.length > 0
          ? JSON.stringify(parsed.findings)
          : null
        updateTaskLogSummary(this.db, activeLog.id, summaryJson, issuesJson)
      }
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

    // C4: Track retry count per task+phase
    const retryKey = `${activeLog.taskId}:${activeLog.phase}`
    const retries = (this.phaseRetryCount.get(retryKey) ?? 0) + 1
    this.phaseRetryCount.set(retryKey, retries)

    log.warn('Orchestrator: agent failed', {
      agentId,
      taskId: activeLog.taskId,
      phase: activeLog.phase,
      retryCount: retries,
    })

    updateTaskLogStatus(this.db, activeLog.id, 'failed')

    if (retries >= OPERATING_RULES.maxPhaseRetries) {
      // Max retries reached — mark task as failed, don't retry
      log.error('Orchestrator: max retries reached for task phase', {
        taskId: activeLog.taskId,
        phase: activeLog.phase,
        retries,
      })
      updateTask(this.db, activeLog.taskId, { status: 'backlog' })
      this.notifyTelegram(run,
        `Task "${activeLog.taskId}" failed after ${retries} retries in ${activeLog.phase} phase`,
        'failed')
    }

    // Dispatch next tasks (other tasks may be unblocked)
    this.dispatchNextTasks(run)
  }
}
