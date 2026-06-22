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
  deleteAgent,
  resetStaleAgentsOnStartup
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

  it('defaults voiceMode to always_on when not specified', () => {
    const agent = insertAgent(db, { repoId, name: 'voice-default', cwd: '/tmp' })
    expect(agent.voiceMode).toBe('always_on')
    const fromDb = getAgentById(db, agent.id)
    expect(fromDb!.voiceMode).toBe('always_on')
  })

  it('persists explicit voiceMode when provided', () => {
    const agent = insertAgent(db, { repoId, name: 'voice-speak-up', cwd: '/tmp', voiceMode: 'speak_up' })
    expect(agent.voiceMode).toBe('speak_up')
    const fromDb = getAgentById(db, agent.id)
    expect(fromDb!.voiceMode).toBe('speak_up')
  })

  it('persists voiceMode off when explicitly set to off', () => {
    const agent = insertAgent(db, { repoId, name: 'voice-off', cwd: '/tmp', voiceMode: 'off' })
    expect(agent.voiceMode).toBe('off')
    const fromDb = getAgentById(db, agent.id)
    expect(fromDb!.voiceMode).toBe('off')
  })
})

describe('resetStaleAgentsOnStartup', () => {
  let db: Database.Database
  let repoId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    db.prepare(
      `INSERT INTO repos (id, name, path, created_at) VALUES ('r1','test','/tmp','2026-01-01')`
    ).run()
    repoId = 'r1'
  })

  afterEach(() => {
    closeDb()
  })

  it('marks busy and idle agents as interrupted', () => {
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, created_at, updated_at, status, confidence)
      VALUES ('a1',?,'Alpha','/tmp','claude-sonnet-4-6','anthropic','medium','test','#3B82F6','native','off','2026-01-01','2026-01-01','busy','confirmed')`
    ).run(repoId)
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, created_at, updated_at, status, confidence)
      VALUES ('a2',?,'Beta','/tmp','claude-sonnet-4-6','anthropic','medium','test','#10B981','native','off','2026-01-01','2026-01-01','idle','confirmed')`
    ).run(repoId)
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, created_at, updated_at, status, confidence)
      VALUES ('a3',?,'Gamma','/tmp','claude-sonnet-4-6','anthropic','medium','test','#F59E0B','native','off','2026-01-01','2026-01-01','interrupted','confirmed')`
    ).run(repoId)
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, created_at, updated_at, status, confidence)
      VALUES ('a4',?,'Delta','/tmp','claude-sonnet-4-6','anthropic','medium','test','#8B5CF6','native','off','2026-01-01','2026-01-01','completed','confirmed')`
    ).run(repoId)

    resetStaleAgentsOnStartup(db)

    const agents = db
      .prepare('SELECT id, status FROM agents ORDER BY id')
      .all() as Array<{ id: string; status: string }>
    expect(agents).toEqual([
      { id: 'a1', status: 'interrupted' },
      { id: 'a2', status: 'interrupted' },
      { id: 'a3', status: 'interrupted' },
      { id: 'a4', status: 'completed' }
    ])
  })
})
