import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => { db.close() })

describe('migration 050 — session_id on agents', () => {
  it('adds session_id column to agents table', () => {
    const columns = db.prepare("PRAGMA table_info(agents)").all() as Array<{
      name: string
      type: string
    }>
    const col = columns.find((c) => c.name === 'session_id')
    expect(col).toBeDefined()
    expect(col!.type).toBe('TEXT')
  })

  it('allows null session_id (default for existing agents)', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, created_at, updated_at)
       VALUES ('a1', 'r1', 'test', '/tmp', 'claude-sonnet-4-6', 'anthropic', 'medium', '', '#3B82F6', 'native', 'always_on', datetime('now'), datetime('now'))`
    ).run()
    const row = db.prepare('SELECT session_id FROM agents WHERE id = ?').get('a1') as { session_id: string | null }
    expect(row.session_id).toBeNull()
  })

  it('allows setting session_id to a valid session', () => {
    db.prepare("INSERT INTO sessions (id) VALUES ('sess-1')").run()
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, cwd, model, provider, effort_level, task_description, color, execution_mode, voice_mode, session_id, created_at, updated_at)
       VALUES ('a2', 'r1', 'test', '/tmp', 'claude-sonnet-4-6', 'anthropic', 'medium', '', '#3B82F6', 'native', 'always_on', 'sess-1', datetime('now'), datetime('now'))`
    ).run()
    const row = db.prepare('SELECT session_id FROM agents WHERE id = ?').get('a2') as { session_id: string }
    expect(row.session_id).toBe('sess-1')
  })
})
