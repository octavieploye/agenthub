import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { searchAgents, searchTasks, searchRepos, searchAll } from './search.queries'
import { insertRepo } from './repos.queries'
import { insertAgent } from './agents.queries'
import { insertTask } from './tasks.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../migrations')
})

describe('search.queries', () => {
  describe('searchAgents', () => {
    it('finds agents by name', () => {
      const repo = insertRepo(db, { name: 'test', path: '/tmp/test' })
      insertAgent(db, { repoId: repo.id, name: 'Fix OAuth', cwd: '/tmp/test' })
      insertAgent(db, { repoId: repo.id, name: 'Add tests', cwd: '/tmp/test' })

      const results = searchAgents(db, 'OAuth')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Fix OAuth')
      expect(results[0].type).toBe('agent')
    })

    it('finds agents by cwd', () => {
      const repo = insertRepo(db, { name: 'test', path: '/tmp/myrepo' })
      insertAgent(db, { repoId: repo.id, name: 'Agent1', cwd: '/workspace/myrepo' })

      const results = searchAgents(db, 'myrepo')
      expect(results).toHaveLength(1)
    })

    it('returns empty for no match', () => {
      expect(searchAgents(db, 'nonexistent')).toEqual([])
    })
  })

  describe('searchTasks', () => {
    it('finds tasks by title', () => {
      const repo = insertRepo(db, { name: 'test', path: '/tmp/test' })
      insertTask(db, { repoId: repo.id, title: 'Fix authentication bug' })
      insertTask(db, { repoId: repo.id, title: 'Add rate limiting' })

      const results = searchTasks(db, 'auth')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Fix authentication bug')
      expect(results[0].type).toBe('task')
    })

    it('finds tasks by description', () => {
      const repo = insertRepo(db, { name: 'test', path: '/tmp/test' })
      insertTask(db, { repoId: repo.id, title: 'Task 1', description: 'Related to OAuth tokens' })

      const results = searchTasks(db, 'OAuth')
      expect(results).toHaveLength(1)
    })

    it('includes repo name in subtitle', () => {
      const repo = insertRepo(db, { name: 'Frontend', path: '/tmp/frontend' })
      insertTask(db, { repoId: repo.id, title: 'Fix CSS' })

      const results = searchTasks(db, 'CSS')
      expect(results[0].subtitle).toContain('Frontend')
    })
  })

  describe('searchRepos', () => {
    it('finds repos by name', () => {
      insertRepo(db, { name: 'payment-service', path: '/tmp/pay' })
      insertRepo(db, { name: 'api-gateway', path: '/tmp/api' })

      const results = searchRepos(db, 'payment')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('payment-service')
      expect(results[0].type).toBe('repo')
    })

    it('finds repos by path', () => {
      insertRepo(db, { name: 'test', path: '/workspace/my-project' })

      const results = searchRepos(db, 'my-project')
      expect(results).toHaveLength(1)
    })
  })

  describe('searchAll', () => {
    it('returns combined results from all categories', () => {
      const repo = insertRepo(db, { name: 'auth-service', path: '/tmp/auth' })
      insertAgent(db, { repoId: repo.id, name: 'Auth agent', cwd: '/tmp/auth' })
      insertTask(db, { repoId: repo.id, title: 'Fix auth flow' })

      const results = searchAll(db, 'auth')
      expect(results.length).toBeGreaterThanOrEqual(3)
      const types = new Set(results.map((r) => r.type))
      expect(types.has('agent')).toBe(true)
      expect(types.has('task')).toBe(true)
      expect(types.has('repo')).toBe(true)
    })

    it('returns empty for empty query', () => {
      expect(searchAll(db, '')).toEqual([])
    })

    it('returns empty for whitespace-only query', () => {
      expect(searchAll(db, '   ')).toEqual([])
    })
  })
})
