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
  position: number
  sbarId: string | null
  sprintName: string | null
  epicName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  repoId: string
  title: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  sprintName?: string
  epicName?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  agentId?: string | null
  position?: number
  sbarId?: string | null
  sprintName?: string | null
  epicName?: string | null
}

export type TaskEventType =
  | 'CARD_TRANSITION'
  | 'CARD_COMPLETED'
  | 'CARD_INTERRUPTED'
  | 'SPRINT_INTAKE'

export interface TaskEvent {
  id: string
  taskId: string
  eventType: TaskEventType
  fromStatus: string | null
  toStatus: string
  agentId: string | null
  payloadJson: string
  createdAt: string
  syncedToAnamnesis: number
  enrichedFromAnamnesis: number
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
