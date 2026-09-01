import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelegramSocketServer } from './telegram-socket-server'
import * as net from 'net'
import * as fs from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { EventEmitter } from 'events'

function sendToSocket(sockPath: string, data: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(sockPath, () => {
      client.end(JSON.stringify(data))
    })
    let buf = ''
    client.on('data', (chunk) => { buf += chunk.toString() })
    client.on('end', () => {
      try { resolve(JSON.parse(buf)) } catch (e) { reject(e) }
    })
    client.on('error', reject)
  })
}

describe('TelegramSocketServer', () => {
  let server: TelegramSocketServer
  let sockPath: string
  const mockNotify = vi.fn()

  beforeEach(() => {
    mockNotify.mockClear()
    sockPath = join(tmpdir(), `test-telegram-${Date.now()}.sock`)
    server = new TelegramSocketServer({
      notify: mockNotify,
      logInfo: vi.fn(),
      logError: vi.fn(),
    })
  })

  afterEach(() => {
    server.stop()
    try { fs.unlinkSync(sockPath) } catch {}
  })

  it('accepts a valid agent_message and calls notify', async () => {
    await server.start(sockPath)
    const res = await sendToSocket(sockPath, {
      agentId: 'agent-1',
      agentName: 'test-agent',
      repo: 'my-repo',
      message: 'Task completed successfully',
      format: 'status',
    })
    expect(res).toEqual({ ok: true })
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'agent_message',
      agentId: 'agent-1',
      message: 'Task completed successfully',
      format: 'status',
    }))
  })

  it('rejects payload with missing message', async () => {
    await server.start(sockPath)
    const res = await sendToSocket(sockPath, {
      agentId: 'agent-1',
      agentName: 'test-agent',
      repo: 'my-repo',
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('message') })
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('returns socket path after start', async () => {
    await server.start(sockPath)
    expect(server.getSocketPath()).toBe(sockPath)
    expect(server.getStatus()).toEqual({
      socketPath: sockPath,
      state: 'listening',
      errorCode: null,
    })
  })

  it('returns null socket path before start', () => {
    expect(server.getSocketPath()).toBeNull()
  })

  it('rejects startup with the original listen error and records socket diagnostics', async () => {
    const listenError = Object.assign(new Error('address already in use'), { code: 'EADDRINUSE' })
    const emitter = new EventEmitter()
    const fakeServer = Object.assign(emitter, {
      listen: vi.fn(() => queueMicrotask(() => emitter.emit('error', listenError))),
      close: vi.fn(),
    }) as unknown as net.Server
    const logError = vi.fn()
    server = new TelegramSocketServer({
      notify: mockNotify,
      logInfo: vi.fn(),
      logError,
      createServer: vi.fn(() => fakeServer),
    })

    const startup = server.start(sockPath)

    await expect(startup).rejects.toBe(listenError)
    expect(logError).toHaveBeenCalledWith('telegram socket server startup failed', {
      error: String(listenError),
      errorCode: 'EADDRINUSE',
      sockPath,
      state: 'error',
    })
    expect(server.getStatus()).toEqual({
      socketPath: sockPath,
      state: 'error',
      errorCode: 'EADDRINUSE',
    })
  })

  it('rejects an in-flight startup when stopped', async () => {
    const fakeServer = Object.assign(new EventEmitter(), {
      listen: vi.fn(),
      close: vi.fn(),
    }) as unknown as net.Server
    server = new TelegramSocketServer({
      notify: mockNotify,
      logInfo: vi.fn(),
      logError: vi.fn(),
      createServer: vi.fn(() => fakeServer),
    })

    const startup = server.start(sockPath)
    await Promise.resolve()
    server.stop()

    await expect(startup).rejects.toMatchObject({ code: 'ECANCELED' })
    expect(server.getStatus()).toEqual({
      socketPath: null,
      state: 'stopped',
      errorCode: null,
    })
  })

  it('does not unlink a socket owned by another live server', async () => {
    const owner = net.createServer()
    await new Promise<void>((resolve) => owner.listen(sockPath, resolve))

    try {
      await expect(server.start(sockPath)).rejects.toMatchObject({ code: 'EADDRINUSE' })
      expect(owner.listening).toBe(true)
      expect(fs.existsSync(sockPath)).toBe(true)
    } finally {
      await new Promise<void>((resolve) => owner.close(() => resolve()))
    }
  })

  it('fails instead of deleting a non-socket entry at the configured path', async () => {
    fs.writeFileSync(sockPath, 'do not delete')

    await expect(server.start(sockPath)).rejects.toMatchObject({ code: 'ENOTSOCK' })
    expect(fs.readFileSync(sockPath, 'utf8')).toBe('do not delete')
  })

  it('rejects when probing an existing socket times out', async () => {
    const owner = net.createServer()
    await new Promise<void>((resolve) => owner.listen(sockPath, resolve))
    const probe = Object.assign(new EventEmitter(), { destroy: vi.fn() }) as unknown as net.Socket
    server = new TelegramSocketServer({
      notify: mockNotify,
      logInfo: vi.fn(),
      logError: vi.fn(),
      createConnection: vi.fn(() => probe),
      probeTimeoutMs: 10,
    })
    vi.useFakeTimers()

    try {
      const assertion = expect(server.start(sockPath)).rejects.toMatchObject({ code: 'ETIMEDOUT' })
      await vi.advanceTimersByTimeAsync(10)
      await assertion
      expect(probe.destroy).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
      await new Promise<void>((resolve) => owner.close(() => resolve()))
    }
  })

  it('cleans up socket file on stop', async () => {
    await server.start(sockPath)
    expect(fs.statSync(sockPath).mode & 0o777).toBe(0o600)
    server.stop()
    expect(fs.existsSync(sockPath)).toBe(false)
    expect(server.getSocketPath()).toBeNull()
    expect(server.getStatus()).toEqual({
      socketPath: null,
      state: 'stopped',
      errorCode: null,
    })
  })
})
