import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => { db.close() })

describe('migration 048 — claude_session_id on agents', () => {
  it('adds claude_session_id column of type TEXT to agents table', () => {
    const columns = db.prepare("PRAGMA table_info(agents)").all() as Array<{
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }>
    const col = columns.find((c) => c.name === 'claude_session_id')
    expect(col).toBeDefined()
    expect(col!.type).toBe('TEXT')
  })

  it('allows inserting an agent with a claude_session_id value', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, created_at, updated_at, status, confidence, claude_session_id)
       VALUES ('a1', 'r1', 'Agent', '/tmp', 'claude-sonnet-4-6', 'anthropic', 'medium', 'task', '#3B82F6', 'native', 'off', datetime('now'), datetime('now'), 'spawning', 'unknown', 'abc-uuid-test')`
    ).run()
    const row = db.prepare('SELECT claude_session_id FROM agents WHERE id = ?').get('a1') as { claude_session_id: string }
    expect(row.claude_session_id).toBe('abc-uuid-test')
  })

  it('allows null claude_session_id (default)', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r2', 'test2', '/tmp/test2')").run()
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, created_at, updated_at, status, confidence)
       VALUES ('a2', 'r2', 'Agent2', '/tmp', 'claude-sonnet-4-6', 'anthropic', 'medium', 'task', '#3B82F6', 'native', 'off', datetime('now'), datetime('now'), 'spawning', 'unknown')`
    ).run()
    const row = db.prepare('SELECT claude_session_id FROM agents WHERE id = ?').get('a2') as { claude_session_id: string | null }
    expect(row.claude_session_id).toBeNull()
  })
})
