import net from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import crypto from 'crypto'
import { unlink, access } from 'fs/promises'
import type Database from 'better-sqlite3'

import { createJsonLineParser } from './helpers/json-line-protocol'

// Queries — tasks
import {
  insertTask,
  updateTask,
  getTaskById,
  listTasksFiltered,
} from '../db/queries/tasks.queries'
import type { ListTasksFilter } from '../db/queries/tasks.queries'
import { getDependencyMap } from '../db/queries/task-dependencies.queries'

// Queries — repos
import { getAllRepos, getRepoById } from '../db/queries/repos.queries'

// Queries — orchestrator runs
import { getRun, getActiveRun } from '../db/queries/orchestrator.queries'

// Queries — projects
import { insertProject } from '../db/queries/projects.queries'

// Queries — settings, quota, safeguards
import {
  getSetting,
  isOrchestratorEnabled,
  getQuota,
  getSafeguards,
} from '../db/queries/settings.queries'
import {
  countUnsyncedBrainEntries,
  publishUnsyncedBrainEntries,
} from './helpers/brain-entries-publisher'
import type { CreateTaskInput } from '../../shared/types/task.types'
import type { CreateProjectInput } from '../../shared/types/project.types'
import { DEFAULT_SONNET_MODEL, DEFAULT_OPUS_MODEL, DEFAULT_HAIKU_MODEL } from '../../shared/constants/model-catalog'
import { loadAnamnesisSecret } from './secret-store'
import { resolveAnamnesisAuthHeaders } from './helpers/anamnesis-bearer'
import { DEFAULT_ANAMNESIS_URL } from '../../shared/constants/defaults'

const LOG_PREFIX = '[mcp-bridge-handler]'

// ─── Anamnesis calendar (agenthub → Anamnesis /calendar) ─────────────────────

const VALID_EVENT_TYPES = new Set([
  'follow-up',
  'deadline',
  'milestone',
  'campaign',
  'check-in',
  'meeting',
  'custom',
])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Resolve the Anamnesis base URL + shared auth headers for the /calendar routes. */
function anamnesisRequestHeaders(): { url: string; headers: Record<string, string> } {
  const url = process.env['ANAMNESIS_URL'] ?? DEFAULT_ANAMNESIS_URL
  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      'X-Optimaeus-Caller': 'hephaestus',
      ...resolveAnamnesisAuthHeaders(url, loadAnamnesisSecret()),
    },
  }
}

// ─── Public dep surface ───────────────────────────────────────────────────────

export interface BridgeDeps {
  db: Database.Database
  scheduler: {
    start(input: unknown): unknown
    startSingleTask(input: unknown): unknown
    approveTaskDispatch(runId: string, taskId: string, approved: boolean): void
    resume(runId: string): void
    cancel(runId: string): void
    extendRunWallClock(runId: string): boolean
  }
}

// ─── Wire message shapes ──────────────────────────────────────────────────────

interface BridgeRequest {
  id: string
  token: string
  method: string
  params: Record<string, unknown>
}

interface BridgeResponse {
  id: string
  result?: unknown
  error?: string
}

// ─── Param validation ─────────────────────────────────────────────────────────

/** dispatch_sprint: `taskIds` is optional, but when present it must be an array of non-empty strings. */
function assertValidTaskIds(taskIds: unknown): void {
  if (taskIds === undefined) return
  const valid = Array.isArray(taskIds) && taskIds.every(id => typeof id === 'string' && id.trim() !== '')
  if (!valid) {
    throw new Error('dispatch_sprint: taskIds must be an array of non-empty task id strings')
  }
}

/** S97: a dispatch is a confirmed action — the schema `required` is advisory, so enforce it here. */
function assertDispatchConfirmed(toolName: string, params: Record<string, unknown>): void {
  if (params['confirmed'] !== true) {
    throw new Error(`${toolName}: requires confirmed: true`)
  }
}

// ─── McpBridgeHandler ─────────────────────────────────────────────────────────

export class McpBridgeHandler {
  readonly socketPath: string
  readonly token: string

  private server: net.Server | null = null
  private deps: BridgeDeps

  constructor(deps: BridgeDeps) {
    this.deps = deps
    this.socketPath = join(tmpdir(), `agenthub-mcp-bridge-${process.pid}.sock`)
    this.token = crypto.randomBytes(16).toString('hex')
  }

