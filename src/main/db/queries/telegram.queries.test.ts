import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  getTelegramAllowedUser,
  insertTelegramAllowedUser,
  clearTelegramAllowlist,
  getTelegramPrefs,
  setTelegramPref,
} from './telegram.queries'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

function buildTestDb(): Database.Database {
  const db = new Database(':memory:')
  // Run init migration first
  const init = readFileSync(
    join(__dirname, '../migrations/001-init.sql'),
    'utf-8'
  )
  db.exec(init)
  const telegram = readFileSync(
    join(__dirname, '../migrations/025-telegram.sql'),
    'utf-8'
  )
  db.exec(telegram)
  return db
}

describe('telegram queries', () => {
  let db: Database.Database

  beforeEach(() => { db = buildTestDb() })
  afterEach(() => { db.close() })

  it('returns null when no user linked', () => {
    expect(getTelegramAllowedUser(db)).toBeNull()
  })

  it('inserts and retrieves allowed user', () => {
    insertTelegramAllowedUser(db, 123456789, 123456789)
    const user = getTelegramAllowedUser(db)
    expect(user?.telegram_user_id).toBe(123456789)
    expect(user?.chat_id).toBe(123456789)
  })

  it('clears allowlist', () => {
    insertTelegramAllowedUser(db, 123456789, 123456789)
    clearTelegramAllowlist(db)
    expect(getTelegramAllowedUser(db)).toBeNull()
  })

  it('returns default prefs when none set', () => {
    const prefs = getTelegramPrefs(db)
    expect(prefs.notify_completed).toBe(true)
    expect(prefs.notify_failed).toBe(true)
    expect(prefs.notify_awaiting_approval).toBe(true)
    expect(prefs.notify_needs_input).toBe(true)
  })

  it('updates a single pref without clobbering others', () => {
    setTelegramPref(db, 'notify_completed', false)
    const prefs = getTelegramPrefs(db)
    expect(prefs.notify_completed).toBe(false)
    expect(prefs.notify_failed).toBe(true)
  })
})
