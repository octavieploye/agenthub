import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type { McpIpcRequest, McpIpcResponse } from '../../shared/types/mcp-server.types'
import type { McpIpcFrame, McpIpcResponseFrame } from '../mcp-server/ipc/ipc-protocol'
import { getTaskById, insertTask, updateTask } from '../db/queries/tasks.queries'
import type { CreateTaskInput, UpdateTaskInput } from '../../shared/types/task.types'
import type { OrchestratorStartInput, OrchestratorStatusResponse } from '../../shared/types/orchestrator.types'
import type { HealthAnomaly } from '../../shared/types/health.types'

const MAX_FRAME_BYTES = 1024 * 1024

type OrchestratorRunLike = {
  id: string
  status: string
  sprintName: string
}

export interface McpManagerDeps {
  db: Database.Database
  orchestrator: {
    startSingleTask: (input: OrchestratorStartInput) => OrchestratorRunLike
    getStatus?: () => OrchestratorStatusResponse
  }
  healthMonitor: {
    getSnapshot: (agentId: string) => { anomalies: HealthAnomaly[] } | null
  }
  emitToRenderer: (channel: string, data: unknown) => void
  listAgents: () => Array<{ id: string }>
  spawnAgent: (...args: never[]) => unknown
}

/**
 * Owns the main-process side of the AgentHub MCP server connection.
 * The child process is read-only; all mutations cross this JSON-line socket.
 */
export class McpServerManager {
  private child: ChildProcess | null = null
  private socketServer: net.Server | null = null
  private readonly socketPath = join(tmpdir(), `agenthub-mcp-${process.pid}.sock`)
  private readonly socketToken = randomUUID()
  private readonly connections = new Set<net.Socket>()
  private cleanupHooksInstalled = false

  start(db: Database.Database, deps: McpManagerDeps): void {
    if (this.socketServer) return

    this.unlinkSocket()
    const server = net.createServer((socket) => this.handleConnection(socket, db, deps))
    server.on('error', () => {
      // The caller owns service observability. Keeping this listener prevents an
      // unexpected socket error from terminating the Electron main process.
    })
    server.listen(this.socketPath)
    this.socketServer = server
    this.installCleanupHooks()

    const child = spawn(process.execPath, [this.getServerScriptPath()], {
      cwd: process.cwd(),
      env: {
        AGENTHUB_DB_PATH: this.getDatabasePath(db),
        AGENTHUB_SOCKET_PATH: this.socketPath,
        AGENTHUB_SOCKET_TOKEN: this.socketToken,
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    this.child = child
    child.once('exit', () => {
      if (this.child !== child) return
      this.child = null
      this.stop()
    })
    child.once('error', () => {
      if (this.child !== child) return
      this.child = null
      this.stop()
    })
  }

  stop(): void {
    const child = this.child
    this.child = null
    if (child && !child.killed) child.kill('SIGTERM')

    for (const connection of this.connections) connection.destroy()
    this.connections.clear()

    this.socketServer?.close()
    this.socketServer = null
    this.unlinkSocket()
    this.removeCleanupHooks()
  }

  getSocketPath(): string {
    return this.socketPath
  }

  getServerScriptPath(): string {
    return join(process.cwd(), 'src', 'main', 'mcp-server', 'server.ts')
  }

  private handleConnection(socket: net.Socket, db: Database.Database, deps: McpManagerDeps): void {
    this.connections.add(socket)
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (Buffer.byteLength(buffer, 'utf8') > MAX_FRAME_BYTES) {
        socket.destroy()
        return
      }
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) void this.handleLine(socket, line, db, deps)
      }
    })
    socket.once('close', () => this.connections.delete(socket))
    socket.once('error', () => this.connections.delete(socket))
  }

  private async handleLine(socket: net.Socket, line: string, db: Database.Database, deps: McpManagerDeps): Promise<void> {
    let correlationId = ''
    let response: McpIpcResponse
    try {
      const frame = JSON.parse(line) as Partial<McpIpcFrame>
      if (
        typeof frame.correlationId !== 'string' ||
        frame.token !== this.socketToken ||
        !frame.request
      ) {
        throw new Error('Invalid MCP IPC frame')
      }
      correlationId = frame.correlationId
      response = { type: 'success', data: this.routeRequest(frame.request, db, deps) }
    } catch (error) {
      response = {
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
      }
    }

    const frame: McpIpcResponseFrame = { correlationId, response }
    if (!socket.destroyed && socket.writable) socket.write(`${JSON.stringify(frame)}\n`)
  }

  private routeRequest(request: McpIpcRequest, db: Database.Database, deps: McpManagerDeps): unknown {
    switch (request.type) {
      case 'create_task': {
        const task = insertTask(db, request.payload as CreateTaskInput)
        deps.emitToRenderer(IPC_EVENTS.TASKS.UPDATED, task)
        return task
      }
      case 'update_task': {
        updateTask(db, request.payload.taskId, request.payload.updates as UpdateTaskInput)
        const task = getTaskById(db, request.payload.taskId)
        if (!task) throw new Error(`Task not found: ${request.payload.taskId}`)
        deps.emitToRenderer(IPC_EVENTS.TASKS.UPDATED, task)
        return task
      }
      case 'dispatch_task': {
        const task = getTaskById(db, request.payload.taskId)
        if (!task) throw new Error(`Task not found: ${request.payload.taskId}`)
        const run = deps.orchestrator.startSingleTask({
          repoId: task.repoId,
          sprintName: task.sprintName ?? `pipeline-${task.id.slice(0, 8)}`,
          singleTaskId: request.payload.taskId,
          telegramNotify: request.payload.telegramNotify,
          confirmed: request.payload.confirmed,
          triggerSource: 'single-task'
        })
        deps.emitToRenderer(IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE, {
          id: run.id,
          runId: run.id,
          status: run.status,
          sprintName: run.sprintName
        })
        return { id: run.id }
      }
      case 'get_active_agents':
        return deps.listAgents()
      case 'get_orchestrator_status':
        return deps.orchestrator.getStatus?.() ?? null
      case 'get_health_anomalies': {
        const agentIds = request.payload.agentId
          ? [request.payload.agentId]
          : deps.listAgents().map((agent) => agent.id)
        return agentIds.flatMap((agentId) => deps.healthMonitor.getSnapshot(agentId)?.anomalies ?? [])
      }
    }
  }

  private getDatabasePath(db: Database.Database): string {
    const name = (db as unknown as { name?: string }).name
    return name && name !== ':memory:' ? name : join(process.cwd(), 'agenthub.db')
  }

  private unlinkSocket(): void {
    try {
      fs.unlinkSync(this.socketPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  private installCleanupHooks(): void {
    if (this.cleanupHooksInstalled) return
    process.once('exit', this.cleanupOnExit)
    process.once('SIGTERM', this.cleanupOnSigterm)
    this.cleanupHooksInstalled = true
  }

  private removeCleanupHooks(): void {
    if (!this.cleanupHooksInstalled) return
    process.removeListener('exit', this.cleanupOnExit)
    process.removeListener('SIGTERM', this.cleanupOnSigterm)
    this.cleanupHooksInstalled = false
  }

  private cleanupOnExit = (): void => this.unlinkSocket()

  private cleanupOnSigterm = (): void => {
    this.stop()
    process.kill(process.pid, 'SIGTERM')
  }
}
