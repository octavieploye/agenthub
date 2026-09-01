import * as net from 'net'
import { randomUUID } from 'crypto'
import type { McpIpcFrame, McpIpcRequest, McpIpcResponse, McpIpcResponseFrame } from './ipc-protocol'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 1_000

interface PendingRequest {
  resolve: (resp: McpIpcResponse) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * JSON-line socket client for communicating with the AgentHub main process.
 *
 * Protocol: each message is a single JSON object terminated by \n.
 * Requests include a correlationId; responses echo it so async callers can match.
 */
export class ParentIpc {
  private socket: net.Socket | null = null
  private pending = new Map<string, PendingRequest>()
  private buffer = ''
  private reconnectAttempts = 0

  constructor(private readonly socketPath: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const attempt = (): void => {
        const socket = new net.Socket()
        socket.setEncoding('utf8')

        socket.on('connect', () => {
          this.socket = socket
          this.reconnectAttempts = 0
          this.buffer = ''
          resolve()
        })

        socket.on('data', (chunk: string) => {
          this.buffer += chunk
          const lines = this.buffer.split('\n')
          this.buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const frame = JSON.parse(line) as McpIpcResponseFrame
              const pending = this.pending.get(frame.correlationId)
              if (pending) {
                clearTimeout(pending.timer)
                this.pending.delete(frame.correlationId)
                pending.resolve(frame.response)
              }
            } catch {
              // malformed JSON line — discard
            }
          }
        })

        socket.on('error', (err) => {
          if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++
            setTimeout(attempt, RECONNECT_DELAY_MS)
          } else {
            reject(err)
          }
        })

        socket.on('close', () => {
          this.socket = null
          for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer)
            pending.reject(new Error('IPC socket closed unexpectedly'))
            this.pending.delete(id)
          }
        })

        socket.connect(this.socketPath)
      }

      attempt()
    })
  }

  send(req: McpIpcRequest): Promise<McpIpcResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('ParentIpc: not connected to parent socket'))
        return
      }

      const correlationId = randomUUID()
      const frame: McpIpcFrame = { correlationId, request: req }

      const timer = setTimeout(() => {
        this.pending.delete(correlationId)
        reject(new Error(`ParentIpc: request timed out after ${REQUEST_TIMEOUT_MS}ms (type: ${req.type})`))
      }, REQUEST_TIMEOUT_MS)

      this.pending.set(correlationId, { resolve, reject, timer })
      this.socket.write(JSON.stringify(frame) + '\n')
    })
  }

  close(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('ParentIpc: connection closed'))
      this.pending.delete(id)
    }
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
  }
}
