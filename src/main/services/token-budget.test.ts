import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { TokenBudgetTracker } from './token-budget'

// electron-log/main is an Electron boundary — mock it so vitest (Node) can import it
vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

let db: Database.Database
let tracker: TokenBudgetTracker

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  tracker = new TokenBudgetTracker(db)
})

afterEach(() => {
  db.close()
})

// ─── getDailyBudget ──────────────────────────────────────────────────────────

describe('getDailyBudget', () => {
  it('returns 500000 by default when no setting exists', () => {
    expect(tracker.getDailyBudget()).toBe(500_000)
  })

  it('returns the value from settings when tokenDailyBudget is set', () => {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('tokenDailyBudget', '200000')"
    ).run()
    expect(tracker.getDailyBudget()).toBe(200_000)
  })

  it('returns default when setting value is not a valid number', () => {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('tokenDailyBudget', 'notanumber')"
    ).run()
    expect(tracker.getDailyBudget()).toBe(500_000)
  })
})

// ─── getUsedToday ────────────────────────────────────────────────────────────

describe('getUsedToday', () => {
  it('returns 0 when no usage recorded', () => {
    expect(tracker.getUsedToday()).toBe(0)
  })

  it('sums actual_tokens for today', () => {
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u1', 't1', null, ?, 1000, 900)`
    ).run(today)
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u2', 't2', null, ?, 500, 400)`
    ).run(today)
    expect(tracker.getUsedToday()).toBe(1300)
  })

  it('falls back to estimated_tokens when actual_tokens is null', () => {
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u3', 't3', null, ?, 600, NULL)`
    ).run(today)
    expect(tracker.getUsedToday()).toBe(600)
  })

  it('does not count rows from other dates', () => {
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u4', 't4', null, '2020-01-01', 99999, 99999)`
    ).run()
    expect(tracker.getUsedToday()).toBe(0)
  })
})

// ─── canAfford ───────────────────────────────────────────────────────────────

describe('canAfford', () => {
  it('returns true when no usage and budget is default', () => {
    expect(tracker.canAfford(10_000)).toBe(true)
  })

  it('returns false when estimated pushes total over budget', () => {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('tokenDailyBudget', '1000')"
    ).run()
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u5', 't5', null, ?, 900, 900)`
    ).run(today)
    // 900 used + 200 estimated = 1100 > 1000
    expect(tracker.canAfford(200)).toBe(false)
  })

  it('returns true when used + estimated equals budget exactly', () => {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('tokenDailyBudget', '1000')"
    ).run()
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES ('u6', 't6', null, ?, 500, 500)`
    ).run(today)
    // 500 used + 500 estimated = 1000 = budget → still affordable (<=)
    expect(tracker.canAfford(500)).toBe(true)
  })
})

// ─── getWarningLevel ─────────────────────────────────────────────────────────

describe('getWarningLevel', () => {
  function setUsage(tokens: number): void {
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens)
       VALUES (?, 'tx', null, ?, ?, ?)`
    ).run(`u-${tokens}-${Date.now()}`, today, tokens, tokens)
  }

  beforeEach(() => {
    // Fix budget at exactly 100 000 for predictable percentages
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('tokenDailyBudget', '100000')"
    ).run()
  })

  it('returns ok at 0% usage', () => {
    expect(tracker.getWarningLevel()).toBe('ok')
  })

  it('returns warn at 70% usage', () => {
    setUsage(70_000)
    expect(tracker.getWarningLevel()).toBe('warn')
  })

  it('returns critical at 80% usage', () => {
    setUsage(80_000)
    expect(tracker.getWarningLevel()).toBe('critical')
  })

  it('returns blocked at 100% usage', () => {
    setUsage(100_000)
    expect(tracker.getWarningLevel()).toBe('blocked')
  })

  it('returns ok below 70%', () => {
    setUsage(50_000)
    expect(tracker.getWarningLevel()).toBe('ok')
  })
})

// ─── recordUsage + getUsedToday ──────────────────────────────────────────────

describe('recordUsage', () => {
  it('inserts a row and getUsedToday reflects it', () => {
    tracker.recordUsage('task-1', 'skill-a', 1500, 1200, 'claude-sonnet-4-6', 'anthropic')
    expect(tracker.getUsedToday()).toBe(1200)
  })

  it('inserts a row using estimated when actual is undefined', () => {
    tracker.recordUsage('task-2', null, 800)
    expect(tracker.getUsedToday()).toBe(800)
  })

  it('accumulates multiple recordUsage calls', () => {
    tracker.recordUsage('task-3', 'skill-b', 1000, 900)
    tracker.recordUsage('task-4', 'skill-b', 500, 400)
    expect(tracker.getUsedToday()).toBe(1300)
  })
})

// ─── getAdaptiveCeiling ──────────────────────────────────────────────────────

describe('getAdaptiveCeiling', () => {
  it('returns 50000 when no history for the skill', () => {
    expect(tracker.getAdaptiveCeiling('unknown-skill')).toBe(50_000)
  })

  it('returns average of last 5 actuals * 1.2 when history exists', () => {
    // Record 3 runs with known actuals
    tracker.recordUsage('t1', 'skill-x', 1000, 10_000)
    tracker.recordUsage('t2', 'skill-x', 1000, 20_000)
    tracker.recordUsage('t3', 'skill-x', 1000, 30_000)
    // avg = (10000 + 20000 + 30000) / 3 = 20000; * 1.2 = 24000
    expect(tracker.getAdaptiveCeiling('skill-x')).toBe(24_000)
  })

  it('does not mix in rows from other skills', () => {
    tracker.recordUsage('t1', 'skill-x', 1000, 10_000)
    tracker.recordUsage('t2', 'skill-y', 1000, 99_000)
    // Only skill-x history used
    expect(tracker.getAdaptiveCeiling('skill-x')).toBe(12_000)
  })

  it('caps lookback at 5 rows even when more exist', () => {
    for (let i = 0; i < 10; i++) {
      tracker.recordUsage(`t${i}`, 'skill-z', 1000, 10_000)
    }
    // All actuals are 10000, avg = 10000, * 1.2 = 12000
    expect(tracker.getAdaptiveCeiling('skill-z')).toBe(12_000)
  })
})
