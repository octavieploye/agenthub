import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { TelegramNotificationPrefs } from '../../../shared/types/telegram.types'

export function getTelegramAllowedUser(
  db: Database.Database
): { telegram_user_id: number; chat_id: number } | null {
  return (db.prepare(
    'SELECT telegram_user_id, chat_id FROM telegram_allowlist LIMIT 1'
  ).get() as { telegram_user_id: number; chat_id: number } | undefined) ?? null
}

export function insertTelegramAllowedUser(
  db: Database.Database,
  telegramUserId: number,
  chatId: number
): void {
  db.prepare(
    `INSERT OR IGNORE INTO telegram_allowlist
       (id, telegram_user_id, chat_id, role, added_at, added_by)
     VALUES (?, ?, ?, 'operator', datetime('now'), 'first_run')`
  ).run(randomUUID(), telegramUserId, chatId)
}

export function clearTelegramAllowlist(db: Database.Database): void {
  db.prepare('DELETE FROM telegram_allowlist').run()
}

export function getTelegramPrefs(
  db: Database.Database
): TelegramNotificationPrefs {
  const row = db.prepare(
    'SELECT * FROM telegram_notification_prefs WHERE id = ?'
  ).get('singleton') as Record<string, number> | undefined

  if (!row) {
    // Insert defaults on first read
    db.prepare(
      `INSERT OR IGNORE INTO telegram_notification_prefs
         (id, notify_completed, notify_failed, notify_awaiting_approval, notify_needs_input, updated_at)
       VALUES ('singleton', 1, 1, 1, 1, datetime('now'))`
    ).run()
    return { notify_completed: true, notify_failed: true, notify_awaiting_approval: true, notify_needs_input: true }
  }

  return {
    notify_completed: Boolean(row['notify_completed']),
    notify_failed: Boolean(row['notify_failed']),
    notify_awaiting_approval: Boolean(row['notify_awaiting_approval']),
    notify_needs_input: Boolean(row['notify_needs_input']),
  }
}

export function setTelegramPref(
  db: Database.Database,
  key: keyof TelegramNotificationPrefs,
  value: boolean
): void {
  const col = key // key is already a valid column name
  db.prepare(
    `INSERT INTO telegram_notification_prefs (id, ${col}, notify_completed, notify_failed,
       notify_awaiting_approval, notify_needs_input, updated_at)
     VALUES ('singleton', ?, 1, 1, 1, 1, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET ${col} = excluded.${col}, updated_at = excluded.updated_at`
  ).run(value ? 1 : 0)
}
