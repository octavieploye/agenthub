import { basename, isAbsolute } from 'path'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { getUnsyncedEvents, markEventSynced } from '../db/queries/task-events.queries'
import { insertActivityEvent } from '../db/queries/activity.queries'
import type { TaskEvent, TaskEventType } from '../../shared/types/task.types'
import type { IAnamnesisAdapter } from './adapters/anamnesis-adapter'
import { loadAnamnesisSecret } from './secret-store'
import { resolveAnamnesisAuthHeaders } from './helpers/anamnesis-bearer'
import { redactCompletionPayload, resolveRedactionContext } from './helpers/task-completion-events'
import { mapTaskCategoryToDomainCategory } from './helpers/anamnesis-domain-mapper'
import {
  DEFAULT_DOMAIN_CATEGORY,
  isAnamnesisDomainCategory,
  type AnamnesisDomainCategory
} from '../../shared/constants/anamnesis-domains'

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
  BRAIN_ENTRY_PUBLISHED: '/memory/episodic',
}

/** Universal status vocabulary: the state a completed task sets on its project domain. */
const PROJECT_STATUS_DONE = 'done'

/** S93: the only keys a BRAIN_ENTRY_PUBLISHED payload may carry to Anamnesis. */
const BRAIN_ENTRY_PAYLOAD_KEYS = [
  'entry_id',
  'repo_id',
  'repo_name',
  'type',
  'subject',
  'status',
  'computed_status',
  'artifact_path',
  'artifact_path_scope',
  'created_at',
  'domain_category'
] as const

/** Why a project-status PUT did not land: an HTTP rejection or a transport error. */
interface ProjectStatusFailure {
  httpStatus?: number
  error?: string
}

/**
 * S103: strip any URL from a transport error message before it is persisted. Node fetch
 * embeds the full URL — userinfo included — in some TypeError messages, and that URL is
 * configurable, so it must never land in the activity log.
 */
