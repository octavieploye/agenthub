import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { getDb, closeDb, resetDb } from '../connection'
import { insertRepo } from './repos.queries'
import {
  getAllAgents,
  getAgentById,
  insertAgent,
  updateAgentStatus,
  updateAgentPid,
  deleteAgent
} from './agents.queries'
import type Database from 'better-sqlite3'

describe('Agents Queries', () => {
  let db: Database.Database
  let repoId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    const repo = insertRepo(db, { name: 'test-repo', path: '/tmp/test-repo' })
    repoId = repo.id
  })

  afterEach(() => {
    closeDb()
  })

  it('returns empty array when no agents exist', () => {
    expect(getAllAgents(db)).toEqual([])
  })

  it('inserts and retrieves an agent', () => {
    const agent = insertAgent(db, {
      repoId,
      name: 'agent-1',
      cwd: '/tmp/test-repo',
      taskDescription: 'Fix bug'
    })

    expect(agent.id).toBeDefined()
    expect(agent.name).toBe('agent-1')
    expect(agent.repoId).toBe(repoId)
    expect(agent.status).toBe('spawning')
    expect(agent.confidence).toBe('unknown')
    expect(agent.model).toBe('claude-sonnet-4-6')
    expect(agent.provider).toBe('anthropic')
    expect(agent.taskDescription).toBe('Fix bug')
    expect(agent.pid).toBeNull()
    expect(agent.progress).toBe(0)
  })

  it('retrieves agent by id', () => {
    const inserted = insertAgent(db, { repoId, name: 'agent-2', cwd: '/tmp/test' })
    const found = getAgentById(db, inserted.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('agent-2')
  })

  it('returns null for non-existent agent', () => {
    expect(getAgentById(db, 'non-existent')).toBeNull()
  })

  it('updates agent status', () => {
    const agent = insertAgent(db, { repoId, name: 'agent-3', cwd: '/tmp/test' })
    updateAgentStatus(db, agent.id, 'busy', 'confirmed')
    const found = getAgentById(db, agent.id)
    expect(found!.status).toBe('busy')
    expect(found!.confidence).toBe('confirmed')
  })

  it('updates agent PID', () => {
    const agent = insertAgent(db, { repoId, name: 'agent-4', cwd: '/tmp/test' })
    updateAgentPid(db, agent.id, 12345, 6)
    const found = getAgentById(db, agent.id)
    expect(found!.pid).toBe(12345)
    expect(found!.ptyFd).toBe(6)
  })

  it('deletes an agent', () => {
    const agent = insertAgent(db, { repoId, name: 'agent-5', cwd: '/tmp/test' })
    deleteAgent(db, agent.id)
    expect(getAgentById(db, agent.id)).toBeNull()
  })

  it('enforces foreign key constraint on repo_id', () => {
    expect(() =>
      insertAgent(db, { repoId: 'non-existent-repo', name: 'bad-agent', cwd: '/tmp' })
    ).toThrow()
  })

  it('lists all agents', () => {
    insertAgent(db, { repoId, name: 'a1', cwd: '/tmp' })
    insertAgent(db, { repoId, name: 'a2', cwd: '/tmp' })
    expect(getAllAgents(db)).toHaveLength(2)
  })
})
