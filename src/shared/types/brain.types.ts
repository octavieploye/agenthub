/**
 * Types for the AgentHub Brain feature
 * Cross-repo intelligence panel for tracking brainstorms, specs, plans, and sprints
 */

export type BrainEntryType = 'brainstorm' | 'spec' | 'plan' | 'sprint' | 'strategy' | 'marketing' | 'how-to' | 'reference' | 'learning'
export type BrainEntryStatus = 'draft' | 'active' | 'parked' | 'implemented'

export interface BrainEntry {
  id: string
  repoId: string
  repoName: string
  projectId: string | null
  projectName: string | null
  pointerPath: string
  artifactPath: string
  type: BrainEntryType
  subject: string
  status: BrainEntryStatus
  createdAt: string
  updatedAt: string
  note?: string | null
  // Aggregated at query time from linked tasks
  tasksTotal: number
  tasksDone: number
  tasksInProgress: number
  // Auto-computed by scanner
  computedStatus: 'remaining' | 'in_progress' | 'done'
  checklistTotal: number
  checklistDone: number
  gitSignal: boolean
}

export interface BrainQueryResult {
  repoId: string
  repoName: string
  entries: BrainEntry[]
  summary: {
    active: number
    notActioned: number
    parked: number
    implemented: number
  }
}

export interface RegisterBrainEntryInput {
  repoId: string
  subject: string
  type: BrainEntryType
  artifactPath: string
  project?: string
  note?: string
}

export interface BrainTimelineEntry {
  id: string
  repoId: string
  date: string
  type: 'brain' | 'git'
  subject: string
  details?: string
  icon: 'brain' | 'git-commit'
}

export interface CreateTaskFromBrainInput {
  brainEntryId: string
  subject?: string
  description?: string
}