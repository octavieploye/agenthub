import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { getActiveRun, getActiveTaskLogs, getTaskLogsByRun } from '../db/queries/orchestrator.queries'
import { OPERATING_RULES } from './orchestrator-rules'
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
 *  - stuck-loop (a task's review phase failed >= MONITOR_LIMITS.stuckLoopThreshold times)
 */

export const MONITOR_LIMITS = {
  /** Token cap per run. Per-run attribution is injected (claude-monitor is global). */
  maxTokens: 2_000_000,
  /** Consecutive review-phase failures for a single task before flagging a stuck loop. */
  stuckLoopThreshold: 3,
}

export const MONITOR_INTERVAL_MS = 30_000

export interface OrchestratorMonitorDeps {
  pause: (runId: string) => void
  sendTelegramNotification?: (summary: string, type: 'completed' | 'failed') => void
  getRunTokenUsage?: (runId: string) => number
}

export class OrchestratorMonitorService {
  private db: Database.Database
  private deps: OrchestratorMonitorDeps
  private timer: ReturnType<typeof setInterval> | null = null

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
    const run = getActiveRun(this.db)
    if (!run) return

    if (this.checkConcurrentAgents(run)) return
    if (this.checkDuration(run)) return
    if (this.checkTokens(run)) return
    this.checkStuckLoop(run)
  }

  private checkConcurrentAgents(run: OrchestratorRun): boolean {
    const active = getActiveTaskLogs(this.db, run.id)
    if (active.length > OPERATING_RULES.limits.maxAgents) {
      this.breach(
        run,
        `concurrent agents exceeded (${active.length}/${OPERATING_RULES.limits.maxAgents})`
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
        )}min)`
      )
      return true
    }
    return false
  }

  private checkTokens(run: OrchestratorRun): boolean {
    const tokens = this.deps.getRunTokenUsage?.(run.id) ?? 0
    if (tokens > MONITOR_LIMITS.maxTokens) {
      this.breach(run, `token cost exceeded (${tokens}/${MONITOR_LIMITS.maxTokens})`)
      return true
    }
    return false
  }

  private checkStuckLoop(run: OrchestratorRun): void {
    const logs = getTaskLogsByRun(this.db, run.id)
    const reviewFailures = new Map<string, number>()
    for (const log of logs) {
      if (log.phase === 'review' && log.status === 'failed') {
        reviewFailures.set(log.taskId, (reviewFailures.get(log.taskId) ?? 0) + 1)
      }
    }
    for (const [taskId, count] of reviewFailures) {
      if (count >= MONITOR_LIMITS.stuckLoopThreshold) {
        this.breach(run, `stuck-loop detected (task ${taskId}: ${count} review failures)`)
        return
      }
    }
  }

  private breach(run: OrchestratorRun, reason: string): void {
    this.deps.pause(run.id)
    this.deps.sendTelegramNotification?.(`Orchestrator monitor auto-paused: ${reason}`, 'failed')
    log.warn('Orchestrator monitor: breach, auto-paused', { runId: run.id, reason })
  }
}
