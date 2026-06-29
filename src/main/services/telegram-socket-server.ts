import * as net from 'net'
import * as fs from 'fs'
import type { TelegramNotificationPayload } from '../../shared/types/telegram.types'

export interface TelegramSocketServerDeps {
  notify: (payload: TelegramNotificationPayload) => void
  logInfo: (msg: string, meta?: Record<string, unknown>) => void
  logError: (msg: string, meta?: Record<string, unknown>) => void
}

const VALID_FORMATS = ['status', 'question', 'error'] as const

export class TelegramSocketServer {
  private server: net.Server | null = null
  private sockPath: string | null = null
  private readonly deps: TelegramSocketServerDeps

  constructor(deps: TelegramSocketServerDeps) {
    this.deps = deps
  }

  start(sockPath: string): Promise<void> {
    if (this.server) return Promise.resolve()
    // Clean up stale socket file from prior crash
    try { fs.unlinkSync(sockPath) } catch {}

    this.sockPath = sockPath
    this.server = net.createServer((conn) => {
      let buf = ''
      conn.on('data', (chunk) => { buf += chunk.toString() })
      conn.on('end', () => {
        try {
          const data = JSON.parse(buf)
          const result = this.handleMessage(data)
          conn.end(JSON.stringify(result))
        } catch {
          conn.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
        }
      })
      conn.on('error', (err) => {
        this.deps.logError('telegram socket connection error', { error: String(err) })
      })
    })

    this.server.on('error', (err) => {
      this.deps.logError('telegram socket server error', { error: String(err) })
    })

    return new Promise<void>((resolve) => {
      this.server!.listen(sockPath, () => {
        this.deps.logInfo('telegram socket server listening', { sockPath })
        resolve()
      })
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    if (this.sockPath) {
      try { fs.unlinkSync(this.sockPath) } catch {}
      this.sockPath = null
    }
  }

  getSocketPath(): string | null {
    return this.sockPath
  }

  private handleMessage(data: unknown): { ok: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Expected JSON object' }
    }
    const msg = data as Record<string, unknown>

    if (!msg.message || typeof msg.message !== 'string') {
      return { ok: false, error: 'Missing required field: message' }
    }
    if (!msg.agentId || typeof msg.agentId !== 'string') {
      return { ok: false, error: 'Missing required field: agentId' }
    }
    if (!msg.agentName || typeof msg.agentName !== 'string') {
      return { ok: false, error: 'Missing required field: agentName' }
    }

    const format = (typeof msg.format === 'string' && VALID_FORMATS.includes(msg.format as typeof VALID_FORMATS[number]))
      ? msg.format as 'status' | 'question' | 'error'
      : 'status'

    const payload: TelegramNotificationPayload = {
      type: 'agent_message',
      agentId: msg.agentId as string,
      agentName: msg.agentName as string,
      repo: (msg.repo as string) || '',
      summary: '',
      message: msg.message as string,
      format,
      timestamp: new Date().toISOString(),
    }

    this.deps.notify(payload)
    return { ok: true }
  }
}
