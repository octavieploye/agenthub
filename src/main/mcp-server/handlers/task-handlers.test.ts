import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../db/migration-runner'
import { insertRepo } from '../../db/queries/repos.queries'
import { insertTask } from '../../db/queries/tasks.queries'
import type { McpIpcResponse } from '@shared/types/mcp-server.types'
import {
  handleCreateTask,
  handleDispatchTask,
  handleListTasks,
  type TaskHandlerDeps
} from './task-handlers'

describe('task handlers', () => {
  let db: Database.Database
  let repoId: string

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db, __dirname + '/../../db/migrations')
    repoId = insertRepo(db, { name: 'agenthub', path: '/tmp/agenthub' }).id
  })

  afterEach(() => db.close())

  function createDeps(response: McpIpcResponse = { type: 'success', data: {} }): TaskHandlerDeps {
    return {
      db,
      sendIpc: vi.fn(async () => response)
    }
  }

  function createdTaskResponse(overrides: Record<string, unknown> = {}): McpIpcResponse {
    return {
      type: 'success',
      data: {
        id: 'created-task',
        title: 'Created task',
        status: 'backlog',
        ...overrides
      }
    }
  }

  describe('handleCreateTask', () => {
    it('rejects input missing repoId', async () => {
      const deps = createDeps(createdTaskResponse())

      await expect(
        handleCreateTask({ title: 'Missing repository' } as never, deps)
      ).rejects.toThrow('repoId')
      expect(deps.sendIpc).not.toHaveBeenCalled()
    })

    it('rejects input missing title', async () => {
      const deps = createDeps(createdTaskResponse())

      await expect(handleCreateTask({ repoId } as never, deps)).rejects.toThrow('title')
      expect(deps.sendIpc).not.toHaveBeenCalled()
    })

    it.each([
      ['empty repoId', { repoId: '', title: 'Invalid task' }],
      ['blank title', { repoId, title: '   ' }],
      ['invalid priority', { repoId, title: 'Invalid task', priority: 4 }],
      ['invalid provider', { repoId, title: 'Invalid task', providerOverride: 'not-a-provider' }]
    ])('rejects %s', async (_caseName, input) => {
      const deps = createDeps(createdTaskResponse())

      await expect(handleCreateTask(input as never, deps)).rejects.toThrow()
      expect(deps.sendIpc).not.toHaveBeenCalled()
    })
  })

  describe('handleListTasks', () => {
    beforeEach(() => {
      const otherRepoId = insertRepo(db, { name: 'other', path: '/tmp/other' }).id
      insertTask(db, {
        repoId,
        title: 'Backend sprint task',
        sprintName: 'S1',
        status: 'backlog',
        category: 'backend'
      })
      insertTask(db, {
        repoId,
        title: 'Frontend sprint task',
        sprintName: 'S1',
        status: 'in_progress',
        category: 'frontend'
      })
      insertTask(db, {
        repoId,
        title: 'Backend later task',
        sprintName: 'S2',
        status: 'completed',
        category: 'backend'
      })
      insertTask(db, {
        repoId: otherRepoId,
        title: 'Other repository task',
        sprintName: 'S1',
        status: 'backlog',
        category: 'backend'
      })
    })

    it('filters tasks by repo', () => {
      const result = handleListTasks({ repoId }, db)

      expect(result.tasks.map((task) => task.title).sort()).toEqual(
        ['Backend sprint task', 'Frontend sprint task', 'Backend later task'].sort()
      )
      expect(result.total).toBe(3)
    })

    it.each([
      [
        'sprint',
        { sprintName: 'S1' },
        ['Backend sprint task', 'Frontend sprint task', 'Other repository task']
      ],
      ['status', { status: 'completed' }, ['Backend later task']],
      ['category', { category: 'frontend' }, ['Frontend sprint task']]
    ])('filters tasks by %s', (_filterName, filter, expectedTitles) => {
      const result = handleListTasks(filter, db)

      expect(result.tasks.map((task) => task.title).sort()).toEqual(expectedTitles.sort())
      expect(result.total).toBe(expectedTitles.length)
    })
  })

  describe('handleDispatchTask', () => {
    it('blocks dispatch when the orchestrator is disabled', async () => {
      const deps = createDeps()

      await expect(
        handleDispatchTask({ taskId: 'task-1', confirmed: true }, deps)
      ).resolves.toEqual({
        result: 'blocked',
        runId: null,
        message: expect.stringContaining('Orchestrator is disabled')
      })
      expect(deps.sendIpc).not.toHaveBeenCalled()
    })
  })
})