function redactUrls(message: string): string {
  return message.replace(/\bhttps?:\/\/\S+/g, '[redacted-url]')
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
  private authHeaders: Record<string, string>
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
    this.authHeaders = resolveAnamnesisAuthHeaders(this.anamnesisUrl, deps.authSecret ?? loadAnamnesisSecret())
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

  /** Resolve the shared domain category from the event's task category (default `code`). */
  private resolveDomainCategory(taskId: string): AnamnesisDomainCategory {
    const row = this.db.prepare('SELECT category FROM tasks WHERE id = ?').get(taskId) as
      | { category: string | null }
      | undefined
    return mapTaskCategoryToDomainCategory(row?.category)
  }

  /** Task events resolve the repo via their task; brain entry events carry `repo_name` in the payload. */
  private resolveEventRepoName(event: TaskEvent, rawPayload: Record<string, unknown>): string | null {
    if (event.taskId) return this.resolveRepoName(event.taskId)
    return typeof rawPayload['repo_name'] === 'string' ? rawPayload['repo_name'] : null
  }

  /** Task events map their task category; brain entry events carry an already-mapped `domain_category`. */
  private resolveEventDomainCategory(
    event: TaskEvent,
    rawPayload: Record<string, unknown>
  ): AnamnesisDomainCategory {
    if (event.taskId) return this.resolveDomainCategory(event.taskId)
    const category = rawPayload['domain_category']
    return isAnamnesisDomainCategory(category) ? category : DEFAULT_DOMAIN_CATEGORY
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
          ...this.authHeaders
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

  /**
   * S93: BRAIN_ENTRY_PUBLISHED payloads are rebuilt from BRAIN_ENTRY_PAYLOAD_KEYS, including events
   * queued before the allowlist existed; an absolute `artifact_path` is reduced to its file name.
   */
  private allowlistBrainEntryPayload(rawPayload: Record<string, unknown>): Record<string, unknown> {
    const allowed: Record<string, unknown> = {}
    for (const key of BRAIN_ENTRY_PAYLOAD_KEYS) {
      if (key in rawPayload) allowed[key] = rawPayload[key]
    }
    const artifactPath = allowed['artifact_path']
    if (typeof artifactPath === 'string' && isAbsolute(artifactPath)) {
      allowed['artifact_path'] = basename(artifactPath)
      allowed['artifact_path_scope'] = 'basename'
    }
    return allowed
  }

  /**
   * S87: CARD_COMPLETED payloads are rebuilt from the allowlist with a redacted SBAR,
   * including events queued before the allowlist existed. S93: so are BRAIN_ENTRY_PUBLISHED
   * payloads. Other event types pass through.
   */
  private allowlistPayload(event: TaskEvent, rawPayload: Record<string, unknown>): Record<string, unknown> {
    if (event.eventType === 'BRAIN_ENTRY_PUBLISHED') return this.allowlistBrainEntryPayload(rawPayload)
    if (event.eventType !== 'CARD_COMPLETED') return rawPayload
    const ctx = (event.taskId ? resolveRedactionContext(this.db, event.taskId) : null) ?? {
      taskTitle: typeof rawPayload['taskTitle'] === 'string' ? rawPayload['taskTitle'] : '',
      sprintName: null,
      taskDescription: null,
      repoPath: null
    }
    return redactCompletionPayload(rawPayload, ctx)
  }

  /** Transform a task event into the Anamnesis write model format. */
  private buildAnamnesisPayload(
    event: TaskEvent,
    rawPayload: Record<string, unknown>,
    projectId: string | null,
    domainCategory: AnamnesisDomainCategory
  ): Record<string, unknown> {
    const isEpisodic = event.eventType === 'CARD_TRANSITION'
      || event.eventType === 'SPRINT_INTAKE'
      || event.eventType === 'ORCHESTRATOR_TASK_STARTED'
      || event.eventType === 'ORCHESTRATOR_SPRINT_COMPLETED'
      || event.eventType === 'BRAIN_ENTRY_PUBLISHED'

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
          ...rawPayload,
          // Anamnesis reads the work-event category from episodic content (writer.py)
          domain_category: domainCategory
        },
        domain_category: domainCategory,
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
      domain_category: domainCategory,
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

    // Resolve project UUID from task (or brain entry payload) → repo → Anamnesis project registry
    let projectId: string | null = null
    const repoName = this.resolveEventRepoName(event, rawPayload)
    if (repoName) {
      projectId = await this.resolveProjectUuid(repoName)
    }

    const domainCategory = this.resolveEventDomainCategory(event, rawPayload)
    const sentPayload = this.allowlistPayload(event, rawPayload)
    const body = this.buildAnamnesisPayload(event, sentPayload, projectId, domainCategory)

    try {
      const res = await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimaeus-Caller': 'hephaestus',
          ...this.authHeaders
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
        if (event.eventType === 'CARD_COMPLETED' && projectId) {
          const summary =
            typeof sentPayload['taskTitle'] === 'string' ? sentPayload['taskTitle'] : null
          await this.publishProjectStatus(event, projectId, domainCategory, summary)
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

  /**
   * Best-effort project-status upsert after a synced CARD_COMPLETED. A failure is logged and
   * recorded for reconciliation (S95): it never unsyncs the event nor counts toward the circuit breaker.
   */
  private async publishProjectStatus(
    event: TaskEvent,
    projectId: string,
    domainCategory: AnamnesisDomainCategory,
    summary: string | null
  ): Promise<void> {
    const url = `${this.anamnesisUrl}/projects/${projectId}/status/${domainCategory}`
    try {
      const res = await this.fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Optimaeus-Caller': 'hephaestus',
          ...this.authHeaders
        },
        body: JSON.stringify({ state: PROJECT_STATUS_DONE, summary }),
        signal: AbortSignal.timeout(AnamnesisWriter.FETCH_TIMEOUT_MS)
      })
      if (!res.ok) this.recordProjectStatusFailure(event, projectId, domainCategory, { httpStatus: res.status })
    } catch (err) {
      const error = err instanceof Error ? redactUrls(err.message) : redactUrls(String(err))
      this.recordProjectStatusFailure(event, projectId, domainCategory, { error })
    }
  }

  /** Log a failed project-status PUT and leave an activity_log record to reconcile from. */
  private recordProjectStatusFailure(
    event: TaskEvent,
    projectId: string,
    domainCategory: AnamnesisDomainCategory,
    failure: ProjectStatusFailure
  ): void {
    log.warn('AnamnesisWriter: project status PUT failed', { projectId, domainCategory, eventId: event.id, ...failure })
    insertActivityEvent(this.db, {
      eventType: 'anamnesis_status_unreconciled',
      entityType: 'task',
      entityId: event.taskId ?? projectId,
      repoId: this.resolveTaskRepoId(event.taskId) ?? undefined,
      details: { projectId, domainCategory, state: PROJECT_STATUS_DONE, eventId: event.id, ...failure }
    })
  }

  /** Repo id of a task, for the reconcile record. */
  private resolveTaskRepoId(taskId: string | null): string | null {
    if (!taskId) return null
    const row = this.db.prepare('SELECT repo_id FROM tasks WHERE id = ?').get(taskId) as
      | { repo_id: string | null }
      | undefined
    return row?.repo_id ?? null
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
