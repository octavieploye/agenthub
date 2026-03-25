import type { AgentLifecycleStatus } from './agent.types'

export type TriageLevel = 'low' | 'medium' | 'high' | 'critical'

export interface TriageEvent {
  agentId: string
  agentName: string
  repoName: string
  taskDescription: string
  previousStatus: AgentLifecycleStatus
  currentStatus: AgentLifecycleStatus
  triageLevel: TriageLevel
  timestamp: number
  reason: string
  requiresUserAction: boolean
  isTaskCompleted: boolean
}

export interface TriageInput {
  agentId: string
  agentName: string
  repoName: string
  taskDescription: string
  previousStatus: AgentLifecycleStatus
  currentStatus: AgentLifecycleStatus
}
