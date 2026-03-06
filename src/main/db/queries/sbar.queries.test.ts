import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  insertSBAR,
  getSBARByAgentId,
  getAllSBARs,
  deleteSBAR
} from './sbar.queries'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const initSql = readFileSync(join(__dirname, '../migrations/001-init.sql'), 'utf-8')
  db.exec(initSql)

  const migration003 = readFileSync(join(__dirname, '../migrations/003-snapshots-update.sql'), 'utf-8')
  db.exec(migration003)

  // Insert a test repo and agent
  db.prepare("INSERT INTO repos (id, name, path) VALUES ('repo-1', 'test-repo', '/tmp/test')").run()
  db.prepare(
    "INSERT INTO agents (id, repo_id, name, cwd) VALUES ('agent-1', 'repo-1', 'Test Agent', '/tmp/test')"
  ).run()
  db.prepare(
    "INSERT INTO agents (id, repo_id, name, cwd) VALUES ('agent-2', 'repo-1', 'Agent Two', '/tmp/test')"
  ).run()

  return db
}

describe('sbar.queries', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()
  })

  describe('insertSBAR', () => {
    it('inserts an SBAR handoff and returns it', () => {
      const sbar = insertSBAR(db, {
        agentId: 'agent-1',
        agentName: 'Test Agent',
        repoId: 'repo-1',
        situation: 'Agent was working on OAuth fix',
        background: 'payment-service repo, 4 files modified',
        assessment: 'Completed 70% of task, tests passing',
        recommendation: 'Resume with prompt: continue OAuth refresh token implementation'
      })

      expect(sbar.id).toBeTruthy()
      expect(sbar.agentId).toBe('agent-1')
      expect(sbar.situation).toBe('Agent was working on OAuth fix')
      expect(sbar.background).toBe('payment-service repo, 4 files modified')
      expect(sbar.assessment).toBe('Completed 70% of task, tests passing')
      expect(sbar.recommendation).toContain('continue OAuth')
      expect(sbar.createdAt).toBeTruthy()
    })
  })

  describe('getSBARByAgentId', () => {
    it('returns null when no SBAR exists', () => {
      const result = getSBARByAgentId(db, 'agent-1')
      expect(result).toBeNull()
    })

    it('returns the most recent SBAR for an agent', () => {
      insertSBAR(db, {
        agentId: 'agent-1',
        agentName: 'Test Agent',
        repoId: 'repo-1',
        situation: 'First attempt',
        background: 'bg',
        assessment: 'assessment',
        recommendation: 'rec'
      })

      insertSBAR(db, {
        agentId: 'agent-1',
        agentName: 'Test Agent',
        repoId: 'repo-1',
        situation: 'Second attempt',
        background: 'bg2',
        assessment: 'assessment2',
        recommendation: 'rec2'
      })

      const result = getSBARByAgentId(db, 'agent-1')
      expect(result).not.toBeNull()
      expect(result!.situation).toBe('Second attempt')
    })

    it('returns null for different agent', () => {
      insertSBAR(db, {
        agentId: 'agent-1',
        agentName: 'Test Agent',
        repoId: 'repo-1',
        situation: 's',
        background: 'b',
        assessment: 'a',
        recommendation: 'r'
      })

      const result = getSBARByAgentId(db, 'agent-2')
      expect(result).toBeNull()
    })
  })

  describe('getAllSBARs', () => {
    it('returns empty array when none exist', () => {
      expect(getAllSBARs(db)).toEqual([])
    })

    it('returns all SBARs ordered by created_at desc', () => {
      insertSBAR(db, {
        agentId: 'agent-1',
        agentName: 'Agent 1',
        repoId: 'repo-1',
        situation: 'First',
        background: 'b',
        assessment: 'a',
        recommendation: 'r'
      })

      insertSBAR(db, {
        agentId: 'agent-2',
        agentName: 'Agent 2',
        repoId: 'repo-1',
        situation: 'Second',
        background: 'b',
        assessment: 'a',
        recommendation: 'r'
      })

      const all = getAllSBARs(db)
      expect(all).toHaveLength(2)
      expect(all[0].situation).toBe('Second')
      expect(all[1].situation).toBe('First')
    })
  })

  describe('deleteSBAR', () => {
    it('deletes an SBAR by id', () => {
      const sbar = insertSBAR(db, {
        agentId: 'agent-1',
        agentName: 'Test',
        repoId: 'repo-1',
        situation: 's',
        background: 'b',
        assessment: 'a',
        recommendation: 'r'
      })

      deleteSBAR(db, sbar.id)
      expect(getSBARByAgentId(db, 'agent-1')).toBeNull()
    })
  })
})
