import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type {
  OrchestratorRun,
  OrchestratorTaskLog,
  OrchestratorStartInput,
  OrchestratorStatusResponse,
  OrchestratorPhase,
} from '../../shared/types/orchestrator.types'
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
} from '../db/queries/orchestrator.queries'
import { getTasksByRepo, getTaskById, updateTask } from '../db/queries/tasks.queries'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import { getDependencyMap } from '../db/queries/task-dependencies.queries'
import { getDispatchableTasks, type DependencyTask } from './helpers/dependency-solver'
import { buildExecutionSummary } from './helpers/execution-summary-builder'
import { recommendForPhase } from './model-dispatcher'
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
}

export class KanbanOrchestratorService {
  private db: Database.Database
  private deps: OrchestratorDeps | null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private completedHandler: ((event: OrchestratorAgentEvent) => void) | null = null
  private failedHandler: ((event: OrchestratorAgentEvent) => void) | null = null

  constructor(db: Database.Database, deps?: OrchestratorDeps) {
    this.db = db
    this.deps = deps ?? null
  }

  start(input: OrchestratorStartInput): OrchestratorRun {
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
    })

    updateRunStatus(this.db, run.id, 'running')
    const updated = getRun(this.db, run.id)!

    // Subscribe to orchestrator events
    this.completedHandler = (event) => this.onAgentCompleted(event)
    this.failedHandler = (event) => this.onAgentFailed(event)
    onOrchestratorEvent('agent:completed', this.completedHandler)
    onOrchestratorEvent('agent:failed', this.failedHandler)

    // Start consistency poll
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS)

    log.info('Orchestrator started', { runId: updated.id, sprint: updated.sprintName })
    return updated
  }

  pause(runId: string): void {
    updateRunStatus(this.db, runId, 'paused')
    this.stopTick()
    log.info('Orchestrator paused', { runId })
  }

  resume(runId: string): void {
    updateRunStatus(this.db, runId, 'running')
    if (!this.tickTimer) {
      this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS)
    }
    log.info('Orchestrator resumed', { runId })
  }

  getStatus(): OrchestratorStatusResponse {
    const run = getActiveRun(this.db)
    if (!run) {
      return { run: null, activeTasks: [], completedCount: 0, totalCount: 0, failedCount: 0 }
    }

    const allLogs = getTaskLogsByRun(this.db, run.id)
    const activeTasks = allLogs.filter(l => l.status === 'active')

    // Count at task level: group logs by taskId, check push phase
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

    return { run, activeTasks, completedCount, totalCount, failedCount }
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

    const rec = recommendForPhase('dev', task.description || task.title, false)

    const agent = this.deps.spawnAgent({
      repoId: run.repoId,
      name: `[orch] ${task.title}`,
      cwd: repoPath,
      model: rec.model,
      provider: rec.provider as any,
      taskDescription: task.description || task.title,
      skipPermissions: true,
    })

    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase: 'dev',
      modelUsed: rec.model,
      providerUsed: rec.provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'active', agent.id)
    updateTask(this.db, taskId, { status: 'in_progress' })

    log.info('Orchestrator: dev phase dispatched', {
      taskId, agentId: agent.id, model: rec.model,
    })
    return taskLog
  }

  dispatchReviewPhase(taskId: string, run: OrchestratorRun): OrchestratorTaskLog | null {
    if (!this.deps) return null

    const task = getTaskById(this.db, taskId)
    if (!task) return null

    const repoPath = this.deps.getRepoPath(run.repoId)
    if (!repoPath) return null

    const rec = recommendForPhase('review', task.description || task.title, false)

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
      model: rec.model,
      provider: rec.provider as any,
      taskDescription: reviewPrompt,
      skipPermissions: true,
    })

    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase: 'review',
      modelUsed: rec.model,
      providerUsed: rec.provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'active', agent.id)

    log.info('Orchestrator: review phase dispatched', { taskId, agentId: agent.id })
    return taskLog
  }

  dispatchSecurityPhase(taskId: string, run: OrchestratorRun): OrchestratorTaskLog | null {
    if (!this.deps) return null

    const task = getTaskById(this.db, taskId)
    if (!task) return null

    const repoPath = this.deps.getRepoPath(run.repoId)
    if (!repoPath) return null

    const rec = recommendForPhase('security', task.description || task.title, false)

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
      model: rec.model,
      provider: rec.provider as any,
      taskDescription: securityPrompt,
      skipPermissions: true,
    })

    const taskLog = insertTaskLog(this.db, {
      runId: run.id,
      taskId,
      phase: 'security',
      modelUsed: rec.model,
      providerUsed: rec.provider,
    })
    updateTaskLogStatus(this.db, taskLog.id, 'active', agent.id)

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
      return false
    }

    // Commit phase
    const commitLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'commit' })
    updateTaskLogStatus(this.db, commitLog.id, 'active')

    try {
      this.deps.gitStageAll(repoPath)
      const scope = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
      const message = `feat(${scope}): ${task.title} [task-${taskId.slice(0, 8)}]`
      const hash = this.deps.gitCommit(repoPath, message)
      updateTaskLogStatus(this.db, commitLog.id, 'done')

      log.info('Orchestrator: commit phase done', { taskId, hash: hash.slice(0, 8) })

      // Push phase
      const pushLog = insertTaskLog(this.db, { runId: run.id, taskId, phase: 'push' })
      updateTaskLogStatus(this.db, pushLog.id, 'active')

      this.deps.gitPush(repoPath)
      updateTaskLogStatus(this.db, pushLog.id, 'done')

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
      log.error('Orchestrator: commit/push failed', { taskId, err: String(err) })
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Phase transition coordinator (B-5)
  // ---------------------------------------------------------------------------

  private advancePhase(taskId: string, currentPhase: OrchestratorPhase, currentLogId: string, run: OrchestratorRun): void {
    // Mark current phase as done
    updateTaskLogStatus(this.db, currentLogId, 'done')

    const next = NEXT_PHASE[currentPhase]

    if (next === 'done') {
      log.info('Orchestrator: task fully completed', { taskId })
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
      log.info('Orchestrator: sprint completed', { runId: run.id, sprintName: run.sprintName })

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
