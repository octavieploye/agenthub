import type { GuardrailConfig } from './config.types'
import type { SkillItem } from './skills.types'
import type { TaskItem, TaskStatus, TaskCategory, TaskPriority } from './task.types'
import type { ModelProvider, CapabilityTier, ModelCatalogEntry } from './model.types'
import type { AgentLifecycleStatus } from './agent.types'
import type { OrchestratorRunStatus } from './orchestrator.types'
import type { HealthAnomaly } from './health.types'

// ─── Shared result types ────────────────────────────────────────────────────

export interface TokenEstimationBreakdown {
  taskDescription: number
  targetFiles: number
  skills: number
  systemContext: number
  responseOverhead: number
  safetyMargin: number
}

export interface TokenEstimation {
  estimatedTokens: number
  breakdown: TokenEstimationBreakdown
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

export interface RiskAssessment {
  riskScore: number
  riskFactors: string[]
  riskLevel: 'high' | 'medium' | 'low'
}

export interface ModelRecommendation {
  modelId: string
  provider: ModelProvider
  capabilityTier: CapabilityTier
  rationale: string
  estimatedTokens: number | null
  contextWindowFit: boolean
  riskAdjusted: boolean
}

// ─── Tool 1: create_task ────────────────────────────────────────────────────

export interface CreateTaskToolInput {
  repoId: string
  title: string
  description?: string
  sprintName?: string
  epicName?: string
  projectId?: string
  category?: TaskCategory
  priority?: TaskPriority
  requiresApproval?: boolean
  modelOverride?: string
  providerOverride?: string
  targetFiles?: string[]
  skills?: string[]
  guardrailOverrides?: Partial<GuardrailConfig>
  autoEstimate?: boolean
  autoRecommendModel?: boolean
  createdBy?: string
  blockedBy?: string[]
}

export interface CreateTaskToolOutput {
  taskId: string
  title: string
  status: TaskStatus
  tokenEstimation: TokenEstimation | null
  riskAssessment: RiskAssessment | null
  modelRecommendation: ModelRecommendation | null
  requiresApproval: boolean
  warnings: string[]
}

// ─── Tool 2: list_tasks ─────────────────────────────────────────────────────

export interface ListTasksToolInput {
  repoId?: string
  sprintName?: string
  status?: TaskStatus
  category?: TaskCategory
  limit?: number
  includeArchived?: boolean
}

export interface ListTasksToolOutput {
  tasks: TaskItem[]
  total: number
}

// ─── Tool 3: dispatch_task ──────────────────────────────────────────────────

export interface DispatchTaskToolInput {
  taskId: string
  telegramNotify?: boolean
  confirmed: boolean
}

export type DispatchTaskResult =
  | 'dispatched'
  | 'blocked'
  | 'requires_confirmation'
  | 'budget_cap_reached'

export interface DispatchTaskToolOutput {
  result: DispatchTaskResult
  runId: string | null
  message: string
}

// ─── Tool 3b: dispatch_sprint ─────────────────────────────────────────────

export interface DispatchSprintToolInput {
  sprintName: string
  repoId: string
  projectId?: string
  concurrencyCap?: number
  telegramNotify?: boolean
  confirmed: boolean
}

export interface DispatchSprintToolOutput {
  result: 'dispatched' | 'blocked' | 'requires_confirmation'
  runId: string | null
  message: string
  taskCount: number
}

// ─── Tool 3c: approve_task ────────────────────────────────────────────────

export interface ApproveTaskToolInput {
  runId: string
  taskId: string
  approved: boolean
}

export interface ApproveTaskToolOutput {
  approved: boolean
  message: string
}

// ─── Tool 4: estimate_tokens ────────────────────────────────────────────────

export interface EstimateTokensToolInput {
  description: string
  targetFiles?: string[]
  skills?: string[]
}

export type EstimateTokensToolOutput = TokenEstimation

// ─── Tool 5: recommend_model ────────────────────────────────────────────────

export interface RecommendModelToolInput {
  description: string
  targetFiles?: string[]
  skills?: string[]
  estimatedTokens?: number
  riskScore?: number
  quotaPercent?: number
}

export type RecommendModelToolOutput = ModelRecommendation

// ─── Tool 6: get_guardrails ─────────────────────────────────────────────────

export interface GetGuardrailsToolInput {
  repoPath: string
}

export interface GetGuardrailsToolOutput {
  guardrails: GuardrailConfig
  source: 'file' | 'default'
}

// ─── Tool 7: get_skills ─────────────────────────────────────────────────────

export interface GetSkillsToolInput {
  query?: string
  /** Absolute path to a target repo — includes that repo's skills alongside agenthub skills */
  repoPath?: string
}

export interface GetSkillsToolOutput {
  skills: SkillItem[]
  total: number
}

// ─── Tool 8: get_context ────────────────────────────────────────────────────

export interface GetContextToolInput {
  agentId?: string
}

export interface SelfAwarenessManifestAgent {
  id: string
  name: string
  status: AgentLifecycleStatus
  repoId: string
  model: string
  provider: ModelProvider
}

export interface SelfAwarenessManifestRepo {
  id: string
  name: string
  path: string
  taskCount: number
}

export interface SelfAwarenessManifestOrchestrator {
  enabled: boolean
  status: OrchestratorRunStatus | null
  activeTaskCount: number
  agentsSpawnedByRun: number
  agentCap: number
}

export interface SelfAwarenessManifestQuota {
  tokensThisSession: number
  sessionCap: number
}

export interface SelfAwarenessManifestSafeguards {
  killSwitchActive: boolean
  protectedPaths: string[]
  supervisedCategories: string[]
  requiresConfirmation: boolean
}

export interface SelfAwarenessManifest {
  timestamp: string
  appVersion: string
  orchestrator: SelfAwarenessManifestOrchestrator
  agents: SelfAwarenessManifestAgent[]
  repos: SelfAwarenessManifestRepo[]
  quota: SelfAwarenessManifestQuota
  safeguards: SelfAwarenessManifestSafeguards
  modelCatalog: ModelCatalogEntry[]
  skills: SkillItem[]
  healthAnomalies: HealthAnomaly[]
}

export type GetContextToolOutput = SelfAwarenessManifest

// ─── Tool 9: audit_deps ─────────────────────────────────────────────────────

export interface AuditDepsToolInput {
  packageJsonPath: string
}

export interface DependencyAuditEntry {
  name: string
  currentVersion: string
  latestVersion: string | null
  isOutdated: boolean
  isDeprecated: boolean
  error: string | null
}

export interface AuditDepsToolOutput {
  outdated: DependencyAuditEntry[]
  upToDate: DependencyAuditEntry[]
  deprecated: DependencyAuditEntry[]
  errors: DependencyAuditEntry[]
  checkedAt: string
}

// ─── Tool 10: create_project ─────────────────────────────────────────────────

export interface CreateProjectMcpInput {
  repoId: string
  name: string
  description?: string
}

export interface CreateProjectMcpOutput {
  projectId: string
  name: string
  created: boolean
}

// ─── Tool 14: archive_task ──────────────────────────────────────────────────

export interface ArchiveTaskToolInput {
  taskId: string
}

export interface ArchiveTaskToolOutput {
  taskId: string
  previousStatus: string
  message: string
}

// ─── Tool 15: report_files_changed ───────────────────────────────────────────

export interface ReportFilesChangedToolInput {
  taskId: string
  files: string[]
}

export interface ReportFilesChangedToolOutput {
  ok: boolean
  count: number
}
