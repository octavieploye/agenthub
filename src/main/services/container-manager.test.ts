import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

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

import { ContainerManager } from './container-manager'
import type { DockerContainerConfig } from '../../shared/types/docker.types'

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------

function createMockDb() {
  const store = new Map<string, Record<string, unknown>>()

  const mockPrepare = vi.fn((sql: string) => {
    if (sql.includes('SELECT * FROM containers')) {
      return { all: vi.fn(() => Array.from(store.values())) }
    }
    if (sql.includes('INSERT OR REPLACE INTO containers')) {
      return {
        run: vi.fn((id: string, repoId: string, containerId: string, status: string, configJson: string) => {
          store.set(repoId, {
            id,
            repo_id: repoId,
            container_id: containerId,
            status,
            config_json: configJson,
            last_activity: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
        })
      }
    }
    if (sql.includes('UPDATE containers SET status')) {
      return {
        run: vi.fn((status: string, repoId: string) => {
          const row = store.get(repoId)
          if (row) row.status = status
        })
      }
    }
    if (sql.includes('UPDATE containers SET last_activity')) {
      return { run: vi.fn() }
    }
    if (sql.includes('DELETE FROM containers')) {
      return { run: vi.fn((repoId: string) => { store.delete(repoId) }) }
    }
    return { all: vi.fn(() => []), run: vi.fn(), get: vi.fn() }
  })

  return { prepare: mockPrepare, _store: store }
}

// ---------------------------------------------------------------------------
// Exec/spawn helpers
// ---------------------------------------------------------------------------

function makeExecSuccess(): void {
  mockExecFn.mockImplementation((_cmd: unknown, callback: unknown) => {
    (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
      null, { stdout: '', stderr: '' }
    )
    return {}
  })
}

function makeExecFail(msg = 'exec failed'): void {
  mockExecFn.mockImplementation((_cmd: unknown, callback: unknown) => {
    (callback as (err: Error) => void)(new Error(msg))
    return {}
  })
}

function makeSpawnSuccess(containerId = 'abc123containerId'): void {
  mockSpawnFn.mockImplementation(() => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const proc = Object.assign(new EventEmitter(), { stdout, stderr })
    setImmediate(() => {
      stdout.emit('data', Buffer.from(`${containerId}\n`))
      proc.emit('close', 0)
    })
    return proc
  })
}

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------

const defaultConfig: DockerContainerConfig = {
  cpus: 2,
  memoryGb: 4,
  networkMode: 'host',
  repoPath: '/tmp/test-repo',
  isLeadAgent: false
}

const deps = {
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  getApiKey: vi.fn(() => 'test-api-key')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContainerManager', () => {
  let mgr: ContainerManager
  let db: ReturnType<typeof createMockDb>

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
    mgr = new ContainerManager(deps)
  })

  // -------------------------------------------------------------------------
  describe('init()', () => {
    it('loads no containers with empty DB', async () => {
      // detectOrphans — docker not available
      makeExecFail('docker not available')
      await mgr.init(db as any)
      expect(mgr.listContainers()).toHaveLength(0)
    })

    it('loads containers persisted in DB', async () => {
      const repoId = 'repo-abc'
      db._store.set(repoId, {
        id: 'some-uuid',
        repo_id: repoId,
        container_id: 'cont123',
        status: 'running',
        config_json: JSON.stringify(defaultConfig),
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString()
      })

      makeExecSuccess() // detectOrphans
      await mgr.init(db as any)

      const containers = mgr.listContainers()
      expect(containers).toHaveLength(1)
      expect(containers[0].repoId).toBe(repoId)
      expect(containers[0].containerId).toBe('cont123')
    })
  })

  // -------------------------------------------------------------------------
  describe('TTL cleanup', () => {
    it('destroys containers idle beyond ttlDays on init', async () => {
      const repoId = 'stale-repo'
      const oldActivity = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

      db._store.set(repoId, {
        id: 'uuid-stale',
        repo_id: repoId,
        container_id: 'stale-cont',
        status: 'stopped',
        config_json: JSON.stringify(defaultConfig),
        last_activity: oldActivity,
        created_at: oldActivity
      })

      // exec handles both docker rm -f (TTL destroy) and detectOrphans
      makeExecSuccess()

      await mgr.init(db as any, 7)

      // Stale container should be removed from the internal map
      expect(mgr.listContainers()).toHaveLength(0)
    })

    it('preserves containers within TTL', async () => {
      const repoId = 'fresh-repo'
      const recentActivity = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()

      db._store.set(repoId, {
        id: 'uuid-fresh',
        repo_id: repoId,
        container_id: 'fresh-cont',
        status: 'stopped',
        config_json: JSON.stringify(defaultConfig),
        last_activity: recentActivity,
        created_at: recentActivity
      })

      makeExecSuccess() // detectOrphans
      await mgr.init(db as any, 7)

      expect(mgr.listContainers()).toHaveLength(1)
      expect(mgr.listContainers()[0].repoId).toBe(repoId)
    })
  })

  // -------------------------------------------------------------------------
  describe('ensureContainer()', () => {
    it('creates a new container when none exists', async () => {
      // init: detectOrphans fails (docker unavailable)
      makeExecFail()
      await mgr.init(db as any)

      // Now mock spawn for docker create, exec for docker start
      makeSpawnSuccess('newContainerId123')
      // After mockSpawnFn is set, exec needs to succeed for docker start
      mockExecFn.mockImplementation((_cmd: unknown, callback: unknown) => {
        (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
          null, { stdout: '', stderr: '' }
        )
        return {}
      })

      const containerId = await mgr.ensureContainer('repo-new', '/tmp/repo', defaultConfig)
      expect(containerId).toBe('newContainerId123')

      const containers = mgr.listContainers()
      expect(containers).toHaveLength(1)
      expect(containers[0].status).toBe('running')
    })

    it('reuses running container without calling spawn again', async () => {
      makeExecFail() // init detectOrphans
      await mgr.init(db as any)

      makeSpawnSuccess('existingCont')
      makeExecSuccess() // docker start
      await mgr.ensureContainer('repo-x', '/tmp/x', defaultConfig)

      const spawnCallCount = mockSpawnFn.mock.calls.length

      // Second call — container is running, should reuse without spawn
      await mgr.ensureContainer('repo-x', '/tmp/x', defaultConfig)

      expect(mockSpawnFn.mock.calls.length).toBe(spawnCallCount)
      expect(mgr.listContainers()[0].containerId).toBe('existingCont')
    })

    it('restarts stopped container by calling docker start', async () => {
      const repoId = 'stopped-repo'
      db._store.set(repoId, {
        id: 'uuid-stopped',
        repo_id: repoId,
        container_id: 'stopped-cont-id',
        status: 'stopped',
        config_json: JSON.stringify(defaultConfig),
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString()
      })

      makeExecSuccess() // detectOrphans
      await mgr.init(db as any)

      vi.clearAllMocks()
      makeExecSuccess() // docker start

      const containerId = await mgr.ensureContainer(repoId, '/tmp/stopped', defaultConfig)
      expect(containerId).toBe('stopped-cont-id')

      const startCall = mockExecFn.mock.calls.find((c) =>
        typeof c[0] === 'string' && (c[0] as string).includes('docker start stopped-cont-id')
      )
      expect(startCall).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  describe('stopContainer()', () => {
    it('calls docker stop with the container ID', async () => {
      makeExecFail() // init detectOrphans
      await mgr.init(db as any)

      makeSpawnSuccess('cont-to-stop')
      makeExecSuccess() // docker start
      await mgr.ensureContainer('repo-stop', '/tmp/stop', defaultConfig)

      vi.clearAllMocks()
      makeExecSuccess()

      await mgr.stopContainer('repo-stop')

      const stopCall = mockExecFn.mock.calls.find((c) =>
        typeof c[0] === 'string' && (c[0] as string).includes('docker stop cont-to-stop')
      )
      expect(stopCall).toBeDefined()
    })

    it('is idempotent for already-stopped container — does not call exec', async () => {
      const repoId = 'already-stopped'
      db._store.set(repoId, {
        id: 'uuid-as',
        repo_id: repoId,
        container_id: 'as-cont',
        status: 'stopped',
        config_json: JSON.stringify(defaultConfig),
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString()
      })

      makeExecSuccess() // detectOrphans
      await mgr.init(db as any)

      vi.clearAllMocks()

      await mgr.stopContainer(repoId)

      const stopCall = mockExecFn.mock.calls.find((c) =>
        typeof c[0] === 'string' && (c[0] as string).includes('docker stop')
      )
      expect(stopCall).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  describe('destroyContainer()', () => {
    it('removes container from internal map and DB', async () => {
      makeExecFail() // init detectOrphans
      await mgr.init(db as any)

      makeSpawnSuccess('destroy-me')
      makeExecSuccess() // docker start
      await mgr.ensureContainer('repo-destroy', '/tmp/d', defaultConfig)

      expect(mgr.listContainers()).toHaveLength(1)

      vi.clearAllMocks()
      makeExecSuccess() // docker rm -f

      await mgr.destroyContainer('repo-destroy')

      expect(mgr.listContainers()).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  describe('exec count lifecycle', () => {
    it('increments and decrements correctly', () => {
      const repoId = 'count-repo'
      expect(mgr.getExecCount(repoId)).toBe(0)

      mgr.incrementExecCount(repoId)
      expect(mgr.getExecCount(repoId)).toBe(1)

      mgr.incrementExecCount(repoId)
      expect(mgr.getExecCount(repoId)).toBe(2)

      mgr.decrementExecCount(repoId)
      expect(mgr.getExecCount(repoId)).toBe(1)

      mgr.decrementExecCount(repoId)
      expect(mgr.getExecCount(repoId)).toBe(0)
    })

    it('does not go below 0 on decrement', () => {
      mgr.decrementExecCount('never-incremented')
      expect(mgr.getExecCount('never-incremented')).toBe(0)
    })

    it('does not stop container while exec count > 0', async () => {
      makeExecFail() // init detectOrphans
      await mgr.init(db as any)

      makeSpawnSuccess('idle-check-cont')
      makeExecSuccess() // docker start
      await mgr.ensureContainer('repo-idle', '/tmp/idle', defaultConfig)

      mgr.incrementExecCount('repo-idle')

      vi.clearAllMocks()

      await mgr.stopContainerIfIdle('repo-idle')

      const stopCall = mockExecFn.mock.calls.find((c) =>
        typeof c[0] === 'string' && (c[0] as string).includes('docker stop')
      )
      expect(stopCall).toBeUndefined()
    })

    it('stops container when exec count reaches 0', async () => {
      makeExecFail() // init detectOrphans
      await mgr.init(db as any)

      makeSpawnSuccess('idle-stop-cont')
      makeExecSuccess() // docker start
      await mgr.ensureContainer('repo-idle2', '/tmp/idle2', defaultConfig)

      mgr.incrementExecCount('repo-idle2')
      mgr.decrementExecCount('repo-idle2')

      vi.clearAllMocks()
      makeExecSuccess()

      await mgr.stopContainerIfIdle('repo-idle2')

      const stopCall = mockExecFn.mock.calls.find((c) =>
        typeof c[0] === 'string' && (c[0] as string).includes('docker stop idle-stop-cont')
      )
      expect(stopCall).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  describe('listContainers()', () => {
    it('returns stable IDs — same id on repeated calls', async () => {
      makeExecFail() // init detectOrphans
      await mgr.init(db as any)

      makeSpawnSuccess('stable-cont')
      makeExecSuccess() // docker start
      await mgr.ensureContainer('repo-stable', '/tmp/stable', defaultConfig)

      const first = mgr.listContainers()
      const second = mgr.listContainers()

      expect(first[0].id).toBe(second[0].id)
      expect(first[0].containerId).toBe('stable-cont')
    })
  })
})
