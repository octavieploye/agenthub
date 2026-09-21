// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  isOrchestratorEnabled,
  getApprovalWindowMinutes,
  getMaxConcurrentRuns,
  ORCHESTRATOR_ENABLED_KEY,
  APPROVAL_WINDOW_MINUTES_KEY,
  MAX_CONCURRENT_RUNS_KEY,
} from './orchestrator-settings'

let db: Database.Database

function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

beforeEach(() => {
  db = new Database(':memory:')
  db.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
})

afterEach(() => {
  db.close()
})

describe('isOrchestratorEnabled', () => {
  it('returns false when setting is absent', () => {
    expect(isOrchestratorEnabled(db)).toBe(false)
  })

  it('returns true when setting is "true"', () => {
    setSetting(ORCHESTRATOR_ENABLED_KEY, 'true')
    expect(isOrchestratorEnabled(db)).toBe(true)
  })

  it('returns false when setting is "false"', () => {
    setSetting(ORCHESTRATOR_ENABLED_KEY, 'false')
    expect(isOrchestratorEnabled(db)).toBe(false)
  })

  it('returns false for any other string value', () => {
    setSetting(ORCHESTRATOR_ENABLED_KEY, '1')
    expect(isOrchestratorEnabled(db)).toBe(false)
  })
})

describe('getApprovalWindowMinutes', () => {
  it('returns 30 when setting is absent', () => {
    expect(getApprovalWindowMinutes(db)).toBe(30)
  })

  it('returns the parsed integer for a valid positive value', () => {
    setSetting(APPROVAL_WINDOW_MINUTES_KEY, '60')
    expect(getApprovalWindowMinutes(db)).toBe(60)
  })

  it('returns 30 when setting is "0"', () => {
    setSetting(APPROVAL_WINDOW_MINUTES_KEY, '0')
    expect(getApprovalWindowMinutes(db)).toBe(30)
  })

  it('returns 30 when setting is negative', () => {
    setSetting(APPROVAL_WINDOW_MINUTES_KEY, '-5')
    expect(getApprovalWindowMinutes(db)).toBe(30)
  })

  it('returns 30 when setting is non-numeric', () => {
    setSetting(APPROVAL_WINDOW_MINUTES_KEY, 'never')
    expect(getApprovalWindowMinutes(db)).toBe(30)
  })
})

describe('getMaxConcurrentRuns', () => {
  it('returns 1 when setting is absent', () => {
    expect(getMaxConcurrentRuns(db)).toBe(1)
  })

  it('returns the parsed integer for a valid positive value', () => {
    setSetting(MAX_CONCURRENT_RUNS_KEY, '3')
    expect(getMaxConcurrentRuns(db)).toBe(3)
  })

  it('returns 1 when setting is "0"', () => {
    setSetting(MAX_CONCURRENT_RUNS_KEY, '0')
    expect(getMaxConcurrentRuns(db)).toBe(1)
  })

  it('returns 1 when setting is negative', () => {
    setSetting(MAX_CONCURRENT_RUNS_KEY, '-2')
    expect(getMaxConcurrentRuns(db)).toBe(1)
  })

  it('returns 1 when setting is non-numeric', () => {
    setSetting(MAX_CONCURRENT_RUNS_KEY, 'many')
    expect(getMaxConcurrentRuns(db)).toBe(1)
  })
})
