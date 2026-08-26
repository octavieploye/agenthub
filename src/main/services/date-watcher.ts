import log from 'electron-log/main'
import { existsSync } from 'fs'
import type Database from 'better-sqlite3'
import { getAllProjects } from '../db/queries/projects.queries'
import { getRepoIdsByProject } from '../db/queries/project-repos.queries'
import { getTasksByRepo } from '../db/queries/tasks.queries'
import { updateTask } from '../db/queries/tasks.queries'
import { getRepoById } from '../db/queries/repos.queries'
import { getActiveRun } from '../db/queries/orchestrator.queries'
import { insertTaskEvent } from '../db/queries/task-events.queries'
import { isSupervisedCategory } from '../../shared/constants/category-classifier'
import { checkOllamaHealthWithRetry } from './helpers/ollama-cloud-health'
import { insertRetryFailure } from '../db/queries/orchestrator.queries'
import type { TaskItem } from '../../shared/types/task.types'
import type { OrchestratorStartInput } from '../../shared/types/orchestrator.types'
import { isOrchestratorEnabled } from './orchestrator-settings'

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const STALENESS_DAYS = 1

export interface DateWatcherDeps {
  startOrchestratorRun: (input: OrchestratorStartInput) => unknown
  sendTelegramNotification?: (summary: string, type: 'completed' | 'failed') => void
  onEventInserted?: () => void
  getOllamaBaseUrl?: () => string
}

export class DateWatcherService {
  private db: Database.Database
  private deps: DateWatcherDeps
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor(db: Database.Database, deps: DateWatcherDeps) {
    this.db = db
    this.deps = deps
  }

  start(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
    log.info('DateWatcher started', { intervalMs: POLL_INTERVAL_MS })
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    log.info('DateWatcher stopped')
  }

  /**
   * Main poll cycle. Reads tasks from configured projects,
   * checks date triggers, batches eligible tasks per repo.
   */
  poll(): void {
    // S74: Stop polling if orchestrator disabled at runtime
    if (!isOrchestratorEnabled(this.db)) {
      log.info('DateWatcher: orchestrator disabled at runtime, stopping')
      this.stop()
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - STALENESS_DAYS * 86_400_000).toISOString().slice(0, 10)

    // Task 4.10: Scope to configured projects only
    const projects = getAllProjects(this.db)
    if (projects.length === 0) return

    // Group eligible tasks by repoId for batching
    const eligibleByRepo = new Map<string, { tasks: TaskItem[]; projectId: string }>()

    for (const project of projects) {
      const repoIds = getRepoIdsByProject(this.db, project.id)

      for (const repoId of repoIds) {
        // Task 4.18: Check repo path exists
        const repo = getRepoById(this.db, repoId)
        if (!repo) {
          log.warn('DateWatcher: repo not found in DB', { repoId })
          continue
        }
        if (!existsSync(repo.path)) {
          log.warn('DateWatcher: repo path no longer exists, skipping', { repoId, path: repo.path })
          continue
        }

        const tasks = getTasksByRepo(this.db, repoId)

        for (const task of tasks) {
          // Skip tasks not associated with this project
          if (task.projectId !== project.id) continue

          // Skip tasks without target dates
          if (!task.sectionTargetDate) continue

          // Skip already-triggered tasks (dedup via persisted date_trigger_fired_at)
          if (task.dateTriggerFiredAt === today) continue

          // Only trigger tasks in eligible statuses
          if (task.status !== 'backlog' && task.status !== 'today') continue

          // Task 4.15: Staleness window — only [yesterday, today]
          if (task.sectionTargetDate < yesterday || task.sectionTargetDate > today) continue

          // Task 4.16: Set date_trigger_fired_at
          updateTask(this.db, task.id, { dateTriggerFiredAt: today })

          // Emit DATE_TRIGGER_FIRED event
          insertTaskEvent(this.db, {
            taskId: task.id,
            eventType: 'DATE_TRIGGER_FIRED',
            fromStatus: task.status,
            toStatus: task.status,
            agentId: null,
            payload: { sectionTargetDate: task.sectionTargetDate, today, source: 'date-watcher' },
          })
          this.deps.onEventInserted?.()

          // Task 4.11: Apply category safety gate
          if (isSupervisedCategory(task.category)) {
            if (task.status !== 'today') {
              updateTask(this.db, task.id, { status: 'today' })
            }
            this.notify(`Date trigger: "${task.title}" promoted to Today (supervised)`, 'completed')
            log.info('DateWatcher: promoted supervised task', { taskId: task.id, category: task.category })
            continue
          }

          // Task 4.11: Check requiresApproval for unsupervised
          if (task.requiresApproval) {
            if (task.status !== 'today') {
              updateTask(this.db, task.id, { status: 'today' })
            }
            this.notify(`Date trigger: "${task.title}" promoted to Today (requires approval)`, 'completed')
            log.info('DateWatcher: promoted task (requires approval)', { taskId: task.id })
            continue
          }

          // Task 4.12: Enforce ollama-cloud/local for unsupervised auto-dispatch
          // Override anthropic/null to ollama-cloud — never burn Anthropic quota unsupervised
          if (!task.providerOverride || task.providerOverride === 'anthropic') {
            updateTask(this.db, task.id, { providerOverride: 'ollama-cloud' })
          }

          // Promote to "today" and collect for batch dispatch
          if (task.status !== 'today') {
            updateTask(this.db, task.id, { status: 'today' })
          }

          const existing = eligibleByRepo.get(repoId)
          if (existing) {
            existing.tasks.push(task)
          } else {
            eligibleByRepo.set(repoId, { tasks: [task], projectId: project.id })
          }
        }
      }
    }

    // Task 4.13: Batch same-date eligible tasks into one run per repo
    for (const [repoId, { tasks, projectId }] of eligibleByRepo) {
      if (tasks.length === 0) continue

      this.startBatchRun(repoId, projectId, tasks, today)
    }
  }

