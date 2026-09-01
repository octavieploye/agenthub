import * as net from 'net'
import * as fs from 'fs'
import type {
  TelegramNotificationPayload,
  TelegramSocketState,
  TelegramSocketStatus,
} from '../../shared/types/telegram.types'

export interface TelegramSocketServerDeps {
  notify: (payload: TelegramNotificationPayload) => void
  queueFallback?: (payload: TelegramNotificationPayload) => void
  onMcpMessage?: (agentId: string) => void
  logInfo: (msg: string, meta?: Record<string, unknown>) => void
  logError: (msg: string, meta?: Record<string, unknown>) => void
  createServer?: (connectionListener: (socket: net.Socket) => void) => net.Server
  createConnection?: (path: string) => net.Socket
  probeTimeoutMs?: number
}

const VALID_FORMATS = ['status', 'question', 'error'] as const

export class TelegramSocketServer {
  private server: net.Server | null = null
  private sockPath: string | null = null
  private state: TelegramSocketState = 'stopped'
  private errorCode: string | null = null
  private startPromise: Promise<void> | null = null
  private rejectStart: ((reason: Error) => void) | null = null
  private ownsSocketPath = false
  private readonly deps: TelegramSocketServerDeps

  constructor(deps: TelegramSocketServerDeps) {
    this.deps = deps
  }

