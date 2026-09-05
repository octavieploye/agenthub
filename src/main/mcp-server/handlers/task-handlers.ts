import type {
  CreateTaskToolInput,
  CreateTaskToolOutput,
  ListTasksToolInput,
  ListTasksToolOutput,
  DispatchTaskToolInput,
  DispatchTaskToolOutput,
  DispatchSprintToolInput,
  DispatchSprintToolOutput,
  CreateProjectMcpInput,
  CreateProjectMcpOutput,
  McpIpcRequest,
  McpIpcResponse,
  TokenEstimation,
  RiskAssessment,
  ModelRecommendation
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

const VALID_PRIORITIES = new Set([1, 2, 3])
const VALID_PROVIDERS = new Set(['anthropic', 'ollama-local', 'ollama-cloud', 'openai-codex'])
const MAX_LIST_TASKS = 50

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
}

function assertOptionalString(value: unknown, fieldName: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`)
  }
}

function assertOptionalStringArray(value: unknown, fieldName: string): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
  ) {
    throw new Error(`${fieldName} must be an array of strings`)
  }
}

function assertOptionalBoolean(value: unknown, fieldName: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`)
  }
}

function validateCreateTaskInput(input: CreateTaskToolInput): void {
  assertNonEmptyString(input.repoId, 'repoId')
  assertNonEmptyString(input.title, 'title')

  for (const fieldName of [
    'description',
    'sprintName',
    'epicName',
    'projectId',
    'category',
    'modelOverride',
    'createdBy'
  ]) {
    assertOptionalString(input[fieldName as keyof CreateTaskToolInput], fieldName)
  }
  assertOptionalStringArray(input.targetFiles, 'targetFiles')
  assertOptionalStringArray(input.skills, 'skills')
  assertOptionalStringArray(input.blockedBy, 'blockedBy')
  assertOptionalBoolean(input.requiresApproval, 'requiresApproval')
  assertOptionalBoolean(input.autoEstimate, 'autoEstimate')
  assertOptionalBoolean(input.autoRecommendModel, 'autoRecommendModel')

  if (input.priority !== undefined && !VALID_PRIORITIES.has(input.priority)) {
    throw new Error('priority must be 1, 2, or 3')
  }
  if (input.providerOverride !== undefined && !VALID_PROVIDERS.has(input.providerOverride)) {
    throw new Error(`providerOverride must be one of: ${[...VALID_PROVIDERS].join(', ')}`)
  }
  if (
    input.guardrailOverrides !== undefined &&
    (typeof input.guardrailOverrides !== 'object' ||
      input.guardrailOverrides === null ||
      Array.isArray(input.guardrailOverrides))
  ) {
    throw new Error('guardrailOverrides must be an object')
  }
}

// ─── S7 guardrail injection ───────────────────────────────────────────────────

const S7_PROTECTED_PATHS = [
  '*.test.ts',
  '*.spec.ts',
  '*.test.js',
  '*.spec.js',
  'package-lock.json',
  '.gitignore'
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
  validateCreateTaskInput(input)
  const warnings: string[] = []

  // --- S7: inject standard guardrails ---
  const guardrailOverrides = injectS7Guardrails(input.guardrailOverrides)

  // --- Token estimation ---
  let tokenEstimation: TokenEstimation | null = null
  if (input.autoEstimate) {
    tokenEstimation = estimateTokens({
      description: input.description,
      targetFiles: input.targetFiles,
      skills: input.skills
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
      protectedPaths: guardrailOverrides.protectedPaths
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
      riskScore: riskAssessment?.riskScore
    })
    modelRecommendation = {
      modelId: rec.modelId,
      provider: rec.provider,
      capabilityTier: rec.capabilityTier,
      rationale: rec.rationale,
      estimatedTokens: rec.estimatedTokens,
      contextWindowFit: rec.contextWindowFit,
      riskAdjusted: rec.riskAdjusted
    }
  }

  // --- Build CreateTaskInput ---
  const createInput: CreateTaskInput = {
    repoId: input.repoId,
    title: input.title,
    description: input.description,
    sprintName: input.sprintName,
    epicName: input.epicName,
    projectId: input.projectId,
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
    riskFactorsJson: riskAssessment ? JSON.stringify(riskAssessment.riskFactors) : undefined,
    createdBy: input.createdBy ?? 'mcp-agent',
    dependsOn: input.blockedBy
  }

  // --- Send to main process via IPC ---
  const resp = await deps.sendIpc({ type: 'create_task', payload: createInput })

  if (resp.type === 'error') {
    throw new Error(`create_task IPC error: ${resp.message}`)
  }

  if (!resp.data) throw new Error('create_task: empty response from main process')
  const raw = resp.data as Record<string, unknown>
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.status !== 'string') {
    throw new Error('create_task: malformed response — missing id, title, or status')
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
    warnings
  }
}

// ─── handleListTasks ──────────────────────────────────────────────────────────

