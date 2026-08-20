import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type {
  OrchestratorRun,
  OrchestratorTaskLog,
  OrchestratorStartInput,
  OrchestratorStatusResponse,
} from '../../shared/types/orchestrator.types'
import {
  insertRun,
  getRun,
  getActiveRun,
  updateRunStatus,
  updateRunTimestamp,
  getTaskLogsByRun,
  getTaskLogsByTask,
  getActiveTaskLogs,
} from '../db/queries/orchestrator.queries'
import { getTasksByRepo } from '../db/queries/tasks.queries'
import { getDependencyMap } from '../db/queries/task-dependencies.queries'
import { getDispatchableTasks, type DependencyTask } from './helpers/dependency-solver'
import {
  onOrchestratorEvent,
  offOrchestratorEvent,
  type OrchestratorAgentEvent,
} from './orchestrator-events'

const TICK_INTERVAL_MS = 30_000

export class KanbanOrchestratorService {
  private db: Database.Database
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private completedHandler: ((event: OrchestratorAgentEvent) => void) | null = null
  private failedHandler: ((event: OrchestratorAgentEvent) => void) | null = null

  constructor(db: Database.Database) {
    this.db = db
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

    // Tasks currently being processed
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

  tick(): void {
    const run = getActiveRun(this.db)
    if (!run || run.status !== 'running') return

    updateRunTimestamp(this.db, run.id)

    // Detect stuck agents (>30min in active state)
    const activeLogs = getActiveTaskLogs(this.db, run.id)
    for (const taskLog of activeLogs) {
      if (taskLog.startedAt) {
        const elapsed = Date.now() - new Date(taskLog.startedAt).getTime()
        if (elapsed > 30 * 60 * 1000) {
          log.warn('Orchestrator: stuck agent detected', {
            taskLogId: taskLog.id,
            taskId: taskLog.taskId,
            phase: taskLog.phase,
            elapsedMs: elapsed,
          })
        }
      }
    }

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
    log.info('Orchestrator: agent completed', {
      agentId: event.triageEvent.agentId,
      task: event.triageEvent.taskDescription,
    })
    // Phase transition logic will be implemented in R7-B
  }

  private onAgentFailed(event: OrchestratorAgentEvent): void {
    log.warn('Orchestrator: agent failed', {
      agentId: event.triageEvent.agentId,
      task: event.triageEvent.taskDescription,
    })
    // Error handling will be implemented in R7-B
  }
}
