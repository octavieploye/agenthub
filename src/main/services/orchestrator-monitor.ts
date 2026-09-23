import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import {
  getActiveRuns,
  getActiveTaskLogs,
  getTaskLogsByRun,
  getExpiredPendingApprovals,
  getRun,
  extendApproval,
  escalateApproval,
  markApprovalExpired,
  wasFilesChangedReported,
} from '../db/queries/orchestrator.queries'
import { getTaskById, updateTask } from '../db/queries/tasks.queries'
import { getExpiredNotifications } from '../db/queries/telegram-notifications.queries'
import { OPERATING_RULES } from './orchestrator-rules'
import { getApprovalWindowMinutes } from './orchestrator-settings'
import type { OrchestratorRun } from '../../shared/types/orchestrator.types'

/**
 * S6 — Deterministic Monitor (rules-based, no LLM).
 *
 * An independent safety net that polls the active orchestrator run and enforces
 * hard limits the orchestrator's own internal checks might miss. On breach it
 * pauses the run and sends a Telegram alert. No LLM calls — pure rules.
 *
 * Limits enforced:
 *  - max concurrent agents (active task logs > OPERATING_RULES.limits.maxAgents)
 *  - max run duration (startedAt elapsed > OPERATING_RULES.limits.maxWallClockMs)
 *  - max token cost (injected getRunTokenUsage(runId) > MONITOR_LIMITS.maxTokens)
 *  - max total retries (failed logs count >= OPERATING_RULES.limits.maxRunRetries)
 *  - stuck-loop (a task's phase failed >= MONITOR_LIMITS.stuckLoopThreshold times in any phase)
 */

export const MONITOR_LIMITS = {
  /** Token cap per run. Per-run attribution is injected (claude-monitor is global). */
  maxTokens: 2_000_000,
  /** Consecutive failures in any phase for a single task before flagging a stuck loop. */
  stuckLoopThreshold: 3,
  /** Minimum interval between Telegram delivery health alerts. */
  telegramHealthAlertCooldownMs: 10 * 60 * 1000,
}

export const MONITOR_INTERVAL_MS = 30_000

export interface OrchestratorMonitorDeps {
  pause: (runId: string) => void
  /** Reconcile persisted task logs with the live agent registry before safety checks. */
  reconcileActiveAgents?: () => number | void
  sendTelegramNotification?: (summary: string, type: 'completed' | 'failed') => void
  getRunTokenUsage?: (runId: string) => number
  notifyApproval?: (requestId: string, title: string, repoId: string, sprintName?: string, description?: string) => void   // A — re-notify
  sendEscalation?: (requestId: string, title: string, repoId: string, sprintName?: string, description?: string) => void   // C — plain-text /approve
}

export class OrchestratorMonitorService {
  private db: Database.Database
  private deps: OrchestratorMonitorDeps
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTelegramHealthAlertAt = 0

