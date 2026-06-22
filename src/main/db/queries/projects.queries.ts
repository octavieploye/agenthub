import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../../shared/types/project.types'

function mapRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    path: (row.path as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function insertProject(db: Database.Database, input: CreateProjectInput): Project {
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO projects (id, name, description, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.name, input.description ?? null, null, now, now)
  return { id, name: input.name, description: input.description ?? null, path: null, createdAt: now, updatedAt: now }
}

export function getAllProjects(db: Database.Database): Project[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY name ASC').all() as Record<string, unknown>[]
  return rows.map(mapRow)
}

export function getProjectById(db: Database.Database, id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? mapRow(row) : null
}

export function updateProject(db: Database.Database, id: string, input: UpdateProjectInput): Project | null {
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name) }
  if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description) }
  if (input.path !== undefined) { sets.push('path = ?'); values.push(input.path) }

  values.push(id)
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return getProjectById(db, id)
}

export function deleteProject(db: Database.Database, id: string): void {
  const remove = db.transaction(() => {
    db.prepare('DELETE FROM project_repos WHERE project_id = ?').run(id)
    db.prepare('UPDATE tasks SET project_id = NULL WHERE project_id = ?').run(id)
    db.prepare('UPDATE bugs SET project_id = NULL WHERE project_id = ?').run(id)
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  })
  remove()
}
