import type Database from 'better-sqlite3'
import type { TelegramNotificationPayload } from '../../shared/types/telegram.types'
import {
  insertNotification,
  markSent,
  markFailed,
  markExpired,
  getQueued,
  getByAgent,
  getStats,
  isDuplicate,
  type TelegramNotificationRow,
  type TelegramNotificationStats,
} from '../db/queries/telegram-notifications.queries'

export interface TelegramQueueProcessorDeps {
  db: Database.Database
  notify: (payload: TelegramNotificationPayload) => void
  logInfo: (msg: string, meta?: Record<string, unknown>) => void
  logError: (msg: string, meta?: Record<string, unknown>) => void
}

export class TelegramQueueProcessor {
  private readonly deps: TelegramQueueProcessorDeps
  private retryTimer: ReturnType<typeof setInterval> | null = null
  private lastAttemptTimes = new Map<string, number>()

  constructor(deps: TelegramQueueProcessorDeps) {
    this.deps = deps
  }

  enqueue(payload: TelegramNotificationPayload): void {
    if (isDuplicate(this.deps.db, payload.agentId, payload.type)) {
      this.deps.logInfo('telegram notification deduplicated', {
        agentId: payload.agentId,
        type: payload.type,
      })
      return
    }

    const id = insertNotification(this.deps.db, payload)

    try {
      this.deps.notify(payload)
      markSent(this.deps.db, id)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      markFailed(this.deps.db, id, errMsg)
      this.deps.logError('telegram notification send failed, queued for retry', {
        id,
        agentId: payload.agentId,
        error: errMsg,
      })
    }
  }

  start(): void {
    if (this.retryTimer) return
    this.retryTimer = setInterval(() => this.processRetries(), 10_000)
  }

  stop(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer)
      this.retryTimer = null
    }
    this.lastAttemptTimes.clear()
  }

  getStats(agentId: string): TelegramNotificationStats {
    return getStats(this.deps.db, agentId)
  }

  getNotifications(agentId: string, limit?: number): TelegramNotificationRow[] {
    return getByAgent(this.deps.db, agentId, limit)
  }

  private processRetries(): void {
    const rows = getQueued(this.deps.db)
    for (const row of rows) {
      // Exponential backoff: skip if too soon since last attempt
      if (row.attempts > 0) {
        const backoffMs = Math.pow(2, row.attempts) * 1000
        const lastAttemptAt = this.lastAttemptTimes.get(row.id) ?? 0
        if (lastAttemptAt > 0 && Date.now() - lastAttemptAt < backoffMs) continue
      }

      try {
        const payload = JSON.parse(row.payload_json) as TelegramNotificationPayload
        this.deps.notify(payload)
        markSent(this.deps.db, row.id)
        this.lastAttemptTimes.delete(row.id)
        this.deps.logInfo('telegram notification retry succeeded', { id: row.id })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        this.lastAttemptTimes.set(row.id, Date.now())
        if (row.attempts + 1 >= 5) {
          markExpired(this.deps.db, row.id)
          this.lastAttemptTimes.delete(row.id)
          this.deps.logError('telegram notification expired after 5 attempts', {
            id: row.id,
            agentId: row.agent_id,
          })
        } else {
          markFailed(this.deps.db, row.id, errMsg)
        }
      }
    }
  }
}
