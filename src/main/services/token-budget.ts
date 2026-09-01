import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'

const DEFAULT_DAILY_BUDGET = 500_000
const DEFAULT_ADAPTIVE_CEILING = 50_000
const ADAPTIVE_HISTORY_LIMIT = 5
const ADAPTIVE_SAFETY_FACTOR = 1.2

export class TokenBudgetTracker {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getDailyBudget(): number {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('tokenDailyBudget') as { value: string } | undefined
    if (!row) return DEFAULT_DAILY_BUDGET
    const parsed = parseInt(row.value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_BUDGET
  }

  getUsedToday(): number {
    const today = new Date().toISOString().slice(0, 10)
    const row = this.db
      .prepare(
        `SELECT SUM(COALESCE(actual_tokens, estimated_tokens)) AS total
         FROM token_usage
         WHERE date = ?`
      )
      .get(today) as { total: number | null }
    return row?.total ?? 0
  }

  canAfford(estimated: number): boolean {
    return this.getUsedToday() + estimated <= this.getDailyBudget()
  }

  getWarningLevel(): 'ok' | 'warn' | 'critical' | 'blocked' {
    const budget = this.getDailyBudget()
    if (budget === 0) return 'blocked'
    const pct = this.getUsedToday() / budget
    if (pct >= 1.0) return 'blocked'
    if (pct >= 0.8) return 'critical'
    if (pct >= 0.7) return 'warn'
    return 'ok'
  }

  recordUsage(
    taskId: string,
    skillId: string | null,
    estimated: number,
    actual?: number,
    model?: string,
    provider?: string
  ): void {
    const today = new Date().toISOString().slice(0, 10)
    this.db
      .prepare(
        `INSERT INTO token_usage (id, task_id, skill_id, date, estimated_tokens, actual_tokens, model, provider)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        taskId,
        skillId ?? null,
        today,
        estimated,
        actual ?? null,
        model ?? null,
        provider ?? null
      )
  }

  getAdaptiveCeiling(skillId: string): number {
    const rows = this.db
      .prepare(
        `SELECT actual_tokens FROM token_usage
         WHERE skill_id = ? AND actual_tokens IS NOT NULL
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(skillId, ADAPTIVE_HISTORY_LIMIT) as { actual_tokens: number }[]
    if (rows.length === 0) return DEFAULT_ADAPTIVE_CEILING
    const avg = rows.reduce((sum, r) => sum + r.actual_tokens, 0) / rows.length
    return Math.round(avg * ADAPTIVE_SAFETY_FACTOR)
  }
}