  constructor(db: Database.Database, deps: OrchestratorMonitorDeps) {
    this.db = db
    this.deps = deps
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.check(), MONITOR_INTERVAL_MS)
    log.info('Orchestrator monitor started')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    log.info('Orchestrator monitor stopped')
  }

  /** Single rules pass. Public so tests can drive it deterministically. */
  check(): void {
    const initialRuns = getActiveRuns(this.db).filter(r => r.status === 'running')
    if (initialRuns.length === 0) return

    this.deps.reconcileActiveAgents?.()

    // Reconciliation can complete the final task and close runs.
    const activeRuns = getActiveRuns(this.db).filter(r => r.status === 'running')
    if (activeRuns.length === 0) return

    for (const run of activeRuns) {
      if (run.status !== 'running') continue
      if (this.checkConcurrentAgents(run)) continue
      if (this.checkDuration(run)) continue
      if (this.checkTokens(run)) continue
      if (this.checkTotalRetries(run)) continue
      this.checkStuckLoop(run)
    }
    this.checkApprovalStalls()
    this.checkTelegramHealth()
  }

  private checkConcurrentAgents(run: OrchestratorRun): boolean {
    const active = getActiveTaskLogs(this.db, run.id)
    const cap = run.concurrencyCap ?? OPERATING_RULES.limits.maxAgents
    if (active.length > cap) {
      this.breach(
        run,
        `concurrent agents exceeded (${active.length}/${cap})`
      )
      return true
    }
    return false
  }

  private checkDuration(run: OrchestratorRun): boolean {
    if (!run.startedAt) return false
    const elapsed = Date.now() - new Date(run.startedAt).getTime()
    if (elapsed > OPERATING_RULES.limits.maxWallClockMs) {
      this.breach(
        run,
        `run duration exceeded (${Math.round(elapsed / 60_000)}min > ${Math.round(
          OPERATING_RULES.limits.maxWallClockMs / 60_000
        )}min) — reply /extend ${run.id} to add 4h and resume`
      )
      return true
    }
    return false
  }

  private checkTokens(run: OrchestratorRun): boolean {
    let tokens: number
    try {
      tokens = this.deps.getRunTokenUsage?.(run.id) ?? 0
    } catch (err) {
      // Fail-safe: if token counting errors, assume the cap is breached.
      // Returning 0 would be fail-open — the safeguard would silently stop working.
      this.breach(run, `token usage check failed (${err instanceof Error ? err.message : String(err)}) — fail-safe pause`)
      return true
    }
    if (tokens > MONITOR_LIMITS.maxTokens) {
      this.breach(run, `token cost exceeded (${tokens}/${MONITOR_LIMITS.maxTokens})`)
      return true
    }
    return false
  }

  private checkTotalRetries(run: OrchestratorRun): boolean {
    const logs = getTaskLogsByRun(this.db, run.id)
    const totalFailed = logs.filter(l => l.status === 'failed').length
    if (totalFailed >= OPERATING_RULES.limits.maxRunRetries) {
      this.breach(run, `global retry cap exceeded (${totalFailed}/${OPERATING_RULES.limits.maxRunRetries} total failures)`)
      return true
    }
    return false
  }

  private checkStuckLoop(run: OrchestratorRun): void {
    const logs = getTaskLogsByRun(this.db, run.id)
    const phaseFailures = new Map<string, number>()
    for (const log of logs) {
      if (log.status === 'failed') {
        const key = `${log.taskId}:${log.phase}`
        phaseFailures.set(key, (phaseFailures.get(key) ?? 0) + 1)
      }
    }
    for (const [key, count] of phaseFailures) {
      if (count >= MONITOR_LIMITS.stuckLoopThreshold) {
        this.breach(run, `stuck-loop detected (${key}: ${count} failures)`)
        return
      }
    }
  }

  private checkApprovalStalls(): void {
    const approvals = getExpiredPendingApprovals(this.db)
    if (approvals.length === 0) return
    const window = getApprovalWindowMinutes(this.db)
    for (const a of approvals) {
      const task = getTaskById(this.db, a.taskId)
      const run = getRun(this.db, a.runId)
      const title = task?.title ?? a.taskId
      const requestId = `task:${a.taskId}:${a.runId}`
      const repoId = run?.repoId ?? ''
      const sprintName = run?.sprintName
      const description = task?.description

      if (a.reminderCount < OPERATING_RULES.approvalMaxReminders) {
        // A — re-notify + extend window
        this.deps.notifyApproval?.(requestId, title, repoId, sprintName, description)
        extendApproval(this.db, a.id, window)
      } else if (a.reminderCount === OPERATING_RULES.approvalMaxReminders) {
        // C — escalate via plain-text /approve; stop auto-extending
        this.deps.sendEscalation?.(requestId, title, repoId, sprintName, description)
        escalateApproval(this.db, a.id)  // count 2 → 3
      } else {
        // B — last resort: reset to backlog ONLY if the task never actually ran
        if (!this.approvalNeverRan(a)) continue
        markApprovalExpired(this.db, a.id)
        updateTask(this.db, a.taskId, { status: 'backlog' })
        this.deps.sendTelegramNotification?.(
          `Task "${title}" reset to backlog — approval expired and it never started`,
          'failed'
        )
      }
    }
  }

  private approvalNeverRan(a: { runId: string; taskId: string }): boolean {
    const hasActiveLog = getActiveTaskLogs(this.db, a.runId).some(l => l.taskId === a.taskId)
    if (hasActiveLog) return false
    return !wasFilesChangedReported(this.db, a.runId, a.taskId)
  }

  private checkTelegramHealth(): void {
    const expired = getExpiredNotifications(this.db)
    if (expired.length === 0) return
    const now = Date.now()
    if (now - this.lastTelegramHealthAlertAt < MONITOR_LIMITS.telegramHealthAlertCooldownMs) return
    this.lastTelegramHealthAlertAt = now
    this.deps.sendTelegramNotification?.(
      `Telegram delivery degraded: ${expired.length} notification(s) expired after retry budget`,
      'failed'
    )
  }

  private breach(run: OrchestratorRun, reason: string): void {
    this.deps.pause(run.id)
    this.deps.sendTelegramNotification?.(`Orchestrator monitor auto-paused: ${reason}`, 'failed')
    log.warn('Orchestrator monitor: breach, auto-paused', { runId: run.id, reason })
  }
}
