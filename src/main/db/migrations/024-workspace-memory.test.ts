import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => { db.close() })

it('projects table has context_doc column after migration 024', () => {
  const info = db.pragma('table_info(projects)') as { name: string }[]
  const cols = info.map(c => c.name)
  expect(cols).toContain('context_doc')
  expect(cols).toContain('context_doc_updated_at')
})

it('workspace_memory table exists after migration 024', () => {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(r => r.name)
  expect(tables).toContain('workspace_memory')
})

it('workspace_memory has correct columns', () => {
  const info = db.pragma('table_info(workspace_memory)') as { name: string }[]
  const cols = info.map(c => c.name)
  expect(cols).toContain('id')
  expect(cols).toContain('project_id')
  expect(cols).toContain('content')
  expect(cols).toContain('source_id')
  expect(cols).toContain('created_at')
  expect(cols).toContain('pinned_at')
  expect(cols).toContain('anamnesis_id')
  expect(cols).toContain('synced_to_anamnesis')
})
