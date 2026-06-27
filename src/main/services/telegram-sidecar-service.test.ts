import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Acceptable mocks: electron (requires running Electron process) and child_process (unit test of wiring only)

const { mockSpawnFn, mockChildProcess } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PassThrough, EventEmitter } = require('stream') as typeof import('stream')
  const proc = new EventEmitter() as any
  proc.stdin = { write: vi.fn(), end: vi.fn() }
  proc.stdout = new PassThrough()
  proc.stderr = new PassThrough()
  proc.pid = 12345
  proc.killed = false
  proc.kill = vi.fn()
  return {
    mockSpawnFn: vi.fn(() => proc),
    mockChildProcess: proc,
  }
})

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  }
}))

vi.mock('child_process', () => ({
  default: { spawn: mockSpawnFn },
  spawn: mockSpawnFn,
}))

import { TelegramSidecarService } from './telegram-sidecar-service'

describe('TelegramSidecarService', () => {
  let service: TelegramSidecarService

  beforeEach(() => {
    service = new TelegramSidecarService({
      scriptPath: '/fake/path/index.js',
      nodePath: '/fake/node',
      db: { prepare: vi.fn().mockReturnValue({ get: vi.fn(), run: vi.fn() }) } as any,
      logInfo: vi.fn(),
      logError: vi.fn(),
      onBlockedSender: vi.fn(),
      onFirstContact: vi.fn(),
      onCommand: vi.fn(),
    })
  })

  afterEach(() => {
    service.stop()
  })

  it('starts child process with config message', async () => {
    await service.start('fake-token-12345')
    expect(mockSpawnFn).toHaveBeenCalledWith(
      '/fake/node',
      ['/fake/path/index.js'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    )
    expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"type":"config"')
    )
  })

  it('is not running before start', () => {
    expect(service.isRunning()).toBe(false)
  })

  it('sends agent_list to sidecar via stdin', async () => {
    await service.start('fake-token-12345')
    service.sendAgentList([{ id: 'a1', name: 'test-agent', status: 'busy', repo: 'my-repo' }])
    expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"type":"agent_list"')
    )
  })
})
