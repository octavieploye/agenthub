export type TaskPriority = 1 | 2 | 3

export type TaskStatus = 'backlog' | 'today' | 'in_progress' | 'completed' | 'tested' | 'interrupted'

export type TaskCategory = string

export const KNOWN_CATEGORIES: TaskCategory[] = ['backend', 'frontend', 'database', 'schema', 'functionality']

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  1: 'High',
  2: 'Medium',
  3: 'Low'
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Not Started',
  today: 'Today',
  in_progress: 'In Progress',
  completed: 'Done',
  tested: 'Tested',
  interrupted: 'Interrupted'
}

export const CATEGORY_LABEL: Record<string, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  database: 'Database',
  schema: 'Schema',
  functionality: 'Functionality'
}

export interface TaskItem {
  id: string
  repoId: string
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  category: TaskCategory | null
  agentId: string | null
  position: number
  sbarId: string | null
  sprintName: string | null
  epicName: string | null
  projectId: string | null
  sectionTargetDate: string | null
  note: string | null
  blockedBy: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  repoId: string
  title: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  category?: TaskCategory | null
  sprintName?: string
  epicName?: string
  projectId?: string | null
  sectionTargetDate?: string | null
  note?: string | null
  localId?: string
  dependsOn?: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  category?: TaskCategory | null
  agentId?: string | null
  position?: number
  sbarId?: string | null
  sprintName?: string | null
  epicName?: string | null
  projectId?: string | null
  sectionTargetDate?: string | null
  note?: string | null
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

export interface SprintStoryInput {
  localId: string
  title: string
  description: string
  priority: TaskPriority
  dependsOn?: string[]
}

export interface SprintEpicInput {
  name: string
  targetDate?: string
  tasks: SprintStoryInput[]
}

export interface SprintIntakePayload {
  sprintName: string
  projectName?: string   // human-readable name — resolved to UUID by SprintWatcher.confirm()
  repoId: string
  epics: SprintEpicInput[]
}

export interface SprintPendingPayload {
  pendingId: string
  sprintName: string
  projectName?: string
  epicCount: number
  taskCount: number
  dependencyCount: number
  repoId: string
}

export interface SprintDraftReadyPayload {
  projectId: string      // the project.id used in the filename sprint-{project.id}.draft.json
  draftFilename: string  // e.g. 'sprint-abc123.draft.json'
}
