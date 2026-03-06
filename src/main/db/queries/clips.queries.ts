import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'

export interface Clip {
  id: string
  title: string
  description: string
  prompt: string
  defaultRepoId: string | null
  launchCount: number
  lastUsedAt: string | null
  createdAt: string
}

export interface InsertClipData {
  title: string
  description: string
  prompt: string
  defaultRepoId?: string
}

function mapRow(row: Record<string, unknown>): Clip {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    prompt: row.prompt as string,
    defaultRepoId: (row.default_repo_id as string) ?? null,
    launchCount: (row.launch_count as number) ?? 0,
    lastUsedAt: (row.last_used_at as string) ?? null,
    createdAt: row.created_at as string
  }
}

export function getAllClips(db: Database.Database): Clip[] {
  const rows = db.prepare('SELECT * FROM clips ORDER BY created_at DESC').all()
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getClipById(db: Database.Database, id: string): Clip | null {
  const row = db.prepare('SELECT * FROM clips WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapRow(row) : null
}

export function insertClip(db: Database.Database, data: InsertClipData): Clip {
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO clips (id, title, description, prompt, default_repo_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.title, data.description, data.prompt, data.defaultRepoId ?? null, now)

  log.info('Clip inserted', { id, title: data.title })
  return {
    id,
    title: data.title,
    description: data.description,
    prompt: data.prompt,
    defaultRepoId: data.defaultRepoId ?? null,
    launchCount: 0,
    lastUsedAt: null,
    createdAt: now
  }
}

export function updateClip(
  db: Database.Database,
  id: string,
  data: Partial<InsertClipData>
): Clip | null {
  const existing = getClipById(db, id)
  if (!existing) return null

  const title = data.title ?? existing.title
  const description = data.description ?? existing.description
  const prompt = data.prompt ?? existing.prompt
  const defaultRepoId = data.defaultRepoId ?? existing.defaultRepoId

  db.prepare(
    'UPDATE clips SET title = ?, description = ?, prompt = ?, default_repo_id = ? WHERE id = ?'
  ).run(title, description, prompt, defaultRepoId, id)

  log.debug('Clip updated', { id })
  return getClipById(db, id)
}

export function deleteClip(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM clips WHERE id = ?').run(id)
  log.info('Clip deleted', { id })
}

export function recordClipLaunch(db: Database.Database, id: string): void {
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE clips SET launch_count = launch_count + 1, last_used_at = ? WHERE id = ?'
  ).run(now, id)
  log.debug('Clip launch recorded', { id })
}
