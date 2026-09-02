import type { GuardrailConfig } from './config.types'
import type { SkillItem } from './skills.types'
import type { TaskItem, TaskStatus, TaskCategory, TaskPriority, CreateTaskInput, UpdateTaskInput } from './task.types'
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

// ─── IPC message protocol (main process ↔ MCP server child) ────────────────

export type McpIpcRequest =
  | { type: 'create_task'; payload: CreateTaskInput }
  | { type: 'update_task'; payload: { taskId: string; updates: UpdateTaskInput } }
  | { type: 'dispatch_task'; payload: { taskId: string; telegramNotify: boolean; confirmed: boolean } }
  | { type: 'get_active_agents'; payload: Record<string, never> }
  | { type: 'get_orchestrator_status'; payload: Record<string, never> }
  | { type: 'get_health_anomalies'; payload: { agentId?: string } }

// FCR-007: typed generic variants — backward compatible (T defaults to unknown)
export type McpIpcSuccessResponse<T = unknown> = { type: 'success'; data: T }
export type McpIpcErrorResponse = { type: 'error'; message: string; code?: string }

export type McpIpcResponse = McpIpcSuccessResponse | McpIpcErrorResponse

// FCR-004: loosely typed return alias for routeRequest() — callers must narrow before use
/** Loosely typed return for routeRequest — callers must narrow before use */
export type McpIpcRouteResult = Record<string, unknown> | Array<unknown> | null
