import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { getUnsyncedEvents, markEventSynced } from '../db/queries/task-events.queries'
import type { TaskEvent, TaskEventType } from '../../shared/types/task.types'
import type { IAnamnesisAdapter } from './adapters/anamnesis-adapter'

const ENDPOINT_MAP: Record<TaskEventType, string> = {
  CARD_TRANSITION: '/memory/episodic',
  CARD_COMPLETED: '/memory/procedural',
  CARD_INTERRUPTED: '/memory/procedural',
  SPRINT_INTAKE: '/memory/episodic',
  ORCHESTRATOR_TASK_STARTED: '/memory/episodic',
  ORCHESTRATOR_TASK_REVIEWED: '/memory/procedural',
  ORCHESTRATOR_TASK_SECURED: '/memory/procedural',
  ORCHESTRATOR_TASK_COMMITTED: '/memory/procedural',
  ORCHESTRATOR_SPRINT_COMPLETED: '/memory/episodic',
  DATE_TRIGGER_FIRED: '/memory/episodic',
}

interface AnamnesisWriterDeps {
  anamnesisUrl: string
  fetch?: typeof globalThis.fetch
  authSecret?: string
}

export class AnamnesisWriter implements IAnamnesisAdapter {
  private db: Database.Database
  private anamnesisUrl: string
  private fetch: typeof globalThis.fetch
  private authSecret: string
  private consecutiveFailures = 0
  private circuitOpen = false
  private lastFailureTime = 0
  private flushing = false
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null

  /** Cache: repo name → Anamnesis project UUID */
  private projectUuidCache = new Map<string, string>()

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

  /** Resolve repo name from a task event via: task_id → tasks.repo_id → repos.name */
  private resolveRepoName(taskId: string): string | null {
    const row = this.db.prepare(
      'SELECT r.name FROM repos r JOIN tasks t ON t.repo_id = r.id WHERE t.id = ?'
    ).get(taskId) as { name: string } | undefined
    return row?.name ?? null
  }

  /** Register or look up a project in Anamnesis, returning the UUID. Caches results. */
  private async resolveProjectUuid(repoName: string): Promise<string | null> {
    const cached = this.projectUuidCache.get(repoName)
    if (cached) return cached

    try {
      const res = await this.fetch(`${this.anamnesisUrl}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimaeus-Caller': 'hephaestus',
          ...(this.authSecret ? { Authorization: `Bearer ${this.authSecret}` } : {})
        },
        body: JSON.stringify({ name: repoName }),
        signal: AbortSignal.timeout(AnamnesisWriter.FETCH_TIMEOUT_MS)
      })
      if (res.ok) {
        const data = await res.json() as { id: string }
        this.projectUuidCache.set(repoName, data.id)
        log.info(`AnamnesisWriter: resolved project '${repoName}' → ${data.id}`)
        return data.id
      }
      log.warn(`AnamnesisWriter: failed to resolve project '${repoName}'`, { status: res.status })
      return null
    } catch {
      log.warn(`AnamnesisWriter: could not reach Anamnesis to resolve project '${repoName}'`)
      return null
    }
  }

  /** Transform a task event into the Anamnesis write model format. */
  private buildAnamnesisPayload(
    event: TaskEvent,
    rawPayload: Record<string, unknown>,
    projectId: string | null,
  ): Record<string, unknown> {
    const isEpisodic = event.eventType === 'CARD_TRANSITION'
      || event.eventType === 'SPRINT_INTAKE'
      || event.eventType === 'ORCHESTRATOR_TASK_STARTED'
      || event.eventType === 'ORCHESTRATOR_SPRINT_COMPLETED'

    if (isEpisodic) {
      return {
        source_entity: 'hephaestus',
        ...(projectId ? { project_id: projectId } : {}),
        content: {
          event_type: event.eventType.toLowerCase(),
          task_id: event.taskId,
          from_status: event.fromStatus,
          to_status: event.toStatus,
          agent_id: event.agentId,
          ...rawPayload
        },
        sovereignty_tier: 1
      }
    }

    // Orchestrator procedural events with specialized domains
    const ORCH_PROCEDURAL: Record<string, { pattern_type: string; domain: string }> = {
      ORCHESTRATOR_TASK_REVIEWED: { pattern_type: 'code_review', domain: 'quality_assurance' },
      ORCHESTRATOR_TASK_SECURED: { pattern_type: 'security_scan', domain: 'security_audit' },
      ORCHESTRATOR_TASK_COMMITTED: { pattern_type: 'orchestrator_execution', domain: 'sprint_execution' },
    }

    const orchMeta = ORCH_PROCEDURAL[event.eventType]

    return {
      source_entity: 'hephaestus',
      ...(projectId ? { project_id: projectId } : {}),
      pattern_type: orchMeta?.pattern_type ?? 'build_sequence',
      domain: orchMeta?.domain ?? (event.eventType === 'CARD_COMPLETED' ? 'task_completion' : 'task_interruption'),
      content: {
        event_type: event.eventType.toLowerCase(),
        task_id: event.taskId,
        from_status: event.fromStatus,
        to_status: event.toStatus,
        agent_id: event.agentId,
        ...rawPayload
      },
      confirmed_at: event.createdAt
    }
  }

  private async sendEvent(event: TaskEvent): Promise<boolean> {
    const path = ENDPOINT_MAP[event.eventType]
    const url = `${this.anamnesisUrl}${path}`
    let rawPayload: Record<string, unknown>
    try {
      rawPayload = JSON.parse(event.payloadJson) as Record<string, unknown>
    } catch (parseErr) {
      log.warn('AnamnesisWriter: corrupted payloadJson, skipping event', { eventId: event.id, err: String(parseErr) })
      this.recordFailure()
      return false
    }

    // Resolve project UUID from task → repo → Anamnesis project registry
    let projectId: string | null = null
    const repoName = this.resolveRepoName(event.taskId)
    if (repoName) {
      projectId = await this.resolveProjectUuid(repoName)
    }

    const body = this.buildAnamnesisPayload(event, rawPayload, projectId)

    try {
      const res = await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimaeus-Caller': 'hephaestus',
          ...(this.authSecret ? { Authorization: `Bearer ${this.authSecret}` } : {})
        },
        body: JSON.stringify(body),
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
