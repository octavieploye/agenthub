import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { BugEntry, BugSeverity } from '../../../shared/types/bug-radar.types'
import { insertActivityEvent } from './activity.queries'

interface InsertBugData {
  agentId: string
  agentName: string
  repoId: string
  repoName: string
  errorType: string
  filePath: string
  message: string
  severity: BugSeverity
}

function mapRow(row: Record<string, unknown>): BugEntry {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    agentName: row.agent_name as string,
    repoId: row.repo_id as string,
    repoName: row.repo_name as string,
    errorType: row.error_type as string,
    filePath: row.file_path as string,
    message: row.message as string,
    severity: row.severity as BugSeverity,
    resolvedAt: (row.resolved_at as string) ?? null,
    createdAt: row.created_at as string
  }
}

export function insertBug(db: Database.Database, data: InsertBugData): BugEntry {
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO bugs (id, agent_id, agent_name, repo_id, repo_name, error_type, file_path, message, severity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.agentId, data.agentName, data.repoId, data.repoName, data.errorType, data.filePath, data.message, data.severity, now)

  log.info('Bug inserted', { id, errorType: data.errorType })
  insertActivityEvent(db, {
    eventType: 'bug_created',
    entityType: 'bug',
    entityId: id,
    repoId: data.repoId,
    agentId: data.agentId,
    details: { severity: data.severity, errorType: data.errorType }
  })

  return {
    id,
    agentId: data.agentId,
    agentName: data.agentName,
    repoId: data.repoId,
    repoName: data.repoName,
    errorType: data.errorType,
    filePath: data.filePath,
    message: data.message,
    severity: data.severity,
    resolvedAt: null,
    createdAt: now
  }
}

export function getAllBugs(db: Database.Database): BugEntry[] {
  const rows = db.prepare('SELECT * FROM bugs ORDER BY created_at DESC').all()
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getBugsByRepo(db: Database.Database, repoId: string): BugEntry[] {
  const rows = db.prepare('SELECT * FROM bugs WHERE repo_id = ? ORDER BY created_at DESC').all(repoId)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getBugsBySeverity(db: Database.Database, severity: string): BugEntry[] {
  const rows = db.prepare('SELECT * FROM bugs WHERE severity = ? ORDER BY created_at DESC').all(severity)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function resolveBug(db: Database.Database, id: string): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE bugs SET resolved_at = ? WHERE id = ?').run(now, id)
  log.info('Bug resolved', { id })
  insertActivityEvent(db, {
    eventType: 'bug_resolved',
    entityType: 'bug',
    entityId: id,
    details: {}
  })
}

export function deleteBug(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM bugs WHERE id = ?').run(id)
  log.info('Bug deleted', { id })
}

export function getUnresolvedBugs(db: Database.Database): BugEntry[] {
  const rows = db.prepare('SELECT * FROM bugs WHERE resolved_at IS NULL ORDER BY created_at DESC').all()
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}
