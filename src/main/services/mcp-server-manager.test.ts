import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as net from 'node:net'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { getTaskById } from '../db/queries/tasks.queries'
import { getProjectsByRepoId } from '../db/queries/project-repos.queries'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type { McpIpcRequest } from '../../shared/types/mcp-server.types'
import type { McpIpcResponseFrame } from '../mcp-server/ipc/ipc-protocol'
import { McpServerManager, type McpManagerDeps } from './mcp-server-manager'

const { mockSpawn, mockChild } = vi.hoisted(() => {
  const child = {
    once: vi.fn(),
    kill: vi.fn(),
    killed: false,
    pid: 42_001
  }
  child.kill.mockImplementation(() => {
    child.killed = true
    return true
  })

  return { mockSpawn: vi.fn(() => child), mockChild: child }
})

vi.mock('electron', () => ({
  app: { isPackaged: false }
}))
vi.mock('node:child_process', () => ({
  default: { spawn: mockSpawn },
  spawn: mockSpawn
}))
vi.mock('child_process', () => ({
  default: { spawn: mockSpawn },
  spawn: mockSpawn
}))

function waitForSocket(socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 1_000
    const poll = (): void => {
      if (fs.existsSync(socketPath)) {
        try {
          if ((fs.statSync(socketPath).mode & 0o777) === 0o600) {
            resolve()
            return
          }
        } catch {
          // The socket may disappear while the manager cleans up; keep polling.
        }
      }
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${socketPath}`))
        return
      }
      setTimeout(poll, 5)
    }
    poll()
  })
}

async function sendRequest(
  socketPath: string,
  token: string,
  request: McpIpcRequest
): Promise<McpIpcResponseFrame> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    let buffer = ''

    socket.once('connect', () => {
      socket.write(JSON.stringify({ correlationId: 'test-correlation-id', token, request }) + '\n')
    })
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      const line = buffer.split('\n')[0]
      if (!line) return
      try {
        resolve(JSON.parse(line) as McpIpcResponseFrame)
        socket.destroy()
      } catch (error) {
        reject(error)
      }
    })
    socket.once('error', reject)
  })
}

function getSocketToken(): string {
  const spawnOptions = mockSpawn.mock.calls.at(-1)?.[2] as
    | { env?: Record<string, string> }
    | undefined
  const token = spawnOptions?.env?.AGENTHUB_SOCKET_TOKEN
  if (!token) throw new Error('MCP child did not receive a socket token')
  return token
}

describe('McpServerManager', () => {
  let db: Database.Database
  let manager: McpServerManager
  let deps: McpManagerDeps

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, __dirname + '/../db/migrations')
    db.pragma('foreign_keys = ON')
    db.prepare(
      "INSERT INTO repos (id, name, path, created_at, last_used_at) VALUES ('repo-1', 'test', '/tmp/test', datetime('now'), datetime('now'))"
    ).run()

    deps = {
      db,
      orchestrator: { startSingleTask: vi.fn(() => ({ id: 'run-1' })) } as never,
      healthMonitor: { getSnapshot: vi.fn() } as never,
      emitToRenderer: vi.fn(),
      listAgents: vi.fn(() => []),
      spawnAgent: vi.fn()
    }
    manager = new McpServerManager()
    mockSpawn.mockClear()
    mockChild.kill.mockClear()
    mockChild.killed = false
  })

  afterEach(() => {
    manager.stop()
    db.close()
  })

  it('starts and stops the Unix socket server and MCP child', async () => {
    manager.start(db, deps)
    const socketPath = manager.getSocketPath()
    await waitForSocket(socketPath)

    expect(fs.existsSync(socketPath)).toBe(true)
    expect(fs.statSync(socketPath).mode & 0o777).toBe(0o600)
    expect(mockSpawn).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringContaining('mcp-server/server')],
      expect.objectContaining({
        env: expect.objectContaining({
          AGENTHUB_DB_PATH: expect.any(String),
          AGENTHUB_SOCKET_PATH: socketPath,
          AGENTHUB_SOCKET_TOKEN: expect.any(String)
        })
      })
    )

    manager.stop()
    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM')
    expect(fs.existsSync(socketPath)).toBe(false)
  })

  it('rejects connections above the unauthenticated connection limit', async () => {
    manager.start(db, deps)
    const socketPath = manager.getSocketPath()
    await waitForSocket(socketPath)

    const connections = await Promise.all(
      Array.from(
        { length: 8 },
        () =>
          new Promise<net.Socket>((resolve, reject) => {
            const socket = net.createConnection(socketPath)
            socket.once('connect', () => resolve(socket))
            socket.once('error', reject)
          })
      )
    )
    const overflow = net.createConnection(socketPath)
    await new Promise<void>((resolve, reject) => {
      overflow.once('close', resolve)
      overflow.once('error', reject)
    })

    for (const socket of connections) socket.destroy()
  })

  it('routes create_task to the database and emits the created task to renderers', async () => {
    manager.start(db, deps)
    await waitForSocket(manager.getSocketPath())
    const response = await sendRequest(manager.getSocketPath(), getSocketToken(), {
      type: 'create_task',
      payload: { repoId: 'repo-1', title: 'Created through MCP', description: 'socket write' }
    })

    expect(response).toMatchObject({
      correlationId: 'test-correlation-id',
      response: { type: 'success', data: expect.objectContaining({ title: 'Created through MCP' }) }
    })
    const taskId = (response.response as { type: 'success'; data: { id: string } }).data.id
    expect(getTaskById(db, taskId)).toEqual(
      expect.objectContaining({ title: 'Created through MCP' })
    )
    expect(deps.emitToRenderer).toHaveBeenCalledWith(
      IPC_EVENTS.TASKS.UPDATED,
      expect.objectContaining({ id: taskId, title: 'Created through MCP' })
    )
  })

  it('routes create_project: creates project and links to repo', async () => {
    manager.start(db, deps)
    await waitForSocket(manager.getSocketPath())
    const response = await sendRequest(manager.getSocketPath(), getSocketToken(), {
      type: 'create_project',
      payload: { repoId: 'repo-1', name: 'Voice Web Search', description: 'SearXNG adapter' }
    })

    expect(response.response).toMatchObject({
      type: 'success',
      data: { name: 'Voice Web Search', created: true }
    })
    const projects = getProjectsByRepoId(db, 'repo-1')
    expect(projects.some((p) => p.name === 'Voice Web Search')).toBe(true)
  })

  it('routes create_project: returns existing project when name already exists for repo', async () => {
    manager.start(db, deps)
    await waitForSocket(manager.getSocketPath())
    const first = await sendRequest(manager.getSocketPath(), getSocketToken(), {
      type: 'create_project',
      payload: { repoId: 'repo-1', name: 'Duplicate Project' }
    })
    const firstProjectId = (first.response as { type: 'success'; data: { projectId: string } }).data
      .projectId

    const second = await sendRequest(manager.getSocketPath(), getSocketToken(), {
      type: 'create_project',
      payload: { repoId: 'repo-1', name: 'Duplicate Project' }
    })

    expect(second.response).toMatchObject({
      type: 'success',
      data: { projectId: firstProjectId, name: 'Duplicate Project', created: false }
    })
  })

  it('routes create_project: FK constraint error propagates for unknown repoId', async () => {
    manager.start(db, deps)
    await waitForSocket(manager.getSocketPath())
    const response = await sendRequest(manager.getSocketPath(), getSocketToken(), {
      type: 'create_project',
      payload: { repoId: 'non-existent-repo', name: 'Bad Project' }
    })

    expect(response.response.type).toBe('error')
  })

  it('routes dispatch_task to the orchestrator and emits the run to renderers', async () => {
    db.prepare(
      "INSERT INTO tasks (id, repo_id, title, status, created_at, updated_at) VALUES ('task-1', 'repo-1', 'Dispatch through MCP', 'pending', datetime('now'), datetime('now'))"
    ).run()
    manager.start(db, deps)
    await waitForSocket(manager.getSocketPath())
    const response = await sendRequest(manager.getSocketPath(), getSocketToken(), {
      type: 'dispatch_task',
      payload: { taskId: 'task-1', telegramNotify: true, confirmed: true }
    })

    expect(deps.orchestrator.startSingleTask).toHaveBeenCalledWith({
      repoId: 'repo-1',
      sprintName: 'pipeline-task-1',
      singleTaskId: 'task-1',
      telegramNotify: true,
      confirmed: true,
      triggerSource: 'single-task'
    })
    expect(response.response).toEqual({ type: 'success', data: { id: 'run-1' } })
    expect(deps.emitToRenderer).toHaveBeenCalledWith(
      IPC_EVENTS.ORCHESTRATOR.STATUS_CHANGE,
      expect.objectContaining({ id: 'run-1' })
    )
  })
})
