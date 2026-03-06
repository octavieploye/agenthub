import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { getDb, closeDb, resetDb } from '../connection'
import { getAllRepos, getRepoById, insertRepo, deleteRepo } from './repos.queries'
import type Database from 'better-sqlite3'

describe('Repos Queries', () => {
  let db: Database.Database

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
  })

  afterEach(() => {
    closeDb()
  })

  it('returns empty array when no repos exist', () => {
    const repos = getAllRepos(db)
    expect(repos).toEqual([])
  })

  it('inserts and retrieves a repo', () => {
    const repo = insertRepo(db, { name: 'test-repo', path: '/tmp/test-repo' })
    expect(repo.id).toBeDefined()
    expect(repo.name).toBe('test-repo')
    expect(repo.path).toBe('/tmp/test-repo')
    expect(repo.createdAt).toBeDefined()

    const all = getAllRepos(db)
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('test-repo')
  })

  it('retrieves a repo by id', () => {
    const inserted = insertRepo(db, { name: 'my-repo', path: '/tmp/my-repo' })
    const found = getRepoById(db, inserted.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('my-repo')
  })

  it('returns null for non-existent repo id', () => {
    const found = getRepoById(db, 'non-existent')
    expect(found).toBeNull()
  })

  it('deletes a repo', () => {
    const repo = insertRepo(db, { name: 'delete-me', path: '/tmp/delete-me' })
    deleteRepo(db, repo.id)
    const found = getRepoById(db, repo.id)
    expect(found).toBeNull()
  })

  it('stores glow color', () => {
    const repo = insertRepo(db, {
      name: 'colored',
      path: '/tmp/colored',
      glowColor: 'oklch(0.7 0.2 145)'
    })
    const found = getRepoById(db, repo.id)
    expect(found!.glowColor).toBe('oklch(0.7 0.2 145)')
  })

  it('enforces unique path constraint', () => {
    insertRepo(db, { name: 'repo1', path: '/tmp/unique-path' })
    expect(() => insertRepo(db, { name: 'repo2', path: '/tmp/unique-path' })).toThrow()
  })
})
