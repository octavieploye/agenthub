import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelegramSocketServer } from './telegram-socket-server'
import * as net from 'net'
import * as fs from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

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
  })

  it('returns null socket path before start', () => {
    expect(server.getSocketPath()).toBeNull()
  })

  it('cleans up socket file on stop', async () => {
    await server.start(sockPath)
    server.stop()
    expect(fs.existsSync(sockPath)).toBe(false)
    expect(server.getSocketPath()).toBeNull()
  })
})
