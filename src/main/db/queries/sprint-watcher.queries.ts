import type Database from 'better-sqlite3'

export function getRepoExistsById(db: Database.Database, repoId: string): boolean {
  const row = db.prepare('SELECT id FROM repos WHERE id = ?').get(repoId) as { id: string } | undefined
  return row !== undefined
}

export function getSprintTaskCount(db: Database.Database, sprintName: string, repoId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) as c FROM tasks WHERE sprint_name = ? AND repo_id = ?')
    .get(sprintName, repoId) as { c: number }
  return row.c
}
