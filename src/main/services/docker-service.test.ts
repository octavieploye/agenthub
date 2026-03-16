import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFn, mockSpawnFn } = vi.hoisted(() => ({
  mockExecFn: vi.fn(),
  mockSpawnFn: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('child_process', () => ({
  default: { exec: mockExecFn, spawn: mockSpawnFn },
  exec: mockExecFn,
  spawn: mockSpawnFn
}))

import { DockerService } from './docker-service'

function makeSuccessExec(stdout: string): void {
  mockExecFn.mockImplementation((_cmd: unknown, callback: unknown) => {
    (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
      null,
      { stdout, stderr: '' }
    )
    return {}
  })
}

function makeFailExec(err: Error = new Error('exec failed')): void {
  mockExecFn.mockImplementation((_cmd: unknown, callback: unknown) => {
    (callback as (err: Error) => void)(err)
    return {}
  })
}

describe('DockerService', () => {
  let svc: DockerService
  const deps = { logInfo: vi.fn(), logWarning: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new DockerService(deps)
  })

  describe('isAvailable()', () => {
    it('returns true when docker info succeeds', async () => {
      makeSuccessExec('24.0.0')
      const result = await svc.isAvailable()
      expect(result).toBe(true)
    })

    it('returns false when docker info fails', async () => {
      makeFailExec(new Error('docker: command not found'))
      const result = await svc.isAvailable()
      expect(result).toBe(false)
    })

    it('returns false when exec throws synchronously', async () => {
      mockExecFn.mockImplementation(() => {
        throw new Error('unexpected sync throw')
      })
      const result = await svc.isAvailable()
      expect(result).toBe(false)
    })
  })

  describe('getVersion()', () => {
    it('returns version string from docker version output', async () => {
      makeSuccessExec('24.0.7\n')
      const result = await svc.getVersion()
      expect(result).toBe('24.0.7')
    })

    it('returns undefined when exec errors', async () => {
      makeFailExec(new Error('no docker'))
      const result = await svc.getVersion()
      expect(result).toBeUndefined()
    })

    it('returns undefined when stdout is empty', async () => {
      makeSuccessExec('   \n')
      const result = await svc.getVersion()
      expect(result).toBeUndefined()
    })
  })

  describe('isImageBuilt()', () => {
    it('returns true when image inspect returns non-empty ID', async () => {
      makeSuccessExec('sha256:abc123def456\n')
      const result = await svc.isImageBuilt()
      expect(result).toBe(true)
    })

    it('returns false when docker image inspect errors', async () => {
      makeFailExec(new Error('No such image'))
      const result = await svc.isImageBuilt()
      expect(result).toBe(false)
    })

    it('returns false when stdout is empty', async () => {
      makeSuccessExec('  \n')
      const result = await svc.isImageBuilt()
      expect(result).toBe(false)
    })
  })

  describe('getStatus()', () => {
    it('returns composed status object with all fields', async () => {
      // isAvailable → success, getVersion → '24.0.7', isImageBuilt → true
      mockExecFn
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'info-output', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: '24.0.7\n', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'sha256:abc123\n', stderr: '' }
          )
          return {}
        })

      const status = await svc.getStatus()
      expect(status.available).toBe(true)
      expect(status.version).toBe('24.0.7')
      expect(status.imageReady).toBe(true)
      expect(status.imageTag).toBe('agenthub-cli:latest')
      expect(status.activeContainerCount).toBe(0)
    })

    it('returns available=false with no version/image when docker is unavailable', async () => {
      makeFailExec(new Error('docker not found'))
      const status = await svc.getStatus()
      expect(status.available).toBe(false)
      expect(status.version).toBeUndefined()
      expect(status.imageReady).toBe(false)
    })

    it('caches result within 30s window — second call does not re-exec', async () => {
      mockExecFn
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'info', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: '24.0.7\n', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'sha256:abc\n', stderr: '' }
          )
          return {}
        })

      const first = await svc.getStatus()
      const callCountAfterFirst = mockExecFn.mock.calls.length

      // Second call — should use cache, no new exec calls
      const second = await svc.getStatus()
      expect(mockExecFn.mock.calls.length).toBe(callCountAfterFirst)
      expect(second).toStrictEqual(first)
    })

    it('re-fetches after invalidateCache() clears the cache', async () => {
      mockExecFn
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'info', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: '24.0.7\n', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'sha256:abc\n', stderr: '' }
          )
          return {}
        })

      await svc.getStatus()
      const callCountAfterFirst = mockExecFn.mock.calls.length

      svc.invalidateCache()

      // After invalidation, next call should re-exec
      makeFailExec(new Error('gone'))
      await svc.getStatus()
      expect(mockExecFn.mock.calls.length).toBeGreaterThan(callCountAfterFirst)
    })
  })

  describe('invalidateCache()', () => {
    it('clears the cache so next getStatus() re-fetches', async () => {
      // Populate cache
      mockExecFn
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'info', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: '23.0\n', stderr: '' }
          )
          return {}
        })
        .mockImplementationOnce((_cmd: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null, { stdout: 'sha256:aaa\n', stderr: '' }
          )
          return {}
        })

      await svc.getStatus()
      svc.invalidateCache()

      // Next call must re-exec; make it fail so we can observe the difference
      makeFailExec(new Error('offline'))
      const status = await svc.getStatus()
      expect(status.available).toBe(false)
    })
  })
})
