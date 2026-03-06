export type EscalationLevel = 'L1' | 'L2' | 'L3' | 'L4'

export type PipelineStatus = 'pending' | 'running' | 'resolved' | 'escalated' | 'failed'

export interface PipelineAttempt {
  level: EscalationLevel
  attemptNumber: number
  action: string
  result: string
  resolvedIssue: boolean
  timestamp: number
}

export interface PipelineRun {
  id: string
  agentId: string
  errorMessage: string
  currentLevel: EscalationLevel
  status: PipelineStatus
  attempts: PipelineAttempt[]
  createdAt: number
  resolvedAt: number | null
}

export interface QualityPipelineDeps {
  retryAgent: (agentId: string, adjustedPrompt: string) => Promise<boolean>
  spawnTesterAgent: (agentId: string, errorMessage: string) => Promise<{ isolated: boolean; diagnosis: string }>
  spawnDebuggerAgent: (agentId: string, errorMessage: string, context: string) => Promise<{ fixed: boolean; summary: string }>
  notifyUser: (summary: PipelineRun) => void
  logInfo: (message: string, meta?: Record<string, unknown>) => void
}
