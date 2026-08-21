export type OrchestratorRunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed'

export type OrchestratorPhase = 'dev' | 'review' | 'security' | 'commit' | 'push'

export type OrchestratorPhaseStatus = 'pending' | 'active' | 'done' | 'failed' | 'skipped'

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

export type DebtTimeframe = 'short' | 'medium' | 'long'

export interface OrchestratorRun {
  id: string
  sprintName: string
  projectId: string | null
  repoId: string
  status: OrchestratorRunStatus
  concurrencyCap: number
  telegramNotify: boolean
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  singleTaskId: string | null
}

export interface OrchestratorTaskLog {
  id: string
  runId: string
  taskId: string
  phase: OrchestratorPhase
  status: OrchestratorPhaseStatus
  agentId: string | null
  modelUsed: string | null
  providerUsed: string | null
  summaryJson: string | null
  issuesJson: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface OrchestratorIssue {
  severity: IssueSeverity
  category: string
  description: string
  file?: string
  line?: number
}

export interface OrchestratorDebtFlag {
  timeframe: DebtTimeframe
  category: string
  description: string
  estimatedEffort?: string
}

export interface ExecutionSummary {
  taskId: string
  taskTitle: string
  phases: {
    phase: OrchestratorPhase
    status: OrchestratorPhaseStatus
    modelUsed: string | null
    providerUsed: string | null
    durationMs: number | null
    issueCount: number
  }[]
  issues: OrchestratorIssue[]
  debtFlags: OrchestratorDebtFlag[]
  totalDurationMs: number | null
}

export interface OrchestratorStartInput {
  sprintName: string
  repoId: string
  projectId?: string
  concurrencyCap?: number
  telegramNotify?: boolean
  singleTaskId?: string
}

export interface OrchestratorStatusResponse {
  run: OrchestratorRun | null
  activeTasks: OrchestratorTaskLog[]
  completedCount: number
  totalCount: number
  failedCount: number
  singleTaskId: string | null
}

export interface OrchestratorStatusChangePayload {
  runId: string
  status: OrchestratorRunStatus
  sprintName: string
}

export interface OrchestratorTaskPhaseChangePayload {
  runId: string
  taskId: string
  phase: OrchestratorPhase
  status: OrchestratorPhaseStatus
}

export interface RetryFailure {
  id: string
  taskId: string
  provider: string
  attempts: number
  lastError: string | null
  diagnostics: string | null
  createdAt: string
}
