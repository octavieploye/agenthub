import Database from 'better-sqlite3'
import log from 'electron-log/main'
import { runMigrations } from './migration-runner'

let db: Database.Database | null = null

export function getDb(dbPath?: string): Database.Database {
  if (db) return db

  const resolvedPath = dbPath ?? ':memory:'
  log.info('Opening database', { path: resolvedPath })

  db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  log.info('Database initialized successfully')
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
    log.info('Database closed')
  }
}

export function resetDb(): void {
  db = null
}
