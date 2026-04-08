import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  insertSnapshot,
  getLatestSnapshot,
  getSnapshotById,
  pruneOldSnapshots,
  getSnapshotCount
} from './snapshots.queries'
import type { WorkspaceState } from '../../../shared/types/recovery.types'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const initSql = readFileSync(join(__dirname, '../migrations/001-init.sql'), 'utf-8')
  db.exec(initSql)

  const migration003 = readFileSync(join(__dirname, '../migrations/003-snapshots-update.sql'), 'utf-8')
  db.exec(migration003)

  return db
}

function buildWorkspaceState(overrides?: Partial<WorkspaceState>): WorkspaceState {
  return {
    agents: [],
    activeAgentId: null,
    viewMode: 'raid',
    soundEnabled: true,
    focusedAgentId: null,
    statusFilter: null,
    appVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    ...overrides
  }
}

describe('snapshots.queries', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
  })

  describe('insertSnapshot', () => {
    it('inserts a snapshot and returns it', () => {
      const state = buildWorkspaceState()
      const snapshot = insertSnapshot(db, state, 'periodic')

      expect(snapshot.id).toBeGreaterThan(0)
      expect(snapshot.trigger).toBe('periodic')
      expect(snapshot.stateJson).toEqual(state)
      expect(snapshot.createdAt).toBeTruthy()
    })

    it('stores different trigger types', () => {
      const state = buildWorkspaceState()
      const s1 = insertSnapshot(db, state, 'agent_spawn')
      const s2 = insertSnapshot(db, state, 'app_close')
      const s3 = insertSnapshot(db, state, 'view_switch')

      expect(s1.trigger).toBe('agent_spawn')
      expect(s2.trigger).toBe('app_close')
      expect(s3.trigger).toBe('view_switch')
    })

    it('persists agent state in JSON', () => {
      const state = buildWorkspaceState({
        agents: [
          {
            id: 'agent-1',
            repoId: 'repo-1',
            name: 'Test Agent',
            status: 'busy',
            confidence: 'confirmed',
            model: 'claude-sonnet-4-20250514',
            provider: 'anthropic',
            taskDescription: 'Fix a bug',
            pid: 1234,
            ptyFd: null,
            cwd: '/tmp/repo',
            progress: 50,
            effortLevel: 'medium' as const,
            color: '#3B82F6',
            executionMode: 'native' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        activeAgentId: 'agent-1',
        viewMode: 'terminal'
      })

      insertSnapshot(db, state, 'manual')
      const retrieved = getLatestSnapshot(db)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.stateJson.agents).toHaveLength(1)
      expect(retrieved!.stateJson.agents[0].name).toBe('Test Agent')
      expect(retrieved!.stateJson.agents[0].pid).toBe(1234)
      expect(retrieved!.stateJson.activeAgentId).toBe('agent-1')
      expect(retrieved!.stateJson.viewMode).toBe('terminal')
    })
  })

  describe('getLatestSnapshot', () => {
    it('returns null when no snapshots exist', () => {
      const result = getLatestSnapshot(db)
      expect(result).toBeNull()
    })

    it('returns the most recent snapshot', () => {
      insertSnapshot(db, buildWorkspaceState({ appVersion: '1.0' }), 'periodic')
      insertSnapshot(db, buildWorkspaceState({ appVersion: '2.0' }), 'periodic')
      insertSnapshot(db, buildWorkspaceState({ appVersion: '3.0' }), 'periodic')

      const latest = getLatestSnapshot(db)
      expect(latest).not.toBeNull()
      expect(latest!.stateJson.appVersion).toBe('3.0')
    })
  })

  describe('getSnapshotById', () => {
    it('returns snapshot by id', () => {
      const snapshot = insertSnapshot(db, buildWorkspaceState(), 'manual')
      const retrieved = getSnapshotById(db, snapshot.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(snapshot.id)
    })

    it('returns null for non-existent id', () => {
      const result = getSnapshotById(db, 999)
      expect(result).toBeNull()
    })
  })

  describe('pruneOldSnapshots', () => {
    it('deletes snapshots older than maxAgeHours', () => {
      insertSnapshot(db, buildWorkspaceState(), 'periodic')

      // Manually backdate the snapshot
      db.prepare("UPDATE snapshots SET created_at = datetime('now', '-25 hours')").run()

      insertSnapshot(db, buildWorkspaceState(), 'periodic')

      const deleted = pruneOldSnapshots(db, 24)
      expect(deleted).toBe(1)
      expect(getSnapshotCount(db)).toBe(1)
    })

    it('keeps recent snapshots', () => {
      insertSnapshot(db, buildWorkspaceState(), 'periodic')
      insertSnapshot(db, buildWorkspaceState(), 'periodic')

      const deleted = pruneOldSnapshots(db, 24)
      expect(deleted).toBe(0)
      expect(getSnapshotCount(db)).toBe(2)
    })
  })

  describe('getSnapshotCount', () => {
    it('returns 0 when empty', () => {
      expect(getSnapshotCount(db)).toBe(0)
    })

    it('returns correct count', () => {
      insertSnapshot(db, buildWorkspaceState(), 'periodic')
      insertSnapshot(db, buildWorkspaceState(), 'manual')
      expect(getSnapshotCount(db)).toBe(2)
    })
  })
})
