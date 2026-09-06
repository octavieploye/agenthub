import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => { db.close() })

describe('migration 047 — files_changed_json on orchestrator_task_log', () => {
  it('adds files_changed_json column (nullable)', () => {
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      "INSERT INTO tasks (id, repo_id, title, status) VALUES ('t1', 'r1', 'Test', 'in_progress')"
    ).run()
    db.prepare(
      "INSERT INTO orchestrator_runs (id, sprint_name, repo_id, status, concurrency_cap, telegram_notify, created_at, updated_at) VALUES ('run1', 'sprint', 'r1', 'running', 3, 0, datetime('now'), datetime('now'))"
    ).run()

    // Insert with files_changed_json = NULL (default)
    db.prepare(
      "INSERT INTO orchestrator_task_log (id, run_id, task_id, phase, status, created_at, updated_at) VALUES ('log1', 'run1', 't1', 'dev', 'done', datetime('now'), datetime('now'))"
    ).run()
    const nullRow = db.prepare('SELECT files_changed_json FROM orchestrator_task_log WHERE id = ?').get('log1') as { files_changed_json: string | null }
    expect(nullRow.files_changed_json).toBeNull()

    // Update with valid JSON
    const files = JSON.stringify(['src/foo.ts', 'src/bar.ts'])
    db.prepare("UPDATE orchestrator_task_log SET files_changed_json = ? WHERE id = 'log1'").run(files)
    const jsonRow = db.prepare('SELECT files_changed_json FROM orchestrator_task_log WHERE id = ?').get('log1') as { files_changed_json: string }
    expect(jsonRow.files_changed_json).toBe(files)
    expect(JSON.parse(jsonRow.files_changed_json)).toEqual(['src/foo.ts', 'src/bar.ts'])
  })
})
