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

  constructor(db: Database.Database, deps: AnamnesisWriterDeps) {
    this.db = db
    this.anamnesisUrl = deps.anamnesisUrl
    this.fetch = deps.fetch ?? globalThis.fetch
    this.authSecret = deps.authSecret ?? process.env['AUTH_SECRET'] ?? ''
  }

  onEventInserted(): void {
    this.flush().catch((err) => log.error('AnamnesisWriter flush error', err))
  }

  async flush(): Promise<void> {
    const events = getUnsyncedEvents(this.db)
    for (const event of events) {
      await this.sendEvent(event)
    }
  }

  private async sendEvent(event: TaskEvent): Promise<void> {
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
        })
      })

      if (res.ok) {
        markEventSynced(this.db, event.id)
      } else {
        log.warn('AnamnesisWriter: non-OK response', { status: res.status, eventId: event.id })
      }
    } catch (err) {
      log.warn('AnamnesisWriter: Anamnesis unreachable, event queued', { eventId: event.id })
    }
  }
}
