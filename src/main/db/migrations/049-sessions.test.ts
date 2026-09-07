import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => { db.close() })

describe('migration 049 — sessions table', () => {
  it('creates the sessions table with correct columns', () => {
    const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }>
    const colNames = columns.map((c) => c.name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('started_at')
    expect(colNames).toContain('ended_at')
    expect(colNames).toContain('last_heartbeat_at')
    expect(colNames).toContain('close_reason')
  })

  it('id is the primary key', () => {
    const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{
      name: string
      pk: number
    }>
    const idCol = columns.find((c) => c.name === 'id')
    expect(idCol!.pk).toBe(1)
  })

  it('close_reason defaults to unknown', () => {
    db.prepare("INSERT INTO sessions (id) VALUES ('s1')").run()
    const row = db.prepare("SELECT close_reason FROM sessions WHERE id = 's1'").get() as { close_reason: string }
    expect(row.close_reason).toBe('unknown')
  })

  it('started_at has a default value', () => {
    db.prepare("INSERT INTO sessions (id) VALUES ('s2')").run()
    const row = db.prepare("SELECT started_at FROM sessions WHERE id = 's2'").get() as { started_at: string }
    expect(row.started_at).toBeTruthy()
  })

  it('ended_at and last_heartbeat_at are nullable', () => {
    db.prepare("INSERT INTO sessions (id) VALUES ('s3')").run()
    const row = db.prepare("SELECT ended_at, last_heartbeat_at FROM sessions WHERE id = 's3'").get() as {
      ended_at: string | null
      last_heartbeat_at: string | null
    }
    expect(row.ended_at).toBeNull()
    expect(row.last_heartbeat_at).toBeNull()
  })
})
