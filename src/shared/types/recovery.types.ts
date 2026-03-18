import type { AgentState } from './agent.types'

export type ViewMode = 'raid' | 'terminal'

export interface SessionSnapshot {
  id: number
  stateJson: WorkspaceState
  trigger: SnapshotTrigger
  createdAt: string
}

export type SnapshotTrigger =
  | 'periodic'
  | 'agent_spawn'
  | 'agent_kill'
  | 'agent_status_change'
  | 'view_switch'
  | 'app_close'
  | 'manual'

export interface WorkspaceState {
  agents: AgentState[]
  activeAgentId: string | null
  viewMode: ViewMode
  soundEnabled: boolean
  focusedAgentId: string | null
  statusFilter: string | null
  appVersion: string
  timestamp: string
}

export type SBARSection = 'situation' | 'background' | 'assessment' | 'recommendation'

export interface SBARHandoff {
  id: string
  agentId: string
  agentName: string
  repoId: string
  situation: string
  background: string
  assessment: string
  recommendation: string
  createdAt: string
}

export interface CreateSBARInput {
  agentId: string
  agentName: string
  repoId: string
  situation: string
  background: string
  assessment: string
  recommendation: string
}

export interface RecoveryInfo {
  hadInterruption: boolean
  lastSnapshot: SessionSnapshot | null
  recoveredAgents: AgentState[]
  interruptedAgents: Array<AgentState & { handoff?: SBARHandoff }>
}
