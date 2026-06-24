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

describe('project path field', () => {
  it('insertProject stores null path by default', () => {
    const p = insertProject(db, { name: 'Test' })
    const fetched = getProjectById(db, p.id)
    expect(fetched?.path).toBeNull()
  })

  it('updateProject can set path', () => {
    const p = insertProject(db, { name: 'Test' })
    updateProject(db, p.id, { path: '/Users/dev/myproject' })
    const fetched = getProjectById(db, p.id)
    expect(fetched?.path).toBe('/Users/dev/myproject')
  })

  it('updateProject can clear path to null', () => {
    const p = insertProject(db, { name: 'Test' })
    updateProject(db, p.id, { path: '/tmp/foo' })
    updateProject(db, p.id, { path: null })
    const fetched = getProjectById(db, p.id)
    expect(fetched?.path).toBeNull()
  })
})

describe('contextDoc field', () => {
  it('insertProject returns contextDoc as null', () => {
    const p = insertProject(db, { name: 'Test' })
    expect(p.contextDoc).toBeNull()
  })

  // Skipped until Task 3 adds migration 024 (context_doc column)
  it.skip('updateProject persists contextDoc', () => {
    const p = insertProject(db, { name: 'Test' })
    const updated = updateProject(db, p.id, { contextDoc: 'This project builds the auth system.' })
    expect(updated?.contextDoc).toBe('This project builds the auth system.')
  })

  // Skipped until Task 3 adds migration 024 (context_doc column)
  it.skip('updateProject clears contextDoc when set to null', () => {
    const p = insertProject(db, { name: 'Test' })
    updateProject(db, p.id, { contextDoc: 'Some context' })
    const cleared = updateProject(db, p.id, { contextDoc: null })
    expect(cleared?.contextDoc).toBeNull()
  })
})

describe('insertProject path field', () => {
  it('stores path when provided in CreateProjectInput', () => {
    const p = insertProject(db, { name: 'Rooted', path: '/tmp/my-project' })
    const fetched = getProjectById(db, p.id)
    expect(fetched?.path).toBe('/tmp/my-project')
  })
})
