import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as recoveryManager from './recovery-manager'
import { insertSnapshot } from '../db/queries/snapshots.queries'
import { insertSBAR } from '../db/queries/sbar.queries'
import type { WorkspaceState } from '../../shared/types/recovery.types'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(join(__dirname, '../db/migrations/001-init.sql'), 'utf-8'))
  db.exec(readFileSync(join(__dirname, '../db/migrations/003-snapshots-update.sql'), 'utf-8'))

  db.prepare("INSERT INTO repos (id, name, path) VALUES ('repo-1', 'test-repo', '/tmp/test')").run()

  return db
}

function insertTestAgent(
  db: Database.Database,
  id: string,
  status: string,
  pid: number | null = 1234
): void {
  db.prepare(
    `INSERT INTO agents (id, repo_id, name, status, confidence, cwd, pid)
     VALUES (?, 'repo-1', ?, ?, 'confirmed', '/tmp/test', ?)`
  ).run(id, `Agent ${id}`, status, pid)
}

describe('recovery-manager', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
  })

  describe('isProcessAlive', () => {
    it('returns true for current process', () => {
      expect(recoveryManager.isProcessAlive(process.pid)).toBe(true)
    })

    it('returns false for non-existent process', () => {
      expect(recoveryManager.isProcessAlive(999999)).toBe(false)
    })
  })

  describe('buildRecoveryInfo', () => {
    it('returns no interruption when no agents exist', () => {
      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.hadInterruption).toBe(false)
      expect(info.recoveredAgents).toEqual([])
      expect(info.interruptedAgents).toEqual([])
    })

    it('returns no interruption when all agents are completed', () => {
      insertTestAgent(db, 'a1', 'completed')
      insertTestAgent(db, 'a2', 'interrupted')

      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.hadInterruption).toBe(false)
    })

    it('detects interrupted agents with dead PIDs', () => {
      insertTestAgent(db, 'a1', 'busy', 999999)

      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.hadInterruption).toBe(true)
      expect(info.interruptedAgents).toHaveLength(1)
      expect(info.interruptedAgents[0].id).toBe('a1')
      expect(info.interruptedAgents[0].status).toBe('interrupted')
    })

    it('detects recovered agents with alive PIDs', () => {
      insertTestAgent(db, 'a1', 'busy', process.pid)

      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.hadInterruption).toBe(true)
      expect(info.recoveredAgents).toHaveLength(1)
      expect(info.recoveredAgents[0].id).toBe('a1')
    })

    it('handles mix of recovered and interrupted agents', () => {
      insertTestAgent(db, 'a1', 'busy', process.pid)
      insertTestAgent(db, 'a2', 'locked', 999999)
      insertTestAgent(db, 'a3', 'completed')

      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.hadInterruption).toBe(true)
      expect(info.recoveredAgents).toHaveLength(1)
      expect(info.interruptedAgents).toHaveLength(1)
    })

    it('includes SBAR handoff for interrupted agents', () => {
      insertTestAgent(db, 'a1', 'busy', 999999)

      insertSBAR(db, {
        agentId: 'a1',
        agentName: 'Agent a1',
        repoId: 'repo-1',
        situation: 'Working on OAuth',
        background: 'payment-service',
        assessment: '70% done',
        recommendation: 'Resume'
      })

      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.interruptedAgents[0].handoff).toBeDefined()
      expect(info.interruptedAgents[0].handoff!.situation).toBe('Working on OAuth')
    })

    it('includes last snapshot', () => {
      const state: WorkspaceState = {
        agents: [],
        activeAgentId: null,
        viewMode: 'raid',
        soundEnabled: true,
        focusedAgentId: null,
        statusFilter: null,
        appVersion: '1.0.0',
        timestamp: new Date().toISOString()
      }
      insertSnapshot(db, state, 'app_close')

      insertTestAgent(db, 'a1', 'busy', 999999)

      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.lastSnapshot).not.toBeNull()
      expect(info.lastSnapshot!.trigger).toBe('app_close')
    })

    it('handles agents with null PIDs as interrupted', () => {
      insertTestAgent(db, 'a1', 'busy', null)

      const info = recoveryManager.buildRecoveryInfo(db)
      expect(info.interruptedAgents).toHaveLength(1)
    })

    it('checks all active statuses', () => {
      const activeStatuses = ['spawning', 'busy', 'idle', 'locked', 'looping', 'paused', 'tray_running']

      for (const status of activeStatuses) {
        const localDb = createTestDb()
        insertTestAgent(localDb, `agent-${status}`, status, 999999)
        const info = recoveryManager.buildRecoveryInfo(localDb)
        expect(info.interruptedAgents.length).toBe(1)
      }
    })

    it('updates interrupted agent status in database', () => {
      insertTestAgent(db, 'a1', 'busy', 999999)

      recoveryManager.buildRecoveryInfo(db)

      const row = db.prepare('SELECT status FROM agents WHERE id = ?').get('a1') as { status: string }
      expect(row.status).toBe('interrupted')
    })
  })
})
