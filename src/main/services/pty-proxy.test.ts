import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as net from 'net'
import * as fs from 'fs'
import { PtyProxy } from './pty-proxy'

function createMockPty() {
  const dataCallbacks: ((data: string) => void)[] = []
  const exitCallbacks: ((exitInfo: { exitCode: number }) => void)[] = []

  return {
    pid: 12345,
    cols: 120,
    rows: 30,
    process: 'zsh',
    handleFlowControl: false,
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    kill: vi.fn(),
    clear: vi.fn(),
    onData: vi.fn((cb: (data: string) => void) => {
      dataCallbacks.push(cb)
      return { dispose: vi.fn(() => { const idx = dataCallbacks.indexOf(cb); if (idx >= 0) dataCallbacks.splice(idx, 1) }) }
    }),
    onExit: vi.fn((cb: (exitInfo: { exitCode: number }) => void) => {
      exitCallbacks.push(cb)
      return { dispose: vi.fn(() => { const idx = exitCallbacks.indexOf(cb); if (idx >= 0) exitCallbacks.splice(idx, 1) }) }
    }),
    _emitData(data: string) { dataCallbacks.forEach(cb => cb(data)) },
    _emitExit(exitCode = 0) { exitCallbacks.forEach(cb => cb({ exitCode })) }
  }
}

function createProxy() {
  return new PtyProxy({
    logInfo: vi.fn(),
    logWarning: vi.fn()
  })
}

function waitForServer(socketPath: string, retries = 10): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempt = 0
    const tryConnect = (): void => {
      if (!fs.existsSync(socketPath)) {
        if (++attempt > retries) return reject(new Error('Socket never appeared'))
        setTimeout(tryConnect, 50)
        return
      }
      resolve()
    }
    tryConnect()
  })
}

