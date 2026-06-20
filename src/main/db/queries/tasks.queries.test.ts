import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import {
  getAllTasks,
  getTasksByRepo,
  getTasksByStatus,
  getTaskById,
  insertTask,
  updateTask,
  deleteTask,
  getCompletedTasksSince,
  updateTaskPosition,
  linkSBARToTask
} from './tasks.queries'
import { insertRepo } from './repos.queries'
import { insertAgent } from './agents.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../migrations')
})

function seedRepo(): string {
  const repo = insertRepo(db, { name: 'test-repo', path: '/tmp/test-repo' })
  return repo.id
}

describe('tasks.queries', () => {
  describe('insertTask', () => {
    it('creates a task with defaults', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Fix bug' })
      expect(task.id).toBeDefined()
      expect(task.title).toBe('Fix bug')
      expect(task.priority).toBe(3)
      expect(task.status).toBe('backlog')
      expect(task.agentId).toBeNull()
      expect(task.description).toBe('')
    })

    it('creates a task with custom values', () => {
      const repoId = seedRepo()
      const task = insertTask(db, {
        repoId,
        title: 'Urgent fix',
        description: 'Critical bug',
        priority: 1,
        status: 'today'
      })
      expect(task.priority).toBe(1)
      expect(task.status).toBe('today')
      expect(task.description).toBe('Critical bug')
    })
  })

  describe('getAllTasks', () => {
    it('returns tasks sorted by priority then created_at', () => {
      const repoId = seedRepo()
      insertTask(db, { repoId, title: 'P3 task', priority: 3 })
      insertTask(db, { repoId, title: 'P1 task', priority: 1 })
      insertTask(db, { repoId, title: 'P2 task', priority: 2 })

      const tasks = getAllTasks(db)
      expect(tasks).toHaveLength(3)
      expect(tasks[0].title).toBe('P1 task')
      expect(tasks[1].title).toBe('P2 task')
      expect(tasks[2].title).toBe('P3 task')
    })

    it('returns empty array when no tasks', () => {
      expect(getAllTasks(db)).toEqual([])
    })
  })

  describe('getTasksByRepo', () => {
    it('filters by repo', () => {
      const repo1 = seedRepo()
      const repo2 = insertRepo(db, { name: 'other', path: '/tmp/other' }).id
      insertTask(db, { repoId: repo1, title: 'Repo1 task' })
      insertTask(db, { repoId: repo2, title: 'Repo2 task' })

      const tasks = getTasksByRepo(db, repo1)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Repo1 task')
    })
  })

  describe('getTasksByStatus', () => {
    it('filters by status', () => {
      const repoId = seedRepo()
      insertTask(db, { repoId, title: 'Backlog', status: 'backlog' })
      insertTask(db, { repoId, title: 'Today', status: 'today' })

      const backlog = getTasksByStatus(db, 'backlog')
      expect(backlog).toHaveLength(1)
      expect(backlog[0].title).toBe('Backlog')
    })
  })

  describe('getTaskById', () => {
    it('returns task by id', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Find me' })
      const found = getTaskById(db, task.id)
      expect(found).not.toBeNull()
      expect(found!.title).toBe('Find me')
    })

    it('returns null for unknown id', () => {
      expect(getTaskById(db, 'nonexistent')).toBeNull()
    })
  })

  describe('updateTask', () => {
    it('updates title', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Old title' })
      updateTask(db, task.id, { title: 'New title' })
      const updated = getTaskById(db, task.id)
      expect(updated!.title).toBe('New title')
    })

    it('updates status', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task' })
      updateTask(db, task.id, { status: 'today' })
      const updated = getTaskById(db, task.id)
      expect(updated!.status).toBe('today')
    })

    it('updates priority', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task', priority: 3 })
      updateTask(db, task.id, { priority: 1 })
      const updated = getTaskById(db, task.id)
      expect(updated!.priority).toBe(1)
    })

    it('updates agentId', () => {
      const repoId = seedRepo()
      const agent = insertAgent(db, { repoId, name: 'Agent 1', cwd: '/tmp/test-repo' })
      const task = insertTask(db, { repoId, title: 'Task' })
      updateTask(db, task.id, { agentId: agent.id })
      const updated = getTaskById(db, task.id)
      expect(updated!.agentId).toBe(agent.id)
    })

    it('updates multiple fields at once', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task', priority: 3 })
      updateTask(db, task.id, { title: 'Updated', priority: 1, status: 'in_progress' })
      const updated = getTaskById(db, task.id)
      expect(updated!.title).toBe('Updated')
      expect(updated!.priority).toBe(1)
      expect(updated!.status).toBe('in_progress')
    })
  })

  describe('deleteTask', () => {
    it('removes a task', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Doomed' })
      deleteTask(db, task.id)
      expect(getTaskById(db, task.id)).toBeNull()
    })
  })

  describe('kanban fields', () => {
    it('mapRow includes position and sbarId defaults', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'backlog' })
      const fetched = getTaskById(db, task.id)
      expect(fetched?.position).toBe(0)
      expect(fetched?.sbarId).toBeNull()
      expect(fetched?.sprintName).toBeNull()
      expect(fetched?.epicName).toBeNull()
    })

    it('updateTaskPosition changes position', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'today' })
      updateTaskPosition(db, task.id, 5)
      const fetched = getTaskById(db, task.id)
      expect(fetched?.position).toBe(5)
    })

    it('linkSBARToTask sets sbarId', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'backlog' })
      linkSBARToTask(db, task.id, 'sbar-uuid-123')
      const fetched = getTaskById(db, task.id)
      expect(fetched?.sbarId).toBe('sbar-uuid-123')
    })

    it('insertTask stores sprintName and epicName', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Sprint task', sprintName: 'Sprint 1', epicName: 'Epic A' })
      const fetched = getTaskById(db, task.id)
      expect(fetched?.sprintName).toBe('Sprint 1')
      expect(fetched?.epicName).toBe('Epic A')
    })

    it('mapRow includes projectId and sectionTargetDate', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'backlog' })
      const fetched = getTaskById(db, task.id)
      expect(fetched?.projectId).toBeNull()
      expect(fetched?.sectionTargetDate).toBeNull()
    })
  })

  describe('getCompletedTasksSince', () => {
    it('returns tasks completed after given date', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Done', status: 'completed' })
      const yesterday = new Date(Date.now() - 86400000).toISOString()
      const results = getCompletedTasksSince(db, yesterday)
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.find((t) => t.id === task.id)).toBeDefined()
    })

    it('excludes tasks before the since date', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString()
      const results = getCompletedTasksSince(db, tomorrow)
      expect(results).toEqual([])
    })
  })
})
