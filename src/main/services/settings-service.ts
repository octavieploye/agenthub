import { app } from 'electron'
import type Database from 'better-sqlite3'
import type { SettingsExport } from '../../shared/types/settings.types'

interface SettingsServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
}

export class SettingsService {
  private db: Database.Database
  private deps: SettingsServiceDeps

  constructor(db: Database.Database, deps: SettingsServiceDeps) {
    this.db = db
    this.deps = deps
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    const result: Record<string, string> = {}
    for (const row of rows) {
      result[row.key] = row.value
    }
    return result
  }

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
    this.deps.logInfo('Setting updated', { key })
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }

  exportSettings(): SettingsExport {
    return {
      version: app.getVersion(),
      exportedAt: new Date().toISOString(),
      settings: this.getAll()
    }
  }

  importSettings(data: SettingsExport): void {
    const insert = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    const transaction = this.db.transaction((entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) {
        insert.run(key, value)
      }
    })
    transaction(data.settings)
    this.deps.logInfo('Settings imported', { count: Object.keys(data.settings).length })
  }
}
