import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { getUnsyncedEvents, markEventSynced } from '../db/queries/task-events.queries'
import type { TaskEvent, TaskEventType } from '../../shared/types/task.types'

const ENDPOINT_MAP: Record<TaskEventType, string> = {
  CARD_TRANSITION: '/memory/episodic',
  CARD_COMPLETED: '/memory/procedural',
  CARD_INTERRUPTED: '/memory/procedural',
  SPRINT_INTAKE: '/memory/episodic'
}

interface AnamnesisWriterDeps {
  anamnesisUrl: string
  fetch?: typeof globalThis.fetch
  authSecret?: string
}

export class AnamnesisWriter {
  private db: Database.Database
  private anamnesisUrl: string
  private fetch: typeof globalThis.fetch
  private authSecret: string
  private consecutiveFailures = 0
  private circuitOpen = false
  private lastFailureTime = 0
  private flushing = false
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null

  private static readonly MAX_FAILURES = 3
  private static readonly BACKOFF_MS = 60_000
  private static readonly FETCH_TIMEOUT_MS = 5_000
  private static readonly BATCH_SIZE = 10

  constructor(db: Database.Database, deps: AnamnesisWriterDeps) {
    this.db = db
    this.anamnesisUrl = deps.anamnesisUrl
    this.fetch = deps.fetch ?? globalThis.fetch
    this.authSecret = deps.authSecret ?? process.env['AUTH_SECRET'] ?? ''
  }

  onEventInserted(): void {
    if (this.circuitOpen) return
    this.flush().catch((err) => log.error('AnamnesisWriter flush error', err))
  }

  async flush(): Promise<void> {
    if (this.flushing) return
    if (this.circuitOpen) {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed < AnamnesisWriter.BACKOFF_MS) return
      log.info('AnamnesisWriter: circuit half-open, retrying')
    }

    this.flushing = true
    try {
      const allEvents = getUnsyncedEvents(this.db)
      const batch = allEvents.slice(0, AnamnesisWriter.BATCH_SIZE)
      const remaining = allEvents.length - batch.length

      for (const event of batch) {
        const ok = await this.sendEvent(event)
        if (!ok && this.circuitOpen) return
      }

      if (remaining > 0) {
        setTimeout(() => {
          this.flush().catch((err) => log.error('AnamnesisWriter scheduled flush error', err))
        }, 0)
      }
    } finally {
      this.flushing = false
    }
  }

  private async sendEvent(event: TaskEvent): Promise<boolean> {
    const path = ENDPOINT_MAP[event.eventType]
    const url = `${this.anamnesisUrl}${path}`
    const payload = JSON.parse(event.payloadJson)

    try {
      const res = await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimaeus-Caller': 'hephaestus',
          ...(this.authSecret ? { Authorization: `Bearer ${this.authSecret}` } : {})
        },
        body: JSON.stringify({
          ...payload,
          eventId: event.id,
          eventType: event.eventType,
          createdAt: event.createdAt
        }),
        signal: AbortSignal.timeout(AnamnesisWriter.FETCH_TIMEOUT_MS)
      })

      if (res.ok) {
        markEventSynced(this.db, event.id)
        this.consecutiveFailures = 0
        this.circuitOpen = false
        if (this.recoveryTimer) {
          clearTimeout(this.recoveryTimer)
          this.recoveryTimer = null
        }
        return true
      } else {
        log.warn('AnamnesisWriter: non-OK response', { status: res.status, eventId: event.id })
        this.recordFailure()
        return false
      }
    } catch (err) {
      log.warn('AnamnesisWriter: Anamnesis unreachable, event queued', { eventId: event.id })
      this.recordFailure()
      return false
    }
  }

  private recordFailure(): void {
    this.consecutiveFailures++
    this.lastFailureTime = Date.now()
    if (this.consecutiveFailures >= AnamnesisWriter.MAX_FAILURES) {
      this.openCircuit()
    }
  }

  private openCircuit(): void {
    if (this.circuitOpen) return
    this.circuitOpen = true
    log.warn(`AnamnesisWriter: circuit open after ${this.consecutiveFailures} failures, backing off ${AnamnesisWriter.BACKOFF_MS}ms`)
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null
      log.info('AnamnesisWriter: circuit retry timer fired')
      this.flush().catch((err) => log.error('AnamnesisWriter flush error on retry', err))
    }, AnamnesisWriter.BACKOFF_MS)
  }
}
