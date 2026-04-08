import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { generateSBAR, createAndStoreSBAR, type AgentContext } from './sbar-generator'
import { getSBARByAgentId } from '../db/queries/sbar.queries'
import type { AgentState } from '../../shared/types/agent.types'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(join(__dirname, '../db/migrations/001-init.sql'), 'utf-8'))
  db.exec(readFileSync(join(__dirname, '../db/migrations/003-snapshots-update.sql'), 'utf-8'))
  db.prepare("INSERT INTO repos (id, name, path) VALUES ('repo-1', 'test-repo', '/tmp/test')").run()
  db.prepare("INSERT INTO agents (id, repo_id, name, cwd) VALUES ('agent-1', 'repo-1', 'OAuth Agent', '/tmp/test')").run()
  return db
}

function createAgent(overrides?: Partial<AgentState>): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'OAuth Agent',
    status: 'interrupted',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    taskDescription: 'Fix OAuth refresh token handling',
    pid: 1234,
    ptyFd: null,
    cwd: '/tmp/test/payment-service',
    progress: 65,
    effortLevel: 'medium' as const,
    color: '#3B82F6',
    executionMode: 'native' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

function createContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    agent: createAgent(),
    ...overrides
  }
}

describe('sbar-generator', () => {
  describe('generateSBAR', () => {
    it('generates all four SBAR sections', () => {
      const result = generateSBAR(createContext())

      expect(result.agentId).toBe('agent-1')
      expect(result.agentName).toBe('OAuth Agent')
      expect(result.repoId).toBe('repo-1')
      expect(result.situation).toBeTruthy()
      expect(result.background).toBeTruthy()
      expect(result.assessment).toBeTruthy()
      expect(result.recommendation).toBeTruthy()
    })

    describe('situation', () => {
      it('includes agent name and task description', () => {
        const result = generateSBAR(createContext())
        expect(result.situation).toContain('OAuth Agent')
        expect(result.situation).toContain('Fix OAuth refresh token handling')
      })

      it('describes the agent status', () => {
        const result = generateSBAR(createContext({
          agent: createAgent({ status: 'busy' })
        }))
        expect(result.situation).toContain('actively working')
      })

      it('handles missing task description', () => {
        const result = generateSBAR(createContext({
          agent: createAgent({ taskDescription: '' })
        }))
        expect(result.situation).toContain('unspecified task')
      })
    })

    describe('background', () => {
      it('includes repo, cwd, model, and progress', () => {
        const result = generateSBAR(createContext())
        expect(result.background).toContain('repo-1')
        expect(result.background).toContain('/tmp/test/payment-service')
        expect(result.background).toContain('claude-sonnet-4-20250514')
        expect(result.background).toContain('65%')
      })

      it('includes elapsed time when provided', () => {
        const result = generateSBAR(createContext({ elapsedMinutes: 12 }))
        expect(result.background).toContain('12 minutes')
      })

      it('includes files modified when provided', () => {
        const result = generateSBAR(createContext({
          filesModified: ['auth.ts', 'token.ts', 'test.ts']
        }))
        expect(result.background).toContain('Files modified (3)')
        expect(result.background).toContain('auth.ts')
      })
    })

    describe('assessment', () => {
      it('includes last known status and confidence', () => {
        const result = generateSBAR(createContext())
        expect(result.assessment).toContain('interrupted')
        expect(result.assessment).toContain('confirmed')
      })

      it('includes errors when provided', () => {
        const result = generateSBAR(createContext({
          errorsEncountered: ['TypeError: undefined', 'SyntaxError: unexpected token']
        }))
        expect(result.assessment).toContain('Errors encountered (2)')
        expect(result.assessment).toContain('TypeError')
      })

      it('limits errors to last 3', () => {
        const result = generateSBAR(createContext({
          errorsEncountered: ['e1', 'e2', 'e3', 'e4', 'e5']
        }))
        expect(result.assessment).toContain('Errors encountered (5)')
        expect(result.assessment).toContain('e3')
        expect(result.assessment).toContain('e5')
        expect(result.assessment).not.toContain('e1')
      })

      it('includes last output lines when provided', () => {
        const result = generateSBAR(createContext({
          lastOutputLines: ['Running tests...', 'PASS: 5/5']
        }))
        expect(result.assessment).toContain('Running tests...')
        expect(result.assessment).toContain('PASS: 5/5')
      })
    })

    describe('recommendation', () => {
      it('recommends review for completed agents', () => {
        const result = generateSBAR(createContext({
          agent: createAgent({ status: 'completed' })
        }))
        expect(result.recommendation).toContain('Review output')
      })

      it('recommends restart for looping agents', () => {
        const result = generateSBAR(createContext({
          agent: createAgent({ status: 'looping' })
        }))
        expect(result.recommendation).toContain('looping')
        expect(result.recommendation).toContain('more specific prompt')
      })

      it('warns about errors when many encountered', () => {
        const result = generateSBAR(createContext({
          errorsEncountered: ['e1', 'e2', 'e3']
        }))
        expect(result.recommendation).toContain('Review error logs')
      })

      it('recommends providing input for locked agents', () => {
        const result = generateSBAR(createContext({
          agent: createAgent({ status: 'locked' })
        }))
        expect(result.recommendation).toContain('user input')
      })

      it('mentions progress when near completion', () => {
        const result = generateSBAR(createContext({
          agent: createAgent({ progress: 85 })
        }))
        expect(result.recommendation).toContain('85%')
      })

      it('gives generic resume advice for early-stage agents', () => {
        const result = generateSBAR(createContext({
          agent: createAgent({ progress: 30 })
        }))
        expect(result.recommendation).toContain('Resume agent')
      })
    })
  })

  describe('createAndStoreSBAR', () => {
    let db: Database.Database

    beforeEach(() => {
      db = createTestDb()
    })

    it('generates and persists SBAR to database', () => {
      const sbar = createAndStoreSBAR(db, createContext())

      expect(sbar.id).toBeTruthy()
      expect(sbar.agentId).toBe('agent-1')

      const retrieved = getSBARByAgentId(db, 'agent-1')
      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(sbar.id)
      expect(retrieved!.situation).toContain('OAuth Agent')
    })

    it('stores full context in SBAR', () => {
      const sbar = createAndStoreSBAR(db, createContext({
        filesModified: ['auth.ts'],
        errorsEncountered: ['TypeError'],
        lastOutputLines: ['Done'],
        elapsedMinutes: 15
      }))

      expect(sbar.background).toContain('auth.ts')
      expect(sbar.assessment).toContain('TypeError')
    })
  })
})
