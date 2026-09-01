import * as net from 'net'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { tmpdir } from 'os'
import type {
  McpIpcFrame,
  McpIpcRequest,
  McpIpcResponse,
  McpIpcResponseFrame
} from './ipc-protocol'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 1_000

interface PendingRequest {
  resolve: (response: McpIpcResponse) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** JSON-line client for the AgentHub parent process' Unix domain socket. */
export class ParentIpc {
  private socket: net.Socket | null = null
  private pending = new Map<string, PendingRequest>()
  private connectPromise: Promise<void> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private bufferBySocket = new WeakMap<net.Socket, string>()

  constructor(
    private readonly socketPath = join(tmpdir(), `agenthub-mcp-${process.ppid}.sock`),
    private readonly token = process.env['AGENTHUB_SOCKET_TOKEN']
  ) {}

  getSocketPath(): string {
    return this.socketPath
  }

  connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve()
    if (this.connectPromise) return this.connectPromise

    this.closed = false
    this.connectPromise = this.connectWithRetries().finally(() => {
      this.connectPromise = null
    })
    return this.connectPromise
  }

  send(request: McpIpcRequest): Promise<McpIpcResponse> {
    return new Promise((resolve, reject) => {
      const socket = this.socket
      if (!socket || socket.destroyed || !socket.writable) {
        reject(new Error('ParentIpc: not connected to parent socket'))
        return
      }

      const correlationId = randomUUID()
      if (!this.token) {
        reject(new Error('ParentIpc: AGENTHUB_SOCKET_TOKEN is not set'))
        return
      }
      const frame: McpIpcFrame = { correlationId, token: this.token, request }
      const timer = setTimeout(() => {
        this.pending.delete(correlationId)
        reject(
          new Error(
            `ParentIpc: request timed out after ${REQUEST_TIMEOUT_MS}ms (type: ${request.type})`
          )
        )
      }, REQUEST_TIMEOUT_MS)

      this.pending.set(correlationId, { resolve, reject, timer })
      try {
        socket.write(`${JSON.stringify(frame)}\n`)
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(correlationId)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  close(): void {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.rejectPending(new Error('ParentIpc: connection closed'))
    this.socket?.destroy()
    this.socket = null
  }

  private async connectWithRetries(): Promise<void> {
    let lastError: Error | undefined

    for (let reconnectAttempt = 0; reconnectAttempt <= MAX_RECONNECT_ATTEMPTS; reconnectAttempt++) {
      if (this.closed) throw new Error('ParentIpc: connection closed')
      if (reconnectAttempt > 0) await this.delay(RECONNECT_DELAY_MS)

      try {
        await this.openSocket()
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    throw lastError ?? new Error('ParentIpc: unable to connect to parent socket')
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath)
      let settled = false
      let connected = false
      this.bufferBySocket.set(socket, '')

      const fail = (error: Error): void => {
        if (settled) return
        settled = true
        if (this.socket === socket) {
          this.socket = null
          this.rejectPending(new Error('IPC socket closed unexpectedly'))
        }
        socket.destroy()
        reject(error)
      }

      socket.setEncoding('utf8')
      socket.once('connect', () => {
        if (this.closed) {
          fail(new Error('ParentIpc: connection closed'))
          return
        }
        connected = true
        settled = true
        this.socket = socket
        resolve()
      })

      socket.on('data', (chunk: string) => this.handleData(socket, chunk))
      socket.once('error', (error) => fail(error))
      socket.once('close', () => {
        if (connected && this.socket === socket) {
          this.socket = null
          this.rejectPending(new Error('IPC socket closed unexpectedly'))
          if (!this.closed) this.scheduleReconnect()
        } else if (!settled) {
          fail(new Error('ParentIpc: socket closed before connect'))
        }
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer || this.connectPromise) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect().catch(() => {})
    }, RECONNECT_DELAY_MS)
  }

  private handleData(socket: net.Socket, chunk: string): void {
    let buffer = (this.bufferBySocket.get(socket) ?? '') + chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    this.bufferBySocket.set(socket, buffer)

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const frame = JSON.parse(line) as Partial<McpIpcResponseFrame>
        if (typeof frame.correlationId !== 'string' || !frame.response) continue
        const pending = this.pending.get(frame.correlationId)
        if (!pending) continue
        clearTimeout(pending.timer)
        this.pending.delete(frame.correlationId)
        pending.resolve(frame.response)
      } catch {
        // Ignore malformed lines and continue processing subsequent frames.
      }
    }
  }

  private rejectPending(error: Error): void {
    for (const [correlationId, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
      this.pending.delete(correlationId)
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
  }
}
