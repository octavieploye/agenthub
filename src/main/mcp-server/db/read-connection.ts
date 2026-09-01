import Database from 'better-sqlite3'
import type { TaskItem, TaskStatus, TaskCategory, TaskPriority } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'
import type { OrchestratorRun, OrchestratorRunStatus, OrchestratorTriggerSource } from '@shared/types/orchestrator.types'
import type { SelfAwarenessManifestRepo, SelfAwarenessManifestQuota, SelfAwarenessManifestSafeguards } from '@shared/types/mcp-server.types'

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Open agenthub.db in strict read-only mode.
 * Throws if the file does not exist at dbPath.
 */
export function openReadOnly(dbPath = process.env['AGENTHUB_DB_PATH']): Database.Database {
  if (!dbPath) {
    throw new Error('AGENTHUB_DB_PATH is not set')
  }
  return new Database(dbPath, { readonly: true, fileMustExist: true })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function safeJsonParse(value: string | null | undefined): unknown | null {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function parseStringArray(value: string | null | undefined): string[] | null {
  const parsed = safeJsonParse(value)
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : null
}

function parseRecord(value: string | null | undefined): Record<string, unknown> | null {
  const parsed = safeJsonParse(value)
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null
}

function taskRowToItem(row: Record<string, unknown>, blockedBy: string[] = []): TaskItem {
  const id = row.id as string
  return {
    id,
    repoId: row.repo_id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    priority: ((row.priority as number) ?? 3) as TaskPriority,
    status: ((row.status as string) ?? 'backlog') as TaskStatus,
    category: ((row.category as string) ?? null) as TaskCategory | null,
    agentId: (row.agent_id as string) ?? null,
    position: (row.position as number) ?? 0,
    sbarId: (row.sbar_id as string) ?? null,
    sprintName: (row.sprint_name as string) ?? null,
    epicName: (row.epic_name as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    sectionTargetDate: (row.section_target_date as string) ?? null,
    note: (row.note as string) ?? null,
    requiresApproval: Boolean(row.requires_approval),
    modelOverride: (row.model_override as string) ?? null,
    providerOverride: (row.provider_override as string) ?? null,
    dateTriggerFiredAt: (row.date_trigger_fired_at as string) ?? null,
    blockedBy,
    targetFilesJson: (row.target_files_json as string) ?? null,
    skillsJson: (row.skills_json as string) ?? null,
    guardrailJson: (row.guardrail_json as string) ?? null,
    estimatedTokens: (row.estimated_tokens as number) ?? null,
    recommendedModel: (row.recommended_model as string) ?? null,
    riskScore: (row.risk_score as number) ?? null,
    riskFactorsJson: (row.risk_factors_json as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    targetFiles: parseStringArray(row.target_files_json as string),
    skills: parseStringArray(row.skills_json as string),
    guardrailOverrides: parseRecord(row.guardrail_json as string),
    riskFactors: parseStringArray(row.risk_factors_json as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ─── Task queries ─────────────────────────────────────────────────────────────

export interface ListTasksFilter {
  repoId?: string
  sprintName?: string
  status?: TaskStatus
  category?: TaskCategory
  limit?: number
}

const DEFAULT_TASK_LIMIT = 50
const MAX_TASK_LIMIT = 100

function normalizeTaskLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_TASK_LIMIT
  return Math.min(MAX_TASK_LIMIT, Math.max(1, Math.floor(limit)))
}

function getDependencyMap(db: Database.Database, taskIds?: string[]): Map<string, string[]> {
  if (taskIds?.length === 0) return new Map()

  const sql = taskIds
    ? `SELECT task_id, depends_on_id FROM task_dependencies WHERE task_id IN (${taskIds.map(() => '?').join(', ')})`
    : 'SELECT task_id, depends_on_id FROM task_dependencies'
  const rows = db.prepare(sql).all(...(taskIds ?? [])) as { task_id: string; depends_on_id: string }[]
  const dependencies = new Map<string, string[]>()

  for (const row of rows) {
    const current = dependencies.get(row.task_id) ?? []
    current.push(row.depends_on_id)
    dependencies.set(row.task_id, current)
  }

  return dependencies
}

export function listTasksReadOnly(db: Database.Database, filter: ListTasksFilter): TaskItem[] {
  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params: (string | number)[] = []

  if (filter.repoId) {
    sql += ' AND repo_id = ?'
    params.push(filter.repoId)
  }
  if (filter.sprintName) {
    sql += ' AND sprint_name = ?'
    params.push(filter.sprintName)
  }
  if (filter.status) {
    sql += ' AND status = ?'
    params.push(filter.status)
  }
  if (filter.category) {
    sql += ' AND category = ?'
    params.push(filter.category)
  }

  sql += ' ORDER BY priority ASC, created_at DESC'
  sql += ' LIMIT ?'
  params.push(normalizeTaskLimit(filter.limit))

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  const dependencyMap = getDependencyMap(db, rows.map((row) => row.id as string))
  return rows.map((row) => taskRowToItem(row, dependencyMap.get(row.id as string) ?? []))
}

export function getTaskByIdReadOnly(db: Database.Database, taskId: string): TaskItem | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as
    | Record<string, unknown>
    | undefined
  if (!row) return null
  return taskRowToItem(row, getDependencyMap(db, [taskId]).get(taskId) ?? [])
}

// ─── Repo queries ─────────────────────────────────────────────────────────────

export function listReposReadOnly(db: Database.Database): SelfAwarenessManifestRepo[] {
  const rows = db
    .prepare('SELECT id, name, path FROM repos WHERE hidden = 0 ORDER BY created_at DESC')
    .all() as { id: string; name: string; path: string }[]

  const counts = db
    .prepare('SELECT repo_id, COUNT(*) as c FROM tasks GROUP BY repo_id')
    .all() as { repo_id: string; c: number }[]

  const countMap = new Map(counts.map((r) => [r.repo_id, r.c]))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    taskCount: countMap.get(r.id) ?? 0,
  }))
}

export function getRepoByIdReadOnly(db: Database.Database, repoId: string): RepoConfig | null {
  const row = db
    .prepare('SELECT * FROM repos WHERE id = ? AND hidden = 0')
    .get(repoId) as Record<string, unknown> | undefined

  if (!row) return null
  return {
    id: row.id as string,
    name: row.name as string,
    path: row.path as string,
    glowColor: (row.glow_color as string) ?? undefined,
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string) ?? undefined,
  }
}

// ─── Orchestrator run queries ────────────────────────────────────────────────

function parseTaskIds(value: string | null | undefined): string[] | null {
  return parseStringArray(value)
}

function orchestratorRunRowToItem(row: Record<string, unknown>): OrchestratorRun {
  return {
    id: row.id as string,
    sprintName: row.sprint_name as string,
    projectId: (row.project_id as string) ?? null,
    repoId: row.repo_id as string,
    status: row.status as OrchestratorRunStatus,
    concurrencyCap: row.concurrency_cap as number,
    telegramNotify: Boolean(row.telegram_notify),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    singleTaskId: (row.single_task_id as string) ?? null,
    startedBy: (row.started_by as string) ?? null,
    triggerSource: (row.trigger_source as OrchestratorTriggerSource) ?? null,
    taskIds: parseTaskIds((row.task_ids_json as string) ?? null),
  }
}

export function getOrchestratorRunReadOnly(db: Database.Database, runId: string): OrchestratorRun | null {
  const row = db.prepare('SELECT * FROM orchestrator_runs WHERE id = ?').get(runId) as
    | Record<string, unknown>
    | undefined
  return row ? orchestratorRunRowToItem(row) : null
}

export function getActiveOrchestratorRunReadOnly(db: Database.Database): OrchestratorRun | null {
  const row = db
    .prepare("SELECT * FROM orchestrator_runs WHERE status IN ('running', 'paused') ORDER BY updated_at DESC LIMIT 1")
    .get() as Record<string, unknown> | undefined
  return row ? orchestratorRunRowToItem(row) : null
}

// ─── Settings queries ─────────────────────────────────────────────────────────

export function getSettingReadOnly(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function isOrchestratorEnabledReadOnly(db: Database.Database): boolean {
  return getSettingReadOnly(db, 'orchestrator.enabled') === 'true'
}

// ─── Composite helpers for context manifest ───────────────────────────────────

export function getQuotaReadOnly(db: Database.Database): SelfAwarenessManifestQuota {
  const capRaw = getSettingReadOnly(db, 'quota.sessionCap')
  const sessionCap = capRaw ? Number(capRaw) : NaN
  return {
    tokensThisSession: 0,
    sessionCap: Number.isFinite(sessionCap) && sessionCap > 0 ? sessionCap : 100_000,
  }
}

export function getSafeguardsReadOnly(db: Database.Database): SelfAwarenessManifestSafeguards {
  const enabled = isOrchestratorEnabledReadOnly(db)
  const protectedPathsRaw = getSettingReadOnly(db, 'guardrails.protectedPaths')
  const protectedPaths = protectedPathsRaw
    ? (parseStringArray(protectedPathsRaw) ?? [])
    : []
  const supervisedRaw = getSettingReadOnly(db, 'guardrails.supervisedCategories')
  const supervisedCategories = supervisedRaw
    ? (parseStringArray(supervisedRaw) ?? [])
    : []

  return {
    killSwitchActive: !enabled,
    protectedPaths,
    supervisedCategories,
    requiresConfirmation: true,
  }
}