describe('PtyProxy', () => {
  let proxy: PtyProxy

  beforeEach(() => {
    vi.clearAllMocks()
    proxy = createProxy()
  })

  afterEach(() => {
    proxy.stopAll()
  })

  describe('startProxy', () => {
    it('returns a socket path containing a short agent id', () => {
      const pty = createMockPty()
      const path = proxy.startProxy('agent-1', pty as never)
      expect(path).toContain('pty-agent-1.sock')
    })

    it('subscribes to PTY onData and onExit', () => {
      const pty = createMockPty()
      proxy.startProxy('agent-1', pty as never)
      expect(pty.onData).toHaveBeenCalledOnce()
      expect(pty.onExit).toHaveBeenCalledOnce()
    })

    it('returns same path on duplicate start', () => {
      const pty = createMockPty()
      const path1 = proxy.startProxy('agent-1', pty as never)
      const path2 = proxy.startProxy('agent-1', pty as never)
      expect(path1).toBe(path2)
      expect(pty.onData).toHaveBeenCalledOnce()
    })

    it('creates the socket file on disk', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)
      expect(fs.existsSync(socketPath)).toBe(true)
    })

    it('sets socket permissions to owner-only (0600)', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)
      // chmodSync runs in the listen callback — give it a tick
      await new Promise(resolve => setTimeout(resolve, 50))
      const stat = fs.statSync(socketPath)
      // eslint-disable-next-line no-bitwise
      const mode = stat.mode & 0o777
      expect(mode).toBe(0o600)
    })
  })

  describe('stopProxy', () => {
    it('removes proxy and cleans up socket file', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)

      proxy.stopProxy('agent-1')
      expect(proxy.isProxyActive('agent-1')).toBe(false)
      expect(fs.existsSync(socketPath)).toBe(false)
    })

    it('does nothing for unknown agent', () => {
      expect(() => proxy.stopProxy('unknown')).not.toThrow()
    })
  })

  describe('isProxyActive', () => {
    it('returns false for unknown agent', () => {
      expect(proxy.isProxyActive('unknown')).toBe(false)
    })

    it('returns true after start', () => {
      const pty = createMockPty()
      proxy.startProxy('agent-1', pty as never)
      expect(proxy.isProxyActive('agent-1')).toBe(true)
    })

    it('returns false after stop', () => {
      const pty = createMockPty()
      proxy.startProxy('agent-1', pty as never)
      proxy.stopProxy('agent-1')
      expect(proxy.isProxyActive('agent-1')).toBe(false)
    })
  })

  describe('getSocketPath', () => {
    it('returns null for unknown agent', () => {
      expect(proxy.getSocketPath('unknown')).toBeNull()
    })

    it('returns path for active proxy', () => {
      const pty = createMockPty()
      proxy.startProxy('agent-1', pty as never)
      expect(proxy.getSocketPath('agent-1')).toContain('pty-agent-1.sock')
    })
  })

  describe('stopAll', () => {
    it('stops all active proxies', () => {
      const pty1 = createMockPty()
      const pty2 = createMockPty()
      proxy.startProxy('agent-1', pty1 as never)
      proxy.startProxy('agent-2', pty2 as never)

      proxy.stopAll()

      expect(proxy.isProxyActive('agent-1')).toBe(false)
      expect(proxy.isProxyActive('agent-2')).toBe(false)
    })

    it('handles empty proxy list', () => {
      expect(() => proxy.stopAll()).not.toThrow()
    })
  })

  describe('PTY exit cleanup', () => {
    it('removes proxy on PTY exit', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)

      pty._emitExit(0)
      expect(proxy.isProxyActive('agent-1')).toBe(false)
      expect(fs.existsSync(socketPath)).toBe(false)
    })

    it('does not double-cleanup if stopProxy ran first', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)

      proxy.stopProxy('agent-1')
      // PTY exit fires after stopProxy already cleaned up
      expect(() => pty._emitExit(0)).not.toThrow()
      expect(proxy.isProxyActive('agent-1')).toBe(false)
    })
  })

  describe('client data forwarding', () => {
    it('forwards client data to PTY write', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)

      const client = net.createConnection(socketPath)
      await new Promise<void>((resolve, reject) => {
        client.on('connect', resolve)
        client.on('error', reject)
      })

      client.write('hello')
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(pty.write).toHaveBeenCalledWith('hello')
      client.destroy()
    })

    it('forwards PTY data to connected clients', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)

      const client = net.createConnection(socketPath)
      await new Promise<void>((resolve, reject) => {
        client.on('connect', resolve)
        client.on('error', reject)
      })

      const received: string[] = []
      client.on('data', (data) => received.push(data.toString()))

      pty._emitData('output from pty')
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(received).toContain('output from pty')
      client.destroy()
    })

    it('rejects connections beyond MAX_CLIENTS', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)

      // Connect 3 clients (MAX_CLIENTS)
      const clients: net.Socket[] = []
      for (let i = 0; i < 3; i++) {
        const c = net.createConnection(socketPath)
        await new Promise<void>((resolve, reject) => {
          c.on('connect', resolve)
          c.on('error', reject)
        })
        clients.push(c)
      }

      // 4th client should get rejected with a message
      const rejected = net.createConnection(socketPath)
      const rejectedData: string[] = []
      rejected.on('data', (data) => rejectedData.push(data.toString()))

      await new Promise<void>((resolve) => {
        rejected.on('close', resolve)
        rejected.on('error', resolve as () => void)
      })

      expect(rejectedData.join('')).toContain('max connections reached')

      for (const c of clients) c.destroy()
    })

    it('sends farewell message when PTY exits', async () => {
      const pty = createMockPty()
      const socketPath = proxy.startProxy('agent-1', pty as never)
      await waitForServer(socketPath)

      const client = net.createConnection(socketPath)
      await new Promise<void>((resolve, reject) => {
        client.on('connect', resolve)
        client.on('error', reject)
      })

      const received: string[] = []
      client.on('data', (data) => received.push(data.toString()))

      pty._emitExit(0)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(received.join('')).toContain('agent exited')
      client.destroy()
    })
  })
})
