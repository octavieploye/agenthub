import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTaskStore, buildBacklogGroups } from './task-store'
import type { TaskItem } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'

function makeMockTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 'task-1',
    repoId: 'repo-1',
    title: 'Test task',
    description: '',
    priority: 3,
    status: 'backlog',
    agentId: null,
    position: 0,
    sbarId: null,
    sprintName: null,
    epicName: null,
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    ...overrides
  }
}

beforeEach(() => {
  useTaskStore.setState({ tasks: [], loading: false, error: null })
  vi.restoreAllMocks()
})

describe('useTaskStore', () => {
  describe('setTasks', () => {
    it('replaces all tasks', () => {
      const tasks = [makeMockTask({ id: 'a' }), makeMockTask({ id: 'b' })]
      useTaskStore.getState().setTasks(tasks)
      expect(useTaskStore.getState().tasks).toHaveLength(2)
    })
  })

  describe('addTask', () => {
    it('appends a task', () => {
      useTaskStore.getState().addTask(makeMockTask({ id: 'a' }))
      useTaskStore.getState().addTask(makeMockTask({ id: 'b' }))
      expect(useTaskStore.getState().tasks).toHaveLength(2)
    })
  })

  describe('updateTaskLocal', () => {
    it('updates matching task fields', () => {
      useTaskStore.getState().setTasks([makeMockTask({ id: 'a', title: 'Old' })])
      useTaskStore.getState().updateTaskLocal('a', { title: 'New' })
      expect(useTaskStore.getState().tasks[0].title).toBe('New')
    })

    it('does not modify non-matching tasks', () => {
      useTaskStore.getState().setTasks([
        makeMockTask({ id: 'a', title: 'A' }),
        makeMockTask({ id: 'b', title: 'B' })
      ])
      useTaskStore.getState().updateTaskLocal('a', { title: 'Updated' })
      expect(useTaskStore.getState().tasks[1].title).toBe('B')
    })

    it('updates status field', () => {
      useTaskStore.getState().setTasks([makeMockTask({ id: 'a', status: 'backlog' })])
      useTaskStore.getState().updateTaskLocal('a', { status: 'today' })
      expect(useTaskStore.getState().tasks[0].status).toBe('today')
    })
  })

  describe('removeTask', () => {
    it('removes matching task', () => {
      useTaskStore.getState().setTasks([
        makeMockTask({ id: 'a' }),
        makeMockTask({ id: 'b' })
      ])
      useTaskStore.getState().removeTask('a')
      expect(useTaskStore.getState().tasks).toHaveLength(1)
      expect(useTaskStore.getState().tasks[0].id).toBe('b')
    })
  })

  describe('fetchTasks', () => {
    it('calls IPC and sets tasks on success', async () => {
      const mockTasks = [makeMockTask()]
      window.agentHub = {
        tasks: {
          list: vi.fn().mockResolvedValue({ success: true, data: mockTasks })
        }
      } as any

      await useTaskStore.getState().fetchTasks()
      expect(useTaskStore.getState().tasks).toEqual(mockTasks)
      expect(useTaskStore.getState().loading).toBe(false)
    })

    it('sets error on failure', async () => {
      window.agentHub = {
        tasks: {
          list: vi.fn().mockResolvedValue({ success: false, error: { code: 'ERR', message: 'fail' } })
        }
      } as any

      await useTaskStore.getState().fetchTasks()
      expect(useTaskStore.getState().error).toBe('fail')
      expect(useTaskStore.getState().loading).toBe(false)
    })
  })

  describe('createTask', () => {
    it('adds task on success', async () => {
      const newTask = makeMockTask({ id: 'new-1' })
      window.agentHub = {
        tasks: {
          create: vi.fn().mockResolvedValue({ success: true, data: newTask })
        }
      } as any

      const result = await useTaskStore.getState().createTask({ repoId: 'repo-1', title: 'New' })
      expect(result).toEqual(newTask)
      expect(useTaskStore.getState().tasks).toHaveLength(1)
    })

    it('returns null on failure', async () => {
      window.agentHub = {
        tasks: {
          create: vi.fn().mockResolvedValue({ success: false, error: { code: 'ERR', message: 'fail' } })
        }
      } as any

      const result = await useTaskStore.getState().createTask({ repoId: 'repo-1', title: 'New' })
      expect(result).toBeNull()
    })
  })

  describe('deleteTask', () => {
    it('removes task on success', async () => {
      useTaskStore.getState().setTasks([makeMockTask({ id: 'a' })])
      window.agentHub = {
        tasks: {
          delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
        }
      } as any

      const result = await useTaskStore.getState().deleteTask('a')
      expect(result).toBe(true)
      expect(useTaskStore.getState().tasks).toHaveLength(0)
    })
  })

  describe('reorderTask', () => {
    it('is defined on the store', () => {
      expect(useTaskStore.getState().reorderTask).toBeDefined()
    })

    it('calls updateTaskRemote with position and returns true on success', async () => {
      useTaskStore.getState().setTasks([makeMockTask({ id: 'task-1', position: 0 })])
      window.agentHub = {
        tasks: {
          update: vi.fn().mockResolvedValue({ success: true, data: undefined })
        }
      } as any

      const result = await useTaskStore.getState().reorderTask('task-1', 5)
      expect(result).toBe(true)
      expect((window.agentHub.tasks.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('task-1', { position: 5 })
    })

    it('returns false when IPC update fails', async () => {
      useTaskStore.getState().setTasks([makeMockTask({ id: 'task-1' })])
      window.agentHub = {
        tasks: {
          update: vi.fn().mockResolvedValue({ success: false, error: { code: 'ERR', message: 'update failed' } })
        }
      } as any

      const result = await useTaskStore.getState().reorderTask('task-1', 3)
      expect(result).toBe(false)
      expect(useTaskStore.getState().error).toBe('update failed')
    })
  })

  describe('batchCreateFromSprint', () => {
    it('is defined on the store', () => {
      expect(useTaskStore.getState().batchCreateFromSprint).toBeDefined()
    })

    it('creates all stories and returns created tasks', async () => {
      const story1 = makeMockTask({ id: 'sprint-1', title: 'Story 1', sprintName: 'S1', epicName: 'E1' })
      const story2 = makeMockTask({ id: 'sprint-2', title: 'Story 2', sprintName: 'S1', epicName: 'E1' })
      const createMock = vi.fn()
        .mockResolvedValueOnce({ success: true, data: story1 })
        .mockResolvedValueOnce({ success: true, data: story2 })

      window.agentHub = {
        tasks: {
          create: createMock
        }
      } as any

      const stories = [
        { title: 'Story 1', description: '', priority: 3 as const, sprintName: 'S1', epicName: 'E1', repoId: 'repo-1' },
        { title: 'Story 2', description: '', priority: 2 as const, sprintName: 'S1', epicName: 'E1', repoId: 'repo-1' }
      ]

      const result = await useTaskStore.getState().batchCreateFromSprint(stories)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('sprint-1')
      expect(result[1].id).toBe('sprint-2')
      expect(createMock).toHaveBeenCalledTimes(2)
      expect(useTaskStore.getState().tasks).toHaveLength(2)
    })

    it('skips failed creations and returns only successful tasks', async () => {
      const story1 = makeMockTask({ id: 'sprint-1', title: 'Story 1' })
      const createMock = vi.fn()
        .mockResolvedValueOnce({ success: true, data: story1 })
        .mockResolvedValueOnce({ success: false, error: { code: 'ERR', message: 'create failed' } })

      window.agentHub = {
        tasks: {
          create: createMock
        }
      } as any

      const stories = [
        { title: 'Story 1', description: '', priority: 3 as const, sprintName: 'S1', epicName: 'E1', repoId: 'repo-1' },
        { title: 'Story 2', description: '', priority: 2 as const, sprintName: 'S1', epicName: 'E1', repoId: 'repo-1' }
      ]

      const result = await useTaskStore.getState().batchCreateFromSprint(stories)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('sprint-1')
    })

    it('returns empty array when stories list is empty', async () => {
      window.agentHub = { tasks: {} } as any
      const result = await useTaskStore.getState().batchCreateFromSprint([])
      expect(result).toEqual([])
    })
  })
})

describe('buildBacklogGroups', () => {
  const repos: RepoConfig[] = [
    { id: 'repo-1', name: 'Repo One', path: '/tmp/r1', createdAt: '' },
    { id: 'repo-2', name: 'Repo Two', path: '/tmp/r2', createdAt: '' }
  ]

  it('groups backlog tasks by repo with priority counts', () => {
    const tasks: TaskItem[] = [
      makeMockTask({ id: 'a', repoId: 'repo-1', priority: 1, status: 'backlog' }),
      makeMockTask({ id: 'b', repoId: 'repo-1', priority: 2, status: 'backlog' }),
      makeMockTask({ id: 'c', repoId: 'repo-2', priority: 3, status: 'backlog' })
    ]
    const groups = buildBacklogGroups(tasks, repos)
    expect(groups).toHaveLength(2)

    const r1 = groups.find((g) => g.repoId === 'repo-1')!
    expect(r1.repoName).toBe('Repo One')
    expect(r1.tasks).toHaveLength(2)
    expect(r1.priorityCounts).toEqual({ p1: 1, p2: 1, p3: 0 })

    const r2 = groups.find((g) => g.repoId === 'repo-2')!
    expect(r2.tasks).toHaveLength(1)
    expect(r2.priorityCounts).toEqual({ p1: 0, p2: 0, p3: 1 })
  })

  it('excludes non-backlog tasks', () => {
    const tasks: TaskItem[] = [
      makeMockTask({ id: 'a', repoId: 'repo-1', status: 'today' }),
      makeMockTask({ id: 'b', repoId: 'repo-1', status: 'completed' })
    ]
    const groups = buildBacklogGroups(tasks, repos)
    expect(groups).toHaveLength(0)
  })

  it('returns empty array for no tasks', () => {
    expect(buildBacklogGroups([], repos)).toEqual([])
  })
})
