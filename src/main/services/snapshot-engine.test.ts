import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { SnapshotEngine, type WorkspaceStateProvider } from './snapshot-engine'
import type { AgentState } from '../../shared/types/agent.types'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const initSql = readFileSync(
    join(__dirname, '../db/migrations/001-init.sql'),
    'utf-8'
  )
  db.exec(initSql)

  const migration003 = readFileSync(
    join(__dirname, '../db/migrations/003-snapshots-update.sql'),
    'utf-8'
  )
  db.exec(migration003)

  return db
}

function createMockProvider(overrides?: Partial<WorkspaceStateProvider>): WorkspaceStateProvider {
  return {
    getAgents: () => [],
    getActiveAgentId: () => null,
    getViewMode: () => 'raid',
    getSoundEnabled: () => true,
    getFocusedAgentId: () => null,
    getStatusFilter: () => null,
    getAppVersion: () => '1.0.0-test',
    ...overrides
  }
}

function createAgent(id: string, status: AgentState['status'] = 'busy'): AgentState {
  return {
    id,
    repoId: 'repo-1',
    name: `Agent ${id}`,
    status,
    confidence: 'confirmed',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    taskDescription: 'Test task',
    pid: 1234,
    ptyFd: null,
    cwd: '/tmp/test',
    progress: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

describe('SnapshotEngine', () => {
  let db: Database.Database
  let engine: SnapshotEngine

  beforeEach(() => {
    vi.useFakeTimers()
    db = createTestDb()
  })

  afterEach(() => {
    engine?.stop()
    vi.useRealTimers()
  })

  describe('constructor and lifecycle', () => {
    it('creates engine with default config', () => {
      const provider = createMockProvider()
      engine = new SnapshotEngine(db, provider)
      expect(engine.isRunning()).toBe(false)
    })

    it('starts and stops the engine', () => {
      engine = new SnapshotEngine(db, createMockProvider())
      engine.start()
      expect(engine.isRunning()).toBe(true)

      engine.stop()
      expect(engine.isRunning()).toBe(false)
    })

    it('start is idempotent', () => {
      engine = new SnapshotEngine(db, createMockProvider())
      engine.start()
      engine.start()
      expect(engine.isRunning()).toBe(true)
    })
  })

  describe('takeSnapshot', () => {
    it('takes a snapshot and persists it', () => {
      engine = new SnapshotEngine(db, createMockProvider())
      const snapshot = engine.takeSnapshot('manual')

      expect(snapshot).not.toBeNull()
      expect(snapshot!.trigger).toBe('manual')
      expect(snapshot!.stateJson.appVersion).toBe('1.0.0-test')
    })

    it('captures agent state from provider', () => {
      const agents = [createAgent('a1', 'busy'), createAgent('a2', 'idle')]
      engine = new SnapshotEngine(
        db,
        createMockProvider({
          getAgents: () => agents,
          getActiveAgentId: () => 'a1'
        })
      )

      const snapshot = engine.takeSnapshot('manual')
      expect(snapshot!.stateJson.agents).toHaveLength(2)
      expect(snapshot!.stateJson.agents[0].id).toBe('a1')
      expect(snapshot!.stateJson.activeAgentId).toBe('a1')
    })

    it('skips periodic snapshot when state unchanged', () => {
      engine = new SnapshotEngine(db, createMockProvider())

      const first = engine.takeSnapshot('periodic')
      expect(first).not.toBeNull()

      const second = engine.takeSnapshot('periodic')
      expect(second).toBeNull()
    })

    it('does not skip non-periodic snapshots when state unchanged', () => {
      engine = new SnapshotEngine(db, createMockProvider())

      const first = engine.takeSnapshot('manual')
      expect(first).not.toBeNull()

      const second = engine.takeSnapshot('manual')
      expect(second).not.toBeNull()
    })

    it('takes periodic snapshot when state changes', () => {
      let viewMode: 'raid' | 'channel' | 'terminal' | 'briefing' = 'raid'
      engine = new SnapshotEngine(
        db,
        createMockProvider({
          getViewMode: () => viewMode
        })
      )

      const first = engine.takeSnapshot('periodic')
      expect(first).not.toBeNull()

      viewMode = 'terminal'
      const second = engine.takeSnapshot('periodic')
      expect(second).not.toBeNull()
    })

    it('stores all trigger types correctly', () => {
      engine = new SnapshotEngine(db, createMockProvider())
      const triggers = ['agent_spawn', 'agent_kill', 'agent_status_change', 'view_switch', 'app_close'] as const

      for (const trigger of triggers) {
        const snapshot = engine.takeSnapshot(trigger)
        expect(snapshot).not.toBeNull()
        expect(snapshot!.trigger).toBe(trigger)
      }
    })
  })

  describe('periodic snapshots via timer', () => {
    it('takes snapshots on interval', () => {
      let callCount = 0
      engine = new SnapshotEngine(
        db,
        createMockProvider({
          getAgents: () => {
            callCount++
            return [createAgent(`agent-${callCount}`)]
          }
        }),
        { intervalMs: 1000 }
      )

      engine.start()

      vi.advanceTimersByTime(1000)
      expect(callCount).toBeGreaterThanOrEqual(1)

      vi.advanceTimersByTime(1000)
      expect(callCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getLastSnapshot', () => {
    it('returns null when no snapshots exist', () => {
      engine = new SnapshotEngine(db, createMockProvider())
      expect(engine.getLastSnapshot()).toBeNull()
    })

    it('returns the latest snapshot', () => {
      let version = '1.0'
      engine = new SnapshotEngine(
        db,
        createMockProvider({
          getAppVersion: () => version
        })
      )

      engine.takeSnapshot('manual')
      version = '2.0'
      engine.takeSnapshot('manual')

      const latest = engine.getLastSnapshot()
      expect(latest).not.toBeNull()
      expect(latest!.stateJson.appVersion).toBe('2.0')
    })
  })

  describe('prune', () => {
    it('prunes old snapshots', () => {
      engine = new SnapshotEngine(db, createMockProvider(), { maxAgeHours: 24 })

      engine.takeSnapshot('manual')
      db.prepare("UPDATE snapshots SET created_at = datetime('now', '-25 hours')").run()
      engine.takeSnapshot('manual')

      const deleted = engine.prune()
      expect(deleted).toBe(1)
    })
  })

  describe('buildWorkspaceState', () => {
    it('builds complete workspace state from provider', () => {
      engine = new SnapshotEngine(
        db,
        createMockProvider({
          getAgents: () => [createAgent('a1')],
          getActiveAgentId: () => 'a1',
          getViewMode: () => 'channel',
          getSoundEnabled: () => false,
          getFocusedAgentId: () => 'a1',
          getStatusFilter: () => 'busy',
          getAppVersion: () => '2.5.0'
        })
      )

      const state = engine.buildWorkspaceState()
      expect(state.agents).toHaveLength(1)
      expect(state.activeAgentId).toBe('a1')
      expect(state.viewMode).toBe('channel')
      expect(state.soundEnabled).toBe(false)
      expect(state.focusedAgentId).toBe('a1')
      expect(state.statusFilter).toBe('busy')
      expect(state.appVersion).toBe('2.5.0')
      expect(state.timestamp).toBeTruthy()
    })
  })
})
