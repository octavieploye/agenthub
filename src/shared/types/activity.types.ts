export type ActivityEventType =
  | 'agent_spawned'
  | 'agent_status_changed'
  | 'agent_completed'
  | 'agent_interrupted'
  | 'agent_respawned'
  | 'agent_error'
  | 'task_created'
  | 'task_status_changed'
  | 'bug_created'
  | 'bug_resolved'
  | 'note_created'
  | 'repo_added'

export type ActivityEntityType = 'agent' | 'task' | 'bug' | 'note' | 'repo'

export interface ActivityEvent {
  id: number
  eventType: ActivityEventType
  entityType: ActivityEntityType
  entityId: string
  repoId: string | null
  agentId: string | null
  details: Record<string, unknown>
  createdAt: string
}

export interface InsertActivityEvent {
  eventType: ActivityEventType
  entityType: ActivityEntityType
  entityId: string
  repoId?: string
  agentId?: string
  details?: Record<string, unknown>
}

export interface ActivityStats {
  agentsSpawned: number
  agentsCompleted: number
  agentsErrored: number
  tasksCompleted: number
  bugsCreated: number
  bugsResolved: number
}

export type ActivityTimeRange = '1d' | '7d' | '14d' | '30d' | '90d'

export type ActivityGroupMode = 'timeline' | 'by-project' | 'by-day'
