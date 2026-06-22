import Database from 'better-sqlite3'
import log from 'electron-log/main'
import { runMigrations } from './migration-runner'

let db: Database.Database | null = null
let shuttingDown = false

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

/**
 * Returns true once markShuttingDown() has been called.
 * Callers should check this before attempting DB writes
 * during the shutdown window (after cleanupAllAgents but
 * before the process exits).
 */
export function isDbShuttingDown(): boolean {
  return shuttingDown
}

/**
 * Signal that the app is shutting down. Called before
 * cleanupAllAgents so that async onExit handlers know
 * not to attempt DB writes.
 */
export function markShuttingDown(): void {
  shuttingDown = true
  log.info('Database marked as shutting down')
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
  shuttingDown = false
}