  /**
   * Task 4.13: Start a batch run for date-triggered tasks.
   * Task 4.14: Pre-check ollama-cloud health before starting.
   * Task 4.17: Catch "already running" and fall back to promote+notify.
   */
  private startBatchRun(
    repoId: string,
    projectId: string,
    tasks: TaskItem[],
    today: string
  ): void {
    // Task 4.17: Check if a run is already active
    const activeRun = getActiveRun(this.db)
    if (activeRun) {
      // Fall back to promote+notify for all tasks
      for (const task of tasks) {
        this.notify(`Date trigger: "${task.title}" promoted (orchestrator busy)`, 'completed')
      }
      log.info('DateWatcher: orchestrator busy, promoted tasks instead of dispatching', {
        activeRunId: activeRun.id,
        taskCount: tasks.length,
      })
      return
    }

    // Task 4.14: Pre-check ollama-cloud health (async, fire-and-forget with callback)
    const baseUrl = this.deps.getOllamaBaseUrl?.() ?? 'http://localhost:11434'
    checkOllamaHealthWithRetry(baseUrl).then((health) => {
      if (!health.available) {
        // Mark all tasks as interrupted
        for (const task of tasks) {
          updateTask(this.db, task.id, { status: 'backlog' })
          insertRetryFailure(this.db, {
            taskId: task.id,
            provider: 'ollama-cloud',
            attempts: health.attempts,
            lastError: health.lastError,
            diagnostics: health.diagnostics,
          })
        }
        this.notify(
          `DateWatcher: ollama-cloud unreachable after ${health.attempts} attempts — ${tasks.length} tasks moved to backlog`,
          'failed'
        )
        log.warn('DateWatcher: ollama-cloud unhealthy, tasks moved to backlog', {
          taskCount: tasks.length,
          attempts: health.attempts,
        })
        return
      }

      // Start the batch run
      const sprintName = `date-trigger-${today}`
      try {
        this.deps.startOrchestratorRun({
          sprintName,
          repoId,
          projectId,
          telegramNotify: true,
          triggerSource: 'date-watcher',
          taskIds: tasks.map((t) => t.id),
          confirmed: false,
        })
        this.notify(
          `DateWatcher: started batch run "${sprintName}" with ${tasks.length} tasks`,
          'completed'
        )
        log.info('DateWatcher: batch run started', { sprintName, repoId, taskCount: tasks.length })
      } catch (err) {
        // Task 4.17: Catch "already running" — promote+notify
        for (const task of tasks) {
          this.notify(`Date trigger: "${task.title}" promoted (start failed: ${String(err).slice(0, 80)})`, 'completed')
        }
        log.warn('DateWatcher: failed to start batch run, promoted tasks', {
          repoId,
          error: String(err).slice(0, 200),
        })
      }
    }).catch((err) => {
      log.error('DateWatcher: health check threw unexpected error', { err: String(err) })
    })
  }

  private notify(summary: string, type: 'completed' | 'failed'): void {
    this.deps.sendTelegramNotification?.(summary, type)
  }
}
