import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { getDb, closeDb, resetDb } from './connection'

describe('Database Connection', () => {
  beforeEach(() => {
    resetDb()
  })

  afterEach(() => {
    closeDb()
  })

  it('creates an in-memory database', () => {
    const db = getDb(':memory:')
    expect(db).toBeDefined()
    expect(db.open).toBe(true)
  })

  it('sets WAL mode (in-memory falls back to memory journal)', () => {
    const db = getDb(':memory:')
    const mode = db.pragma('journal_mode', { simple: true })
    // In-memory databases cannot use WAL, so SQLite falls back to 'memory'
    expect(mode).toBe('memory')
  })

  it('enables foreign keys', () => {
    const db = getDb(':memory:')
    const fk = db.pragma('foreign_keys', { simple: true })
    expect(fk).toBe(1)
  })

  it('returns the same instance on subsequent calls', () => {
    const db1 = getDb(':memory:')
    const db2 = getDb(':memory:')
    expect(db1).toBe(db2)
  })

  it('runs migrations on init', () => {
    const db = getDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
    const tableNames = tables.map((t) => t.name)
    expect(tableNames).toContain('repos')
    expect(tableNames).toContain('agents')
    expect(tableNames).toContain('tasks')
    expect(tableNames).toContain('clips')
    expect(tableNames).toContain('snapshots')
    expect(tableNames).toContain('settings')
    expect(tableNames).toContain('terminal_output')
  })

  it('sets user_version after migration', () => {
    const db = getDb(':memory:')
    const version = db.pragma('user_version', { simple: true })
    expect(version).toBe(6)
  })
})
