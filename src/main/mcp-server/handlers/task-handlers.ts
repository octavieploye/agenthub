import type {
  CreateTaskToolInput,
  CreateTaskToolOutput,
  ListTasksToolInput,
  ListTasksToolOutput,
  DispatchTaskToolInput,
  DispatchTaskToolOutput,
  McpIpcRequest,
  McpIpcResponse,
  TokenEstimation,
  RiskAssessment,
  ModelRecommendation,
} from '@shared/types/mcp-server.types'
import type { TaskItem, CreateTaskInput } from '@shared/types/task.types'
import type { GuardrailConfig } from '@shared/types/config.types'
import type Database from 'better-sqlite3'
import { estimateTokens } from '../engines/token-estimator'
import { calculateRisk } from '../engines/risk-calculator'
import { handleRecommendModel } from './model-handlers'
import { listTasksReadOnly, isOrchestratorEnabledReadOnly } from '../db/read-connection'

// ─── Handler deps ─────────────────────────────────────────────────────────────

export interface TaskHandlerDeps {
  db: Database.Database
  sendIpc: (req: McpIpcRequest) => Promise<McpIpcResponse>
  activeGuardrails?: Partial<GuardrailConfig>
}

// ─── S7 guardrail injection ───────────────────────────────────────────────────

const S7_PROTECTED_PATHS = [
  '*.test.ts',
  '*.spec.ts',
  '*.test.js',
  '*.spec.js',
  'package-lock.json',
  '.gitignore',
]

function injectS7Guardrails(
  existing: Partial<GuardrailConfig> | undefined
): Partial<GuardrailConfig> {
  const base = existing ?? {}
  const existingPaths = base.protectedPaths ?? []
  const merged = Array.from(new Set([...existingPaths, ...S7_PROTECTED_PATHS]))
  return { ...base, protectedPaths: merged }
}

// ─── handleCreateTask ─────────────────────────────────────────────────────────

export async function handleCreateTask(
  input: CreateTaskToolInput,
  deps: TaskHandlerDeps
): Promise<CreateTaskToolOutput> {
  const warnings: string[] = []

  // --- S7: inject standard guardrails ---
  const guardrailOverrides = injectS7Guardrails(input.guardrailOverrides)

  // --- Token estimation ---
  let tokenEstimation: TokenEstimation | null = null
  if (input.autoEstimate) {
    tokenEstimation = estimateTokens({
      description: input.description,
      targetFiles: input.targetFiles,
      skills: input.skills,
    })
    warnings.push(...tokenEstimation.warnings)
  }

  // --- Risk assessment ---
  let riskAssessment: RiskAssessment | null = null
  if (input.targetFiles || input.description || input.category) {
    riskAssessment = calculateRisk({
      description: input.description,
      targetFiles: input.targetFiles,
      skills: input.skills,
      category: input.category,
      requiresApproval: input.requiresApproval,
      estimatedTokens: tokenEstimation?.estimatedTokens,
      protectedPaths: deps.activeGuardrails?.protectedPaths,
    })
  }

  // --- Force requiresApproval when risk is high ---
  let requiresApproval = input.requiresApproval ?? false
  if (riskAssessment && riskAssessment.riskScore >= 0.7) {
    requiresApproval = true
    warnings.push(
      `Risk score ${riskAssessment.riskScore} >= 0.7 — requiresApproval automatically set to true`
    )
  }

  // --- Model recommendation ---
  let modelRecommendation: ModelRecommendation | null = null
  if (input.autoRecommendModel) {
    const rec = handleRecommendModel({
      description: input.description ?? input.title,
      targetFiles: input.targetFiles,
      skills: input.skills,
      estimatedTokens: tokenEstimation?.estimatedTokens,
      riskScore: riskAssessment?.riskScore,
    })
    modelRecommendation = {
      modelId: rec.modelId,
      provider: rec.provider,
      capabilityTier: rec.capabilityTier,
      rationale: rec.rationale,
      estimatedTokens: rec.estimatedTokens,
      contextWindowFit: rec.contextWindowFit,
      riskAdjusted: rec.riskAdjusted,
    }
  }

  // --- Build CreateTaskInput ---
  const createInput: CreateTaskInput = {
    repoId: input.repoId,
    title: input.title,
    description: input.description,
    sprintName: input.sprintName,
    epicName: input.epicName,
    category: input.category ?? null,
    priority: input.priority,
    requiresApproval,
    modelOverride: input.modelOverride ?? modelRecommendation?.modelId,
    providerOverride: input.providerOverride,
    targetFiles: input.targetFiles,
    skills: input.skills,
    guardrailOverrides,
    guardrailJson: JSON.stringify(guardrailOverrides),
    estimatedTokens: tokenEstimation?.estimatedTokens,
    recommendedModel: modelRecommendation?.modelId ?? undefined,
    riskScore: riskAssessment?.riskScore,
    riskFactors: riskAssessment?.riskFactors,
    createdBy: input.createdBy ?? 'mcp-agent',
  }

  // --- Send to main process via IPC ---
  const resp = await deps.sendIpc({ type: 'create_task', payload: createInput })

  if (resp.type === 'error') {
    throw new Error(`create_task IPC error: ${resp.message}`)
  }

  const task = resp.data as TaskItem

  return {
    taskId: task.id,
    title: task.title,
    status: task.status,
    tokenEstimation,
    riskAssessment,
    modelRecommendation,
    requiresApproval,
    warnings,
  }
}

// ─── handleListTasks ──────────────────────────────────────────────────────────

export function handleListTasks(
  input: ListTasksToolInput,
  db: Database.Database
): ListTasksToolOutput {
  const tasks = listTasksReadOnly(db, {
    repoId: input.repoId,
    sprintName: input.sprintName,
    status: input.status,
    category: input.category,
    limit: input.limit ?? 50,
  })

  return { tasks, total: tasks.length }
}

// ─── handleDispatchTask ───────────────────────────────────────────────────────

export async function handleDispatchTask(
  input: DispatchTaskToolInput,
  deps: TaskHandlerDeps
): Promise<DispatchTaskToolOutput> {
  // S1: kill-switch check — read from DB
  const orchestratorEnabled = isOrchestratorEnabledReadOnly(deps.db)
  if (!orchestratorEnabled) {
    return {
      result: 'blocked',
      runId: null,
      message:
        'Orchestrator is disabled (kill-switch active). Enable it in AgentHub settings to dispatch tasks.',
    }
  }

  // S4: confirmation gate
  if (!input.confirmed) {
    return {
      result: 'requires_confirmation',
      runId: null,
      message:
        'dispatch_task requires confirmed: true. Review the task, then re-call with confirmed: true to proceed.',
    }
  }

  // Send to main process — S5 budget cap enforced there
  const resp = await deps.sendIpc({
    type: 'dispatch_task',
    payload: {
      taskId: input.taskId,
      telegramNotify: input.telegramNotify ?? false,
      confirmed: input.confirmed,
    },
  })

  if (resp.type === 'error') {
    if (resp.code === 'BUDGET_CAP_REACHED') {
      return {
        result: 'budget_cap_reached',
        runId: null,
        message: resp.message,
      }
    }
    throw new Error(`dispatch_task IPC error: ${resp.message}`)
  }

  const data = resp.data as { runId: string }
  return {
    result: 'dispatched',
    runId: data.runId ?? null,
    message: `Task ${input.taskId} dispatched successfully.`,
  }
}
