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

    it('S7: auto-injects destructive-ban and no-test-tampering protected paths', async () => {
      const deps = createDeps(createdTaskResponse())

      await handleCreateTask({ repoId, title: 'Plain task' }, deps)

      const call = (deps.sendIpc as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        type: string
        payload: { guardrailJson?: string }
      }
      const guardrail = JSON.parse(call.payload.guardrailJson ?? '{}') as {
        protectedPaths?: string[]
      }
      expect(guardrail.protectedPaths).toContain('*.test.ts')
      expect(guardrail.protectedPaths).toContain('*.spec.ts')
      expect(guardrail.protectedPaths).toContain('package-lock.json')
      expect(guardrail.protectedPaths).toContain('.gitignore')
    })

    it('S7: forces requiresApproval when riskScore >= 0.7', async () => {
      const deps = createDeps(createdTaskResponse())

      // R1 (0.30) + R2 (0.25) + R4 11 files (0.10) + R7 3 dirs (0.05) = 0.70
      const highRiskInput = {
        repoId,
        title: 'High-risk task',
        description: 'run git clean -fd to clear build artifacts',
        requiresApproval: false,
        targetFiles: [
          'package-lock.json',
          'src/a/f1.ts',
          'src/a/f2.ts',
          'src/a/f3.ts',
          'src/a/f4.ts',
          'src/a/f5.ts',
          'src/b/g1.ts',
          'src/b/g2.ts',
          'src/b/g3.ts',
          'src/b/g4.ts',
          'src/b/g5.ts'
        ]
      }

      const result = await handleCreateTask(highRiskInput, deps)

      expect(result.requiresApproval).toBe(true)
      expect(result.riskAssessment?.riskScore).toBeGreaterThanOrEqual(0.7)
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('requiresApproval automatically set to true')])
      )
    })

    it('passes projectId to the IPC payload', async () => {
      const deps = createDeps(createdTaskResponse())

      await handleCreateTask({ repoId, title: 'Project task', projectId: 'proj-abc-123' }, deps)

      const call = (deps.sendIpc as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        type: string
        payload: { projectId?: string }
      }
      expect(call.payload.projectId).toBe('proj-abc-123')
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

    it('S4: returns requires_confirmation when confirmed is false', async () => {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES ('orchestrator.enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'"
      ).run()
      const deps = createDeps()

      await expect(
        handleDispatchTask({ taskId: 'task-1', confirmed: false }, deps)
      ).resolves.toEqual({
        result: 'requires_confirmation',
        runId: null,
        message: expect.stringContaining('confirmed: true')
      })
      expect(deps.sendIpc).not.toHaveBeenCalled()
    })

    it('S5: returns budget_cap_reached when IPC responds with BUDGET_CAP_REACHED code', async () => {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES ('orchestrator.enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'"
      ).run()
      const deps = createDeps({
        type: 'error',
        code: 'BUDGET_CAP_REACHED',
        message: 'Monthly token budget exceeded'
      })

      await expect(
        handleDispatchTask({ taskId: 'task-1', confirmed: true }, deps)
      ).resolves.toEqual({
        result: 'budget_cap_reached',
        runId: null,
        message: 'Monthly token budget exceeded'
      })
    })
  })
})
