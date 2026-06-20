import type Database from 'better-sqlite3'
import type { Project } from '../../../shared/types/project.types'
import { getProjectById } from './projects.queries'

export function linkRepoToProject(db: Database.Database, projectId: string, repoId: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO project_repos (project_id, repo_id) VALUES (?, ?)`
  ).run(projectId, repoId)
}

export function unlinkRepoFromProject(db: Database.Database, projectId: string, repoId: string): void {
  db.prepare('DELETE FROM project_repos WHERE project_id = ? AND repo_id = ?').run(projectId, repoId)
}

export function getRepoIdsByProject(db: Database.Database, projectId: string): string[] {
  const rows = db
    .prepare('SELECT repo_id FROM project_repos WHERE project_id = ?')
    .all(projectId) as { repo_id: string }[]
  return rows.map((r) => r.repo_id)
}

export function getProjectsByRepoId(db: Database.Database, repoId: string): Project[] {
  const rows = db
    .prepare('SELECT project_id FROM project_repos WHERE repo_id = ?')
    .all(repoId) as { project_id: string }[]
  return rows.map((r) => getProjectById(db, r.project_id)).filter((p): p is Project => p !== null)
}
