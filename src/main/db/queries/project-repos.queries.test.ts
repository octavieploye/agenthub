import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { linkRepoToProject, unlinkRepoFromProject, getRepoIdsByProject, getProjectsByRepoId } from './project-repos.queries'
import { insertProject } from './projects.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
  // insert a real repo so FK constraint passes
  db.prepare(`INSERT INTO repos (id, name, path, created_at) VALUES ('repo-1', 'agenthub', '/tmp/agenthub', datetime('now'))`).run()
})

afterEach(() => { db.close() })

it('linkRepoToProject creates junction row', () => {
  const p = insertProject(db, { name: 'P1' })
  linkRepoToProject(db, p.id, 'repo-1')
  expect(getRepoIdsByProject(db, p.id)).toContain('repo-1')
})

it('unlinkRepoFromProject removes junction row', () => {
  const p = insertProject(db, { name: 'P1' })
  linkRepoToProject(db, p.id, 'repo-1')
  unlinkRepoFromProject(db, p.id, 'repo-1')
  expect(getRepoIdsByProject(db, p.id)).toHaveLength(0)
})

it('getProjectsByRepoId returns projects that contain the repo', () => {
  const p1 = insertProject(db, { name: 'P1' })
  const p2 = insertProject(db, { name: 'P2' })
  linkRepoToProject(db, p1.id, 'repo-1')
  linkRepoToProject(db, p2.id, 'repo-1')
  const projects = getProjectsByRepoId(db, 'repo-1')
  expect(projects).toHaveLength(2)
})