  start(): void {
    // allowHalfOpen: true — the bridge client (unix-socket-client.js) half-closes
    // its socket immediately after writing the request. With the default
    // allowHalfOpen:false, the server auto-ends the socket the moment that FIN
    // arrives, which silently drops the response of any handler that awaits real
    // I/O (e.g. createCalendarEvent's `await fetch(...)`). Half-open keeps the
    // writable side alive until we respond in send() and end the socket there.
    this.server = net.createServer({ allowHalfOpen: true }, (socket) => {
      const parser = createJsonLineParser(
        (msg) => this.handleMessage(socket, msg),
        (raw, err) => {
          console.error(LOG_PREFIX, 'malformed JSON on socket:', raw, err.message)
        }
      )

      socket.on('data', parser)
      socket.on('error', (err) => {
        console.error(LOG_PREFIX, 'socket error:', err.message)
      })
    })

    this.server.on('error', (err) => {
      console.error(LOG_PREFIX, 'server error:', err.message)
    })

    // Remove stale socket file before binding
    access(this.socketPath)
      .then(() => unlink(this.socketPath))
      .catch(() => {})
      .finally(() => {
        this.server!.listen(this.socketPath, () => {
          console.log(LOG_PREFIX, `listening on ${this.socketPath}`)
        })
      })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
      console.log(LOG_PREFIX, 'server stopped')
    }
  }

  // ─── Request dispatch ───────────────────────────────────────────────────────

  private async handleMessage(socket: net.Socket, raw: unknown): Promise<void> {
    const req = raw as BridgeRequest

    if (!req || typeof req.id !== 'string') {
      // Unparseable — cannot even echo an id; drop silently
      return
    }

    if (req.token !== this.token) {
      this.send(socket, { id: req.id, error: 'unauthorized' })
      return
    }

    try {
      const result = await this.dispatch(req.method, req.params ?? {})
      this.send(socket, { id: req.id, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.send(socket, { id: req.id, error: message })
    }
  }

  private send(socket: net.Socket, resp: BridgeResponse): void {
    try {
      // One request per connection: write the response and half-close so the
      // client's 'end' event fires and it can parse the single JSON line.
      socket.end(JSON.stringify(resp) + '\n')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(LOG_PREFIX, 'failed to write response:', message)
    }
  }

  // ─── Method routing ─────────────────────────────────────────────────────────

  private async dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    const { db, scheduler } = this.deps

    switch (method) {
      // ── Read: tasks ──────────────────────────────────────────────────────────
      case 'listTasks': {
        const filter: ListTasksFilter = {
          repoId: params['repoId'] as string | undefined,
          sprintName: params['sprintName'] as string | undefined,
          status: params['status'] as ListTasksFilter['status'],
          category: params['category'] as ListTasksFilter['category'],
          limit: params['limit'] as number | undefined,
          includeArchived: Boolean(params['includeArchived']),
        }
        return listTasksFiltered(db, filter)
      }

      case 'getTaskById': {
        const taskId = params['taskId'] as string
        return getTaskById(db, taskId)
      }

      case 'getDependencyMap': {
        // Returns the full task → blockedBy dependency map as a plain object.
        // Uses the write-connection version (no filter needed for a full map).
        const map = getDependencyMap(db)
        const out: Record<string, string[]> = {}
        for (const [k, v] of map.entries()) {
          out[k] = v
        }
        return out
      }

      // ── Read: repos ──────────────────────────────────────────────────────────
      case 'listRepos': {
        return getAllRepos(db)
      }

      case 'getRepoById': {
        const repoId = params['repoId'] as string
        return getRepoById(db, repoId)
      }

      // ── Read: orchestrator runs ──────────────────────────────────────────────
      case 'getOrchestratorRun': {
        const runId = params['runId'] as string
        return getRun(db, runId)
      }

      case 'getActiveRun': {
        return getActiveRun(db)
      }

      // ── Read: settings ───────────────────────────────────────────────────────
      case 'getSetting': {
        const key = params['key'] as string
        return getSetting(db, key)
      }

      case 'isOrchestratorEnabled': {
        return isOrchestratorEnabled(db)
      }

      // ── Read: quota (stub — reads session cap from settings) ─────────────────
      case 'getQuota': {
        // getQuota returns { tokensThisSession, sessionCap }.
        // tokensThisSession is always 0 here (main process does not track live token counts
        // on this path — orchestrator accumulates them separately). Callers should treat
        // tokensThisSession as advisory in this context.
        return getQuota(db)
      }

      // ── Read: safeguards ─────────────────────────────────────────────────────
      case 'getSafeguards': {
        return getSafeguards(db)
      }

      // ── Read: model defaults (catalog-derived, used by recommend_model) ──────
      case 'getDefaultModels': {
        return { sonnet: DEFAULT_SONNET_MODEL, opus: DEFAULT_OPUS_MODEL, haiku: DEFAULT_HAIKU_MODEL }
      }

      // ── Write: tasks ─────────────────────────────────────────────────────────
      case 'createTask': {
        const input = params as unknown as CreateTaskInput
        // Guard: reject tasks bound to a repo that isn't registered. A phantom
        // repoId would otherwise create an orphaned task that the orchestrator
        // can never dispatch (brain bridge drops it when getRepoById returns null).
        const repo = getRepoById(db, input.repoId)
        if (!repo) {
          throw new Error(`create_task: repo not found for repoId "${input.repoId}". Register the repo before creating tasks.`)
        }
        return insertTask(db, input)
      }

      case 'dispatchTask': {
        assertDispatchConfirmed('dispatch_task', params)
        return scheduler.startSingleTask(params)
      }

      case 'dispatchSprint': {
        assertDispatchConfirmed('dispatch_sprint', params)
        assertValidTaskIds(params['taskIds'])
        return scheduler.start(params)
      }

      // ── Write: projects ──────────────────────────────────────────────────────
      case 'createProject': {
        const input = params as unknown as CreateProjectInput
        return insertProject(db, input)
      }

      // ── Write: approval ──────────────────────────────────────────────────────
      case 'approveTask': {
        const runId = params['runId'] as string
        const taskId = params['taskId'] as string
        const approved = Boolean(params['approved'])
        scheduler.approveTaskDispatch(runId, taskId, approved)
        return { ok: true }
      }

      // ── Write: run lifecycle (resume/cancel/extend) ──────────────────────────
      case 'resumeRun': {
        const runId = params['runId'] as string
        scheduler.resume(runId)
        return { ok: true }
      }

      case 'cancelRun': {
        const runId = params['runId'] as string
        scheduler.cancel(runId)
        return { ok: true }
      }

      case 'extendRun': {
        const runId = params['runId'] as string
        const extended = scheduler.extendRunWallClock(runId)
        return { ok: extended }
      }

      // ── Write: archive task ──────────────────────────────────────────────────
      case 'archiveTask': {
        const taskId = params['taskId'] as string
        updateTask(db, taskId, { status: 'archived', agentId: null })
        return { ok: true }
      }

      // ── Write: report files changed ──────────────────────────────────────────
      case 'reportFilesChanged': {
        // No dedicated updateTaskLogFilesChanged function exists in orchestrator.queries.ts.
        // We write directly to orchestrator_task_log, scoped to the most recent dev-phase log
        // for this task. The MCP kanban server uses this to record what files an agent changed.
        const taskId = params['taskId'] as string
        const files = params['files']
        const filesJson = JSON.stringify(Array.isArray(files) ? files : [])
        const now = new Date().toISOString()
        db.prepare(
          `UPDATE orchestrator_task_log
             SET files_changed_json = ?, updated_at = ?
           WHERE task_id = ? AND phase = 'dev'
             AND id = (
               SELECT id FROM orchestrator_task_log
               WHERE task_id = ? AND phase = 'dev'
               ORDER BY created_at DESC LIMIT 1
             )`
        ).run(filesJson, now, taskId, taskId)
        return { ok: true }
      }

      // ── Write: controlled Anamnesis backfill of brain entries ────────────────
      case 'backfillBrainEntries': {
        // dryRun defaults to TRUE — only an explicit `false` enqueues anything.
        // Each non-dry call publishes ONE batch (publisher clamps batchSize to 1..200).
        if (params['dryRun'] !== false) {
          return { dryRun: true, unsynced: countUnsyncedBrainEntries(db) }
        }
        // S96: a non-dry backfill is a confirmed action (like dispatch_task/dispatch_sprint).
        // Enforced here, not only in the MCP schema — the bridge socket is reachable locally.
        if (params['confirmed'] !== true) {
          throw new Error('backfill_brain_entries: non-dry runs require confirmed: true')
        }
        const batchSize = params['batchSize'] as number | undefined
        const enqueued = publishUnsyncedBrainEntries(db, { limit: batchSize })
        return { dryRun: false, enqueued, remaining: countUnsyncedBrainEntries(db) }
      }

      // ── Write: create an Anamnesis calendar event (agenthub → Anamnesis /calendar) ──
      case 'createCalendarEvent': {
        const title = params['title'] as string | undefined
        const date = params['date'] as string | undefined
        const eventType = params['event_type'] as string | undefined

        if (!title || typeof title !== 'string' || title.trim() === '') {
          throw new Error('create_calendar_event: title is required')
        }
        if (!date || typeof date !== 'string' || !DATE_RE.test(date)) {
          throw new Error('create_calendar_event: date is required (YYYY-MM-DD)')
        }
        if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
          throw new Error(`create_calendar_event: event_type must be one of ${[...VALID_EVENT_TYPES].join(', ')}`)
        }

        const payload: Record<string, unknown> = {
          title: title.trim(),
          date,
          event_type: eventType,
          project_id: params['project_id'] ?? undefined,
          end_date: params['end_date'] ?? undefined,
          source_view: params['source_view'] ?? 'agenthub',
          description: params['description'] ?? undefined,
          metadata: params['metadata'] ?? {},
        }

        const { url, headers } = anamnesisRequestHeaders()
        const res = await fetch(`${url}/calendar`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).slice(0, 300)
          throw new Error(`create_calendar_event: Anamnesis returned ${res.status}${detail ? `: ${detail}` : ''}`)
        }
        return (await res.json()) as unknown
      }

      // ── Write: update an Anamnesis calendar event (PATCH /calendar/{id}) ─────
      case 'updateCalendarEvent': {
        const eventId = params['event_id'] as string | undefined
        if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
          throw new Error('update_calendar_event: event_id is required (UUID)')
        }

        const eventType = params['event_type'] as string | undefined
        if (eventType !== undefined && !VALID_EVENT_TYPES.has(eventType)) {
          throw new Error(`update_calendar_event: event_type must be one of ${[...VALID_EVENT_TYPES].join(', ')}`)
        }
        for (const dateField of ['date', 'end_date'] as const) {
          const value = params[dateField]
          if (value !== undefined && (typeof value !== 'string' || !DATE_RE.test(value))) {
            throw new Error(`update_calendar_event: ${dateField} must be YYYY-MM-DD`)
          }
        }

        // Partial update — forward only the fields the caller actually provided.
        const payload: Record<string, unknown> = {}
        for (const key of ['title', 'date', 'end_date', 'event_type', 'source_view', 'source_id', 'description', 'color', 'metadata'] as const) {
          if (params[key] !== undefined) payload[key] = params[key]
        }

        const { url, headers } = anamnesisRequestHeaders()
        const res = await fetch(`${url}/calendar/${encodeURIComponent(eventId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).slice(0, 300)
          throw new Error(`update_calendar_event: Anamnesis returned ${res.status}${detail ? `: ${detail}` : ''}`)
        }
        return (await res.json()) as unknown
      }

      // ── Write: delete an Anamnesis calendar event (DELETE /calendar/{id}) ────
      case 'deleteCalendarEvent': {
        const eventId = params['event_id'] as string | undefined
        if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
          throw new Error('delete_calendar_event: event_id is required (UUID)')
        }

        const { url, headers } = anamnesisRequestHeaders()
        const res = await fetch(`${url}/calendar/${encodeURIComponent(eventId)}`, {
          method: 'DELETE',
          headers,
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).slice(0, 300)
          throw new Error(`delete_calendar_event: Anamnesis returned ${res.status}${detail ? `: ${detail}` : ''}`)
        }
        // DELETE answers 204 No Content — there is no body to parse.
        return { ok: true, id: eventId.trim() }
      }

      default:
        throw new Error(`unknown method: ${method}`)
    }
  }
}
