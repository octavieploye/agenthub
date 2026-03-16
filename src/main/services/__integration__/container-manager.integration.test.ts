import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { randomUUID } from 'crypto'

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: vi.fn(() => []) } }))
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { ContainerManager } from '../container-manager'
import { DOCKER_IMAGE_TAG, DOCKER_DEFAULT_TTL_DAYS } from '@shared/types/docker.types'
import type { DockerContainerConfig } from '@shared/types/docker.types'

const SKIP = process.env.DOCKER_INTEGRATION !== 'true'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function removeContainerIfExists(name: string): void {
  try { execSync(`docker rm -f ${name}`, { stdio: 'ignore' }) } catch {}
}

// In-memory mock DB that mirrors the ContainerManager's SQL queries
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

const testConfig: DockerContainerConfig = {
  cpus: 1,
  memoryGb: 1,
  networkMode: 'host' as const,
  repoPath: '/tmp',
  isLeadAgent: false
}

// Unique repoId prefix per test run to avoid name collisions between parallel CI runs
const RUN_PREFIX = randomUUID().slice(0, 8)

describe.skipIf(SKIP)('ContainerManager — real Docker', () => {
  const logInfo = vi.fn()
  const logWarning = vi.fn()
  const deps = {
    logInfo,
    logWarning,
    getApiKey: vi.fn(() => 'test-api-key')
  }

  let containerMgr: ContainerManager
  let db: ReturnType<typeof createMockDb>
  // Track container names created per test for cleanup
  const createdRepoIds: string[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
    containerMgr = new ContainerManager(deps)
    createdRepoIds.length = 0
  })

  afterEach(async () => {
    await containerMgr.stopAll().catch(() => {})
    // Force-remove all test containers created in this test
    for (const repoId of createdRepoIds) {
      const containerName = `agenthub-${repoId.slice(0, 8)}`
      removeContainerIfExists(containerName)
    }
    removeContainerIfExists('agenthub-orphan-test')
  })

  function makeRepoId(): string {
    const id = `${RUN_PREFIX}${randomUUID().slice(0, 8)}`
    createdRepoIds.push(id)
    return id
  }

  // -------------------------------------------------------------------------
  // Lifecycle tests
  // -------------------------------------------------------------------------

  it('ensureContainer() creates and starts a container — docker ps shows it running', async () => {
    await containerMgr.init(db as any)

    const repoId = makeRepoId()
    const containerId = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)
    expect(typeof containerId).toBe('string')
    expect(containerId.length).toBeGreaterThan(0)

    const running = execSync(`docker ps --filter id=${containerId} --format "{{.ID}}"`).toString()
    expect(running.trim()).toBeTruthy()
  })

  it('ensureContainer() with same repoId returns same containerId (reuse running)', async () => {
    await containerMgr.init(db as any)

    const repoId = makeRepoId()
    const first = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)
    const second = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)

    expect(second).toBe(first)
  })

  it('stopContainer() stops the container — not in docker ps, present in docker ps -a', async () => {
    await containerMgr.init(db as any)

    const repoId = makeRepoId()
    const containerId = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)

    await containerMgr.stopContainer(repoId)

    const running = execSync(`docker ps --filter id=${containerId} --format "{{.ID}}"`).toString()
    expect(running.trim()).toBe('')

    const all = execSync(`docker ps -a --filter id=${containerId} --format "{{.ID}}"`).toString()
    expect(all.trim()).toBeTruthy()
  })

  it('ensureContainer() after stop restarts it — verifies running again', async () => {
    await containerMgr.init(db as any)

    const repoId = makeRepoId()
    const containerId = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)

    await containerMgr.stopContainer(repoId)

    const restarted = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)
    expect(restarted).toBe(containerId)

    const running = execSync(`docker ps --filter id=${containerId} --format "{{.ID}}"`).toString()
    expect(running.trim()).toBeTruthy()
  })

  it('destroyContainer() removes container from Docker and from internal map', async () => {
    await containerMgr.init(db as any)

    const repoId = makeRepoId()
    const containerId = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)

    await containerMgr.destroyContainer(repoId)

    expect(containerMgr.listContainers()).toHaveLength(0)

    const all = execSync(`docker ps -a --filter id=${containerId} --format "{{.ID}}"`).toString()
    expect(all.trim()).toBe('')
  })

  it('listContainers() returns stable IDs across multiple calls', async () => {
    await containerMgr.init(db as any)

    const repoId = makeRepoId()
    await containerMgr.ensureContainer(repoId, '/tmp', testConfig)

    const first = containerMgr.listContainers()
    const second = containerMgr.listContainers()

    expect(first[0].id).toBe(second[0].id)
    expect(first[0].containerId).toBe(second[0].containerId)
  })

  // -------------------------------------------------------------------------
  // TTL cleanup (S6.2)
  // -------------------------------------------------------------------------

  it('TTL cleanup: container with lastActivity 30 days ago is destroyed on fresh init', async () => {
    // First init to create the container
    await containerMgr.init(db as any)

    const repoId = makeRepoId()
    const containerId = await containerMgr.ensureContainer(repoId, '/tmp', testConfig)

    // Stop it so it is eligible for TTL cleanup (TTL only applies to stopped containers)
    await containerMgr.stopContainer(repoId)

    // Manually set lastActivity to 30 days ago in the mock DB store
    const row = db._store.get(repoId)
    if (row) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      row.last_activity = thirtyDaysAgo
    }

    // Fresh ContainerManager reading the same DB — should trigger TTL destroy on init
    const freshMgr = new ContainerManager(deps)
    await freshMgr.init(db as any, DOCKER_DEFAULT_TTL_DAYS)

    expect(freshMgr.listContainers()).toHaveLength(0)

    // Container should be gone from Docker
    const all = execSync(`docker ps -a --filter id=${containerId} --format "{{.ID}}"`).toString()
    expect(all.trim()).toBe('')
  })

  // -------------------------------------------------------------------------
  // Orphan detection (S6.6)
  // -------------------------------------------------------------------------

  it('orphan detection: container not in DB is logged as a warning on init', async () => {
    // Create a container directly with Docker (bypassing ContainerManager)
    try {
      execSync(
        `docker run -d --name agenthub-orphan-test ${DOCKER_IMAGE_TAG}`,
        { stdio: 'ignore' }
      )
    } catch {
      // May already exist from a previous run; removeContainerIfExists in afterEach will clean it
    }

    // Fresh ContainerManager with empty DB — orphan should be detected
    const freshLogWarning = vi.fn()
    const freshMgr = new ContainerManager({
      logInfo: vi.fn(),
      logWarning: freshLogWarning,
      getApiKey: vi.fn(() => '')
    })
    const emptyDb = createMockDb()
    await freshMgr.init(emptyDb as any)

    // detectOrphans only logs — verify logWarning was called at least once for the orphan
    const warned = freshLogWarning.mock.calls.some(
      (call) =>
        typeof call[0] === 'string' &&
        (call[0] as string).toLowerCase().includes('orphan')
    )
    expect(warned).toBe(true)
  })
})
