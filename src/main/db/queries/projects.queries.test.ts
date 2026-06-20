import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { insertProject, getAllProjects, getProjectById, updateProject, deleteProject } from './projects.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => {
  db.close()
})

it('insertProject stores and returns project', () => {
  const p = insertProject(db, { name: 'Optimaeus', description: 'Main project' })
  expect(p.id).toBeTruthy()
  expect(p.name).toBe('Optimaeus')
  expect(p.description).toBe('Main project')
  expect(p.createdAt).toBeTruthy()
})

it('getAllProjects returns all projects', () => {
  insertProject(db, { name: 'P1' })
  insertProject(db, { name: 'P2' })
  expect(getAllProjects(db)).toHaveLength(2)
})

it('getProjectById returns correct project', () => {
  const p = insertProject(db, { name: 'Alpha' })
  const found = getProjectById(db, p.id)
  expect(found?.name).toBe('Alpha')
})

it('getProjectById returns null for unknown id', () => {
  expect(getProjectById(db, 'no-such-id')).toBeNull()
})

it('updateProject changes name and description', () => {
  const p = insertProject(db, { name: 'Old' })
  const updated = updateProject(db, p.id, { name: 'New', description: 'Updated' })
  expect(updated?.name).toBe('New')
  expect(updated?.description).toBe('Updated')
})

it('deleteProject removes the project', () => {
  const p = insertProject(db, { name: 'ToDelete' })
  deleteProject(db, p.id)
  expect(getProjectById(db, p.id)).toBeNull()
})