export function handleListTasks(
  input: ListTasksToolInput,
  db: Database.Database
): ListTasksToolOutput {
  const limit =
    input.limit === undefined || !Number.isFinite(input.limit)
      ? MAX_LIST_TASKS
      : Math.min(MAX_LIST_TASKS, Math.max(1, Math.floor(input.limit)))
  const tasks = listTasksReadOnly(db, {
    repoId: input.repoId,
    sprintName: input.sprintName,
    status: input.status,
    category: input.category,
    limit
  })

  return { tasks, total: tasks.length }
}

// ─── handleDispatchTask ───────────────────────────────────────────────────────

export async function handleDispatchTask(
  input: DispatchTaskToolInput,
  deps: TaskHandlerDeps
): Promise<DispatchTaskToolOutput> {
  assertNonEmptyString(input.taskId, 'taskId')
  if (typeof input.confirmed !== 'boolean') {
    throw new Error('confirmed must be a boolean')
  }
  assertOptionalBoolean(input.telegramNotify, 'telegramNotify')

  // S1: kill-switch check — read from DB
  const orchestratorEnabled = isOrchestratorEnabledReadOnly(deps.db)
  if (!orchestratorEnabled) {
    return {
      result: 'blocked',
      runId: null,
      message:
        'Orchestrator is disabled (kill-switch active). Enable it in AgentHub settings to dispatch tasks.'
    }
  }

  // S4: confirmation gate
  if (!input.confirmed) {
    return {
      result: 'requires_confirmation',
      runId: null,
      message:
        'dispatch_task requires confirmed: true. Review the task, then re-call with confirmed: true to proceed.'
    }
  }

  // Send to main process — S5 budget cap enforced there
  const resp = await deps.sendIpc({
    type: 'dispatch_task',
    payload: {
      taskId: input.taskId,
      telegramNotify: input.telegramNotify ?? false,
      confirmed: input.confirmed
    }
  })

  if (resp.type === 'error') {
    if (resp.code === 'BUDGET_CAP_REACHED') {
      return {
        result: 'budget_cap_reached',
        runId: null,
        message: resp.message
      }
    }
    throw new Error(`dispatch_task IPC error: ${resp.message}`)
  }

  if (!resp.data || typeof (resp.data as { id?: unknown }).id !== 'string') {
    throw new Error('dispatch_task: invalid response shape from main process')
  }
  const data = resp.data as { id: string }
  return {
    result: 'dispatched',
    runId: data.id ?? null,
    message: `Task ${input.taskId} dispatched successfully.`
  }
}

// ─── handleCreateProject ──────────────────────────────────────────────────────

export async function handleCreateProject(
  input: CreateProjectMcpInput,
  deps: TaskHandlerDeps
): Promise<CreateProjectMcpOutput> {
  assertNonEmptyString(input.repoId, 'repoId')
  assertNonEmptyString(input.name, 'name')

  const resp = await deps.sendIpc({ type: 'create_project', payload: input })

  if (resp.type === 'error') {
    throw new Error(`create_project IPC error: ${resp.message}`)
  }

  if (!resp.data) throw new Error('create_project: empty response from main process')
  const raw = resp.data as Record<string, unknown>
  if (typeof raw.projectId !== 'string' || typeof raw.name !== 'string' || typeof raw.created !== 'boolean') {
    throw new Error('create_project: malformed response — missing projectId, name, or created')
  }

  return {
    projectId: raw.projectId,
    name: raw.name,
    created: raw.created
  }
}

// ─── handleDispatchSprint ────────────────────────────────────────────────────

export async function handleDispatchSprint(
  input: DispatchSprintToolInput,
  deps: TaskHandlerDeps
): Promise<DispatchSprintToolOutput> {
  assertNonEmptyString(input.sprintName, 'sprintName')
  assertNonEmptyString(input.repoId, 'repoId')
  if (typeof input.confirmed !== 'boolean') {
    throw new Error('confirmed must be a boolean')
  }
  assertOptionalBoolean(input.telegramNotify, 'telegramNotify')

  // S1: kill-switch check
  const orchestratorEnabled = isOrchestratorEnabledReadOnly(deps.db)
  if (!orchestratorEnabled) {
    return {
      result: 'blocked',
      runId: null,
      message: 'Orchestrator is disabled (kill-switch active). Enable it in AgentHub settings to dispatch sprints.',
      taskCount: 0
    }
  }

  // S4: confirmation gate
  if (!input.confirmed) {
    return {
      result: 'requires_confirmation',
      runId: null,
      message: 'dispatch_sprint requires confirmed: true. Review the sprint tasks, then re-call with confirmed: true.',
      taskCount: 0
    }
  }

  const resp = await deps.sendIpc({
    type: 'dispatch_sprint',
    payload: {
      sprintName: input.sprintName,
      repoId: input.repoId,
      projectId: input.projectId,
      concurrencyCap: input.concurrencyCap,
      telegramNotify: input.telegramNotify ?? false,
      confirmed: input.confirmed
    }
  })

  if (resp.type === 'error') {
    throw new Error(`dispatch_sprint IPC error: ${resp.message}`)
  }

  const data = resp.data as { id: string; taskCount: number }
  return {
    result: 'dispatched',
    runId: data.id,
    message: `Sprint "${input.sprintName}" dispatched with ${data.taskCount} tasks.`,
    taskCount: data.taskCount
  }
}
