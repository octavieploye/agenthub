import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { NoteItem, CreateNoteInput } from '../../../shared/types/note.types'

function mapRow(row: Record<string, unknown>): NoteItem {
  return {
    id: row.id as number,
    type: row.type as NoteItem['type'],
    agentId: (row.agent_id as string) ?? null,
    repoPath: (row.repo_path as string) ?? null,
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function getNoteById(db: Database.Database, id: number): NoteItem | null {
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapRow(row) : null
}

export function getScratchNotes(db: Database.Database, agentId: string): NoteItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM notes WHERE type = 'scratch' AND agent_id = ? ORDER BY updated_at DESC`
    )
    .all(agentId)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getRepoNotes(db: Database.Database, repoPath: string): NoteItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM notes WHERE type = 'repo' AND repo_path = ? ORDER BY updated_at DESC`
    )
    .all(repoPath)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getGlobalNotes(db: Database.Database): NoteItem[] {
  const rows = db
    .prepare(`SELECT * FROM notes WHERE type = 'global' ORDER BY updated_at DESC`)
    .all()
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function upsertNote(db: Database.Database, input: CreateNoteInput): NoteItem {
  const now = new Date().toISOString()
  const agentId = input.agentId ?? null
  const repoPath = input.repoPath ?? null

  // Check for existing note with matching type + agentId + repoPath
  const existing = db
    .prepare(
      `SELECT * FROM notes
       WHERE type = ?
         AND (agent_id IS ? OR (agent_id IS NULL AND ? IS NULL))
         AND (repo_path IS ? OR (repo_path IS NULL AND ? IS NULL))`
    )
    .get(input.type, agentId, agentId, repoPath, repoPath) as
    | Record<string, unknown>
    | undefined

  if (existing) {
    const id = existing.id as number
    db.prepare(`UPDATE notes SET content = ?, updated_at = ? WHERE id = ?`).run(
      input.content,
      now,
      id
    )
    log.debug('Note updated', { id, type: input.type })
    return {
      id,
      type: input.type,
      agentId,
      repoPath,
      content: input.content,
      createdAt: existing.created_at as string,
      updatedAt: now
    }
  }

  const result = db
    .prepare(
      `INSERT INTO notes (type, agent_id, repo_path, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(input.type, agentId, repoPath, input.content, now, now)

  const id = Number(result.lastInsertRowid)
  log.info('Note inserted', { id, type: input.type })
  return {
    id,
    type: input.type,
    agentId,
    repoPath,
    content: input.content,
    createdAt: now,
    updatedAt: now
  }
}

export function deleteNote(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  log.info('Note deleted', { id })
}

export function deleteAgentScratchNotes(db: Database.Database, agentId: string): void {
  const result = db
    .prepare(`DELETE FROM notes WHERE type = 'scratch' AND agent_id = ?`)
    .run(agentId)
  log.info('Agent scratch notes deleted', { agentId, count: result.changes })
}
