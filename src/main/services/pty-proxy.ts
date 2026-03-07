import * as net from 'net'
import * as fs from 'fs'
import * as path from 'path'
import type * as pty from 'node-pty'

const MAX_CLIENTS = 3
const SOCKET_DIR = '/tmp/agenthub'

interface ProxyEntry {
  server: net.Server
  clients: Set<net.Socket>
  socketPath: string
  dataDisposable: pty.IDisposable
  exitDisposable: pty.IDisposable
}

interface PtyProxyDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
}

function ensureSocketDir(): void {
  if (!fs.existsSync(SOCKET_DIR)) {
    fs.mkdirSync(SOCKET_DIR, { mode: 0o700 })
  }
}

function getSocketPath(agentId: string): string {
  // Use first 8 chars of UUID to stay under macOS sun_path 104-byte limit
  const shortId = agentId.slice(0, 8)
  return path.join(SOCKET_DIR, `pty-${shortId}.sock`)
}

export class PtyProxy {
  private proxies = new Map<string, ProxyEntry>()
  private deps: PtyProxyDeps

  constructor(deps: PtyProxyDeps) {
    this.deps = deps
  }

  startProxy(agentId: string, ptyProcess: pty.IPty): string {
    // If proxy already running for this agent, return existing path
    const existing = this.proxies.get(agentId)
    if (existing) return existing.socketPath

    const socketPath = getSocketPath(agentId)

    // Ensure socket directory and clean stale socket from previous crash
    ensureSocketDir()
    try { fs.unlinkSync(socketPath) } catch { /* ignore if not exists */ }

    const clients = new Set<net.Socket>()

    const server = net.createServer((client) => {
      if (clients.size >= MAX_CLIENTS) {
        client.write('\r\n[AgentHub: max connections reached]\r\n')
        client.destroy()
        return
      }

      clients.add(client)
      this.deps.logInfo('PTY proxy client connected', { agentId, total: clients.size })

      client.on('data', (data) => {
        try {
          ptyProcess.write(data.toString())
        } catch {
          // PTY may have been killed
        }
      })

      client.on('close', () => {
        clients.delete(client)
        this.deps.logInfo('PTY proxy client disconnected', { agentId, remaining: clients.size })
      })

      client.on('error', () => {
        clients.delete(client)
      })
    })

    // Forward PTY output to all connected socket clients
    const dataDisposable = ptyProcess.onData((data: string) => {
      for (const client of clients) {
        try {
          client.write(data)
        } catch {
          clients.delete(client)
        }
      }
    })

    // Clean up when PTY exits — guard against double-cleanup with stopProxy
    const exitDisposable = ptyProcess.onExit(() => {
      if (!this.proxies.has(agentId)) return
      for (const client of [...clients]) {
        try {
          client.write('\r\n[AgentHub: agent exited]\r\n')
          client.destroy()
        } catch { /* ignore */ }
      }
      clients.clear()
      server.close()
      try { fs.unlinkSync(socketPath) } catch { /* ignore */ }
      this.proxies.delete(agentId)
      this.deps.logInfo('PTY proxy cleaned up on agent exit', { agentId })
    })

    server.listen(socketPath, () => {
      try { fs.chmodSync(socketPath, 0o600) } catch { /* ignore */ }
      this.deps.logInfo('PTY proxy started', { agentId, socketPath })
    })

    server.on('error', (err) => {
      this.deps.logWarning('PTY proxy server error', { agentId, error: (err as Error).message })
      // Clean up broken entry so isProxyActive doesn't lie
      this.proxies.delete(agentId)
      try { dataDisposable.dispose() } catch { /* ignore */ }
      try { exitDisposable.dispose() } catch { /* ignore */ }
    })

    this.proxies.set(agentId, { server, clients, socketPath, dataDisposable, exitDisposable })
    return socketPath
  }

  stopProxy(agentId: string): void {
    const entry = this.proxies.get(agentId)
    if (!entry) return

    for (const client of [...entry.clients]) {
      try {
        client.write('\r\n[AgentHub: proxy stopped]\r\n')
        client.destroy()
      } catch { /* ignore */ }
    }
    entry.clients.clear()
    entry.dataDisposable.dispose()
    entry.exitDisposable.dispose()
    entry.server.close()
    try { fs.unlinkSync(entry.socketPath) } catch { /* ignore */ }
    this.proxies.delete(agentId)
    this.deps.logInfo('PTY proxy stopped', { agentId })
  }

  isProxyActive(agentId: string): boolean {
    return this.proxies.has(agentId)
  }

  getSocketPath(agentId: string): string | null {
    return this.proxies.get(agentId)?.socketPath ?? null
  }

  stopAll(): void {
    for (const agentId of [...this.proxies.keys()]) {
      this.stopProxy(agentId)
    }
  }
}
