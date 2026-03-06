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
