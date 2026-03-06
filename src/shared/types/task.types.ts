export type TaskPriority = 1 | 2 | 3

export type TaskStatus = 'backlog' | 'today' | 'in_progress' | 'completed' | 'tested' | 'interrupted'

export interface TaskItem {
  id: string
  repoId: string
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  agentId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  repoId: string
  title: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  agentId?: string | null
}

export interface BacklogGroup {
  repoId: string
  repoName: string
  tasks: TaskItem[]
  priorityCounts: { p1: number; p2: number; p3: number }
}

export interface YesterdaySummary {
  completed: number
  tested: number
  bugsResolved: number
}
