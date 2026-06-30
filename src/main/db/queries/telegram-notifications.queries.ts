import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { TelegramNotificationPayload } from '../../../shared/types/telegram.types'

export interface TelegramNotificationRow {
  id: string
  agent_id: string
  agent_name: string
  repo: string
  type: string
  payload_json: string
  status: 'queued' | 'sent' | 'failed' | 'expired'
  attempts: number
  last_error: string | null
  created_at: string
  sent_at: string | null
  expires_at: string | null
}

export interface TelegramNotificationStats {
  sent: number
  queued: number
  failed: number
}

export function insertNotification(
  db: Database.Database,
  payload: TelegramNotificationPayload
): string {
  const id = randomUUID()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  db.prepare(
    `INSERT INTO telegram_notifications
       (id, agent_id, agent_name, repo, type, payload_json, status, attempts, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)`
  ).run(id, payload.agentId, payload.agentName, payload.repo, payload.type, JSON.stringify(payload), now, expiresAt)
  return id
}

export function markSent(db: Database.Database, id: string): void {
  db.prepare(
    `UPDATE telegram_notifications SET status = 'sent', sent_at = datetime('now') WHERE id = ?`
  ).run(id)
}

export function markFailed(db: Database.Database, id: string, error: string): void {
  db.prepare(
    `UPDATE telegram_notifications SET attempts = attempts + 1, last_error = ? WHERE id = ?`
  ).run(error, id)
}

export function markExpired(db: Database.Database, id: string): void {
  db.prepare(
    `UPDATE telegram_notifications SET status = 'expired' WHERE id = ?`
  ).run(id)
}

export function getQueued(db: Database.Database): TelegramNotificationRow[] {
  return db.prepare(
    `SELECT * FROM telegram_notifications
     WHERE status = 'queued' AND attempts < 5 AND expires_at > datetime('now')
     ORDER BY created_at ASC`
  ).all() as TelegramNotificationRow[]
}

export function getByAgent(
  db: Database.Database,
  agentId: string,
  limit = 50
): TelegramNotificationRow[] {
  return db.prepare(
    `SELECT * FROM telegram_notifications WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(agentId, limit) as TelegramNotificationRow[]
}

export function getStats(
  db: Database.Database,
  agentId: string
): TelegramNotificationStats {
  const row = db.prepare(
    `SELECT
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
       SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
       SUM(CASE WHEN status = 'failed' OR status = 'expired' THEN 1 ELSE 0 END) as failed
     FROM telegram_notifications WHERE agent_id = ?`
  ).get(agentId) as { sent: number; queued: number; failed: number } | undefined
  return { sent: row?.sent ?? 0, queued: row?.queued ?? 0, failed: row?.failed ?? 0 }
}

export function isDuplicate(
  db: Database.Database,
  agentId: string,
  type: string
): boolean {
  const row = db.prepare(
    `SELECT 1 FROM telegram_notifications
     WHERE agent_id = ? AND type = ? AND status IN ('queued', 'sent')
       AND created_at > datetime('now', '-5 seconds')
     LIMIT 1`
  ).get(agentId, type)
  return row !== undefined
}
