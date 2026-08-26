import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => { db.close() })

describe('migration 041 — codex provider', () => {
  it('allows provider_override = openai-codex on tasks', () => {
    // Seed a repo so the FK is satisfied
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      `INSERT INTO tasks (id, repo_id, title, status, provider_override)
       VALUES ('t1', 'r1', 'Test task', 'backlog', 'openai-codex')`
    ).run()
    const row = db.prepare('SELECT provider_override FROM tasks WHERE id = ?').get('t1') as { provider_override: string }
    expect(row.provider_override).toBe('openai-codex')
  })

  it('rejects invalid provider_override values on tasks', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    expect(() => {
      db.prepare(
        `INSERT INTO tasks (id, repo_id, title, status, provider_override)
         VALUES ('t2', 'r1', 'Bad task', 'backlog', 'invalid-provider')`
      ).run()
    }).toThrow()
  })

  it('allows provider = openai-codex on agents (no CHECK constraint)', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      `INSERT INTO agents (id, repo_id, name, status, confidence, model, provider, cwd)
       VALUES ('a1', 'r1', 'Codex Agent', 'spawning', 'unknown', 'codex', 'openai-codex', '/tmp/test')`
    ).run()
    const row = db.prepare('SELECT provider FROM agents WHERE id = ?').get('a1') as { provider: string }
    expect(row.provider).toBe('openai-codex')
  })

  it('still allows existing provider_override values (anthropic, ollama-local, ollama-cloud)', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    for (const prov of ['anthropic', 'ollama-local', 'ollama-cloud']) {
      const id = `t-${prov}`
      db.prepare(
        `INSERT INTO tasks (id, repo_id, title, status, provider_override)
         VALUES (?, 'r1', 'Task', 'backlog', ?)`
      ).run(id, prov)
      const row = db.prepare('SELECT provider_override FROM tasks WHERE id = ?').get(id) as { provider_override: string }
      expect(row.provider_override).toBe(prov)
    }
  })

  it('still allows NULL provider_override', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      `INSERT INTO tasks (id, repo_id, title, status, provider_override)
       VALUES ('t-null', 'r1', 'Null task', 'backlog', NULL)`
    ).run()
    const row = db.prepare('SELECT provider_override FROM tasks WHERE id = ?').get('t-null') as { provider_override: string | null }
    expect(row.provider_override).toBeNull()
  })
})
