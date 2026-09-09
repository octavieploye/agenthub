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
import type { CreateTaskInput } from '../../shared/types/task.types'
import type { CreateProjectInput } from '../../shared/types/project.types'

const LOG_PREFIX = '[mcp-bridge-handler]'

// ─── Public dep surface ───────────────────────────────────────────────────────

export interface BridgeDeps {
  db: Database.Database
  scheduler: {
    start(input: unknown): unknown
    startSingleTask(input: unknown): unknown
    approveTaskDispatch(runId: string, taskId: string, approved: boolean): void
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
    this.server = net.createServer((socket) => {
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

  private handleMessage(socket: net.Socket, raw: unknown): void {
    const req = raw as BridgeRequest

    if (!req || typeof req.id !== 'string') {
      // Unparseable — cannot even echo an id; drop silently
      return
    }

    if (req.token !== this.token) {
      this.send(socket, { id: req.id, error: 'unauthorized' })
      return
    }

    let result: unknown
    try {
      result = this.dispatch(req.method, req.params ?? {})
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.send(socket, { id: req.id, error: message })
      return
    }

    this.send(socket, { id: req.id, result })
  }

  private send(socket: net.Socket, resp: BridgeResponse): void {
    try {
      socket.write(JSON.stringify(resp) + '\n')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(LOG_PREFIX, 'failed to write response:', message)
    }
  }

  // ─── Method routing ─────────────────────────────────────────────────────────

  private dispatch(method: string, params: Record<string, unknown>): unknown {
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

      // ── Write: tasks ─────────────────────────────────────────────────────────
      case 'createTask': {
        const input = params as unknown as CreateTaskInput
        return insertTask(db, input)
      }

      case 'dispatchTask': {
        return scheduler.startSingleTask(params)
      }

      case 'dispatchSprint': {
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

      // ── Write: archive task ──────────────────────────────────────────────────
      case 'archiveTask': {
        const taskId = params['taskId'] as string
        updateTask(db, taskId, { status: 'archived' })
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

      default:
        throw new Error(`unknown method: ${method}`)
    }
  }
}
