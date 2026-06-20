import { create } from 'zustand'
import type { TaskItem, TaskPriority, CreateTaskInput, UpdateTaskInput, BacklogGroup } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'

export interface SprintStory {
  title: string
  description: string
  priority: TaskPriority
  sprintName: string
  epicName: string
  repoId: string
}

interface TaskStore {
  tasks: TaskItem[]
  loading: boolean
  error: string | null
  hasFetched: boolean

  setTasks: (tasks: TaskItem[]) => void
  addTask: (task: TaskItem) => void
  updateTaskLocal: (id: string, input: UpdateTaskInput) => void
  removeTask: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  fetchTasks: () => Promise<void>
  fetchTasksOnce: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<TaskItem | null>
  updateTaskRemote: (id: string, input: UpdateTaskInput) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  reorderTask: (taskId: string, position: number) => Promise<boolean>
  batchCreateFromSprint: (stories: SprintStory[]) => Promise<TaskItem[]>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  hasFetched: false,

  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTaskLocal: (id, input) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              ...(input.title !== undefined && { title: input.title }),
              ...(input.description !== undefined && { description: input.description }),
              ...(input.priority !== undefined && { priority: input.priority }),
              ...(input.status !== undefined && { status: input.status }),
              ...(input.agentId !== undefined && { agentId: input.agentId }),
              ...(input.position !== undefined && { position: input.position }),
              ...(input.category !== undefined && { category: input.category }),
              ...(input.projectId !== undefined && { projectId: input.projectId }),
              ...(input.sbarId !== undefined && { sbarId: input.sbarId }),
              ...(input.sprintName !== undefined && { sprintName: input.sprintName }),
              ...(input.epicName !== undefined && { epicName: input.epicName }),
              ...(input.sectionTargetDate !== undefined && { sectionTargetDate: input.sectionTargetDate }),
              ...(input.note !== undefined && { note: input.note }),
              updatedAt: new Date().toISOString()
            }
          : t
      )
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchTasksOnce: async () => {
    if (get().hasFetched) return
    set({ hasFetched: true })
    await get().fetchTasks()
  },

  fetchTasks: async () => {
    set({ loading: true, error: null })
    try {
      const response = await window.agentHub.tasks.list()
      if (response.success) {
        set({ tasks: response.data, loading: false })
      } else {
        set({ error: response.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  createTask: async (input) => {
    try {
      const response = await window.agentHub.tasks.create(input)
      if (response.success) {
        get().addTask(response.data)
        set({ hasFetched: false })
        return response.data
      }
      set({ error: response.error.message })
      return null
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
  },

  updateTaskRemote: async (id, input) => {
    // TODO: Phase 1 guard — when input.agentId is set, check that the agent's repoId
    // is linked to task.projectId before proceeding. Requires project-store.getState()
    // and agent-store.getState() to look up project repos. Add console.warn or toast
    // if agent repo is not in the task's project. Blocked until agent-to-repo assignment
    // UI exists (no current UI sets agentId on a task via updateTaskRemote).
    try {
      const response = await window.agentHub.tasks.update(id, input)
      if (response.success) {
        get().updateTaskLocal(id, input)
        set({ hasFetched: false })
        return true
      }
      set({ error: response.error.message })
      return false
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return false
    }
  },

  deleteTask: async (id) => {
    try {
      const response = await window.agentHub.tasks.delete(id)
      if (response.success) {
        get().removeTask(id)
        set({ hasFetched: false })
        return true
      }
      set({ error: response.error.message })
      return false
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return false
    }
  },

  reorderTask: async (taskId, position) => {
    return get().updateTaskRemote(taskId, { position })
  },

  batchCreateFromSprint: async (stories) => {
    const created: TaskItem[] = []
    for (const story of stories) {
      const task = await get().createTask({
        repoId: story.repoId,
        title: story.title,
        description: story.description,
        priority: story.priority,
        status: 'backlog',
        sprintName: story.sprintName,
        epicName: story.epicName
      })
      if (task) created.push(task)
    }
    return created
  }
}))

export function buildBacklogGroups(tasks: TaskItem[], repos: RepoConfig[]): BacklogGroup[] {
  const repoMap = new Map(repos.map((r) => [r.id, r.name]))
  const groups = new Map<string, BacklogGroup>()

  for (const task of tasks) {
    if (task.status !== 'backlog') continue
    let group = groups.get(task.repoId)
    if (!group) {
      group = {
        repoId: task.repoId,
        repoName: repoMap.get(task.repoId) ?? 'Unknown',
        tasks: [],
        priorityCounts: { p1: 0, p2: 0, p3: 0 }
      }
      groups.set(task.repoId, group)
    }
    group.tasks.push(task)
    if (task.priority === 1) group.priorityCounts.p1++
    else if (task.priority === 2) group.priorityCounts.p2++
    else group.priorityCounts.p3++
  }

  return Array.from(groups.values())
}