  start(sockPath: string): Promise<void> {
    if (this.state === 'listening' && this.server) return Promise.resolve()
    if (this.state === 'starting' && this.startPromise) return this.startPromise

    this.sockPath = sockPath
    this.state = 'starting'
    this.errorCode = null
    this.ownsSocketPath = false

    let resolveStart!: () => void
    let rejectStart!: (reason: Error) => void
    const startup = new Promise<void>((resolve, reject) => {
      resolveStart = resolve
      rejectStart = reject
    })
    this.startPromise = startup
    this.rejectStart = rejectStart

    void this.prepareSocketPath(sockPath).then(() => {
      if (this.startPromise !== startup || this.state !== 'starting') return

      const createServer = this.deps.createServer ?? net.createServer
      const server = createServer((conn) => {
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
          this.deps.logError('telegram socket connection error', {
            error: String(err),
            sockPath: this.sockPath,
            state: this.state,
          })
        })
      })
      this.server = server

      const handleServerError = (err: NodeJS.ErrnoException): void => {
        if (this.server !== server && this.startPromise !== startup) return

        if (this.startPromise === startup) {
          this.failStartup(err, sockPath, startup, rejectStart)
          return
        }

        const errorCode = err.code ?? 'UNKNOWN'
        this.state = 'error'
        this.errorCode = errorCode
        this.server = null
        if (server.listening) server.close()
        this.unlinkOwnedSocket()
        this.deps.logError('telegram socket server error', {
          error: String(err),
          errorCode,
          sockPath,
          state: this.state,
        })
      }

      server.on('error', handleServerError)

      try {
        server.listen(sockPath, () => {
          if (this.server !== server || this.state !== 'starting') return
          try {
            this.ownsSocketPath = true
            fs.chmodSync(sockPath, 0o600)
          } catch (err) {
            this.failStartup(err as NodeJS.ErrnoException, sockPath, startup, rejectStart)
            return
          }
          this.state = 'listening'
          this.errorCode = null
          this.startPromise = null
          this.rejectStart = null
          this.deps.logInfo('telegram socket server listening', { sockPath, state: this.state })
          resolveStart()
        })
      } catch (err) {
        handleServerError(err as NodeJS.ErrnoException)
      }
    }).catch((err: NodeJS.ErrnoException) => {
      this.failStartup(err, sockPath, startup, rejectStart)
    })

    return startup
  }

  stop(): void {
    const server = this.server
    const rejectStart = this.state === 'starting' ? this.rejectStart : null

    this.server = null
    this.startPromise = null
    this.rejectStart = null
    this.state = 'stopped'
    this.errorCode = null
    if (server) {
      server.close()
    }
    this.unlinkOwnedSocket()
    this.sockPath = null

    if (rejectStart) {
      rejectStart(Object.assign(new Error('Telegram socket startup stopped'), { code: 'ECANCELED' }))
    }
  }

  getSocketPath(): string | null {
    return this.sockPath
  }

  getStatus(): TelegramSocketStatus {
    return {
      socketPath: this.sockPath,
      state: this.state,
      errorCode: this.errorCode,
    }
  }

  private async prepareSocketPath(sockPath: string): Promise<void> {
    if (!fs.existsSync(sockPath)) return

    const initialStat = fs.lstatSync(sockPath)
    if (!initialStat.isSocket()) {
      throw Object.assign(
        new Error(`Telegram socket path exists and is not a socket: ${sockPath}`),
        { code: 'ENOTSOCK' },
      )
    }

    return new Promise((resolve, reject) => {
      const createConnection = this.deps.createConnection ?? net.createConnection
      const probe = createConnection(sockPath)
      let settled = false
      const timeout = setTimeout(() => {
        settle(() => reject(Object.assign(
          new Error(`Timed out probing Telegram socket path: ${sockPath}`),
          { code: 'ETIMEDOUT' },
        )))
      }, this.deps.probeTimeoutMs ?? 1000)
      const settle = (callback: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        probe.destroy()
        callback()
      }

      probe.once('connect', () => {
        settle(() => reject(Object.assign(
          new Error(`Telegram socket path is already in use: ${sockPath}`),
          { code: 'EADDRINUSE' },
        )))
      })
      probe.once('error', (err: NodeJS.ErrnoException) => {
        settle(() => {
          if (err.code !== 'ECONNREFUSED' && err.code !== 'ENOENT') {
            reject(err)
            return
          }
          try {
            const currentStat = fs.lstatSync(sockPath)
            if (!currentStat.isSocket()
              || currentStat.dev !== initialStat.dev
              || currentStat.ino !== initialStat.ino) {
              reject(Object.assign(
                new Error(`Telegram socket path changed while probing: ${sockPath}`),
                { code: 'ESTALE' },
              ))
              return
            }
            fs.unlinkSync(sockPath)
            resolve()
          } catch (unlinkError) {
            if ((unlinkError as NodeJS.ErrnoException).code === 'ENOENT') {
              resolve()
              return
            }
            reject(unlinkError)
          }
        })
      })
    })
  }

  private failStartup(
    err: NodeJS.ErrnoException,
    sockPath: string,
    startup: Promise<void>,
    rejectStart: (reason: Error) => void,
  ): void {
    if (this.startPromise !== startup) return

    const errorCode = err.code ?? 'UNKNOWN'
    const server = this.server
    this.server = null
    this.startPromise = null
    this.rejectStart = null
    this.state = 'error'
    this.errorCode = errorCode
    if (server?.listening) server.close()
    this.unlinkOwnedSocket()
    this.deps.logError('telegram socket server startup failed', {
      error: String(err),
      errorCode,
      sockPath,
      state: this.state,
    })
    rejectStart(err)
  }

  private unlinkOwnedSocket(): void {
    if (!this.ownsSocketPath || !this.sockPath) return
    try {
      fs.unlinkSync(this.sockPath)
    } catch (err) {
      const socketError = err as NodeJS.ErrnoException
      this.deps.logError('telegram socket cleanup failed', {
        error: String(socketError),
        errorCode: socketError.code ?? 'UNKNOWN',
        sockPath: this.sockPath,
        state: this.state,
      })
    }
    this.ownsSocketPath = false
  }

  private handleMessage(data: unknown): { ok: boolean; error?: string; queued?: boolean } {
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Expected JSON object' }
    }
    const msg = data as Record<string, unknown>

    // Health check ping
    if (msg.type === 'ping') {
      return { ok: true }
    }

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

    this.deps.onMcpMessage?.(msg.agentId as string)

    try {
      this.deps.notify(payload)
      return { ok: true }
    } catch (err) {
      if (this.deps.queueFallback) {
        this.deps.queueFallback(payload)
        return { ok: true, queued: true }
      }
      this.deps.logError('telegram socket notify failed, no queue fallback', { error: String(err) })
      return { ok: false, error: 'Delivery failed' }
    }
  }
}
