import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type { RepoConfig } from '../../../shared/types/config.types'
import type Database from 'better-sqlite3'

function mapRow(row: Record<string, unknown>): RepoConfig {
  return {
    id: row.id as string,
    name: row.name as string,
    path: row.path as string,
    glowColor: (row.glow_color as string) ?? undefined,
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string) ?? undefined
  }
}

export function getAllRepos(db: Database.Database): RepoConfig[] {
  const rows = db.prepare('SELECT * FROM repos ORDER BY created_at DESC').all()
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getRepoById(db: Database.Database, id: string): RepoConfig | null {
  const row = db.prepare('SELECT * FROM repos WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapRow(row) : null
}

export function insertRepo(
  db: Database.Database,
  repo: { name: string; path: string; glowColor?: string }
): RepoConfig {
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare('INSERT INTO repos (id, name, path, glow_color, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    repo.name,
    repo.path,
    repo.glowColor ?? null,
    now
  )

  log.info('Repo inserted', { id, name: repo.name })
  return { id, name: repo.name, path: repo.path, glowColor: repo.glowColor, createdAt: now }
}

export function getRepoByPath(db: Database.Database, path: string): RepoConfig | null {
  const row = db.prepare('SELECT * FROM repos WHERE path = ?').get(path) as
    | Record<string, unknown>
    | undefined
  return row ? mapRow(row) : null
}

export function deleteRepo(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM repos WHERE id = ?').run(id)
  log.info('Repo deleted', { id })
}

export function updateRepoLastUsed(db: Database.Database, id: string): void {
  db.prepare('UPDATE repos SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id)
}

export function updateRepoGlowColor(db: Database.Database, id: string, glowColor: string): void {
  db.prepare('UPDATE repos SET glow_color = ? WHERE id = ?').run(glowColor, id)
}
