import Database from 'better-sqlite3'
import type { TaskItem, TaskStatus, TaskCategory, TaskPriority } from '@shared/types/task.types'
import type { SelfAwarenessManifestRepo, SelfAwarenessManifestQuota, SelfAwarenessManifestSafeguards } from '@shared/types/mcp-server.types'

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Open agenthub.db in strict read-only mode.
 * Throws if the file does not exist at dbPath.
 */
export function openReadOnly(dbPath: string): Database.Database {
  return new Database(dbPath, { readonly: true, fileMustExist: true })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function taskRowToItem(row: Record<string, unknown>): TaskItem {
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
    blockedBy: [],
    targetFilesJson: (row.target_files_json as string) ?? null,
    skillsJson: (row.skills_json as string) ?? null,
    guardrailJson: (row.guardrail_json as string) ?? null,
    estimatedTokens: (row.estimated_tokens as number) ?? null,
    recommendedModel: (row.recommended_model as string) ?? null,
    riskScore: (row.risk_score as number) ?? null,
    riskFactorsJson: (row.risk_factors_json as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    targetFiles: safeJsonParse<string[]>(row.target_files_json as string),
    skills: safeJsonParse<string[]>(row.skills_json as string),
    guardrailOverrides: safeJsonParse<Record<string, unknown>>(row.guardrail_json as string),
    riskFactors: safeJsonParse<string[]>(row.risk_factors_json as string),
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
  sql += ` LIMIT ${Math.max(1, Math.floor(Number(filter.limit ?? 50)))}`

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(taskRowToItem)
}

export function getTaskByIdReadOnly(db: Database.Database, taskId: string): TaskItem | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as
    | Record<string, unknown>
    | undefined
  return row ? taskRowToItem(row) : null
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
  return {
    tokensThisSession: 0,
    sessionCap: capRaw ? Number(capRaw) : 100_000,
  }
}

export function getSafeguardsReadOnly(db: Database.Database): SelfAwarenessManifestSafeguards {
  const enabled = isOrchestratorEnabledReadOnly(db)
  const protectedPathsRaw = getSettingReadOnly(db, 'guardrails.protectedPaths')
  const protectedPaths = protectedPathsRaw
    ? (safeJsonParse<string[]>(protectedPathsRaw) ?? [])
    : []
  const supervisedRaw = getSettingReadOnly(db, 'guardrails.supervisedCategories')
  const supervisedCategories = supervisedRaw
    ? (safeJsonParse<string[]>(supervisedRaw) ?? [])
    : []

  return {
    killSwitchActive: !enabled,
    protectedPaths,
    supervisedCategories,
    requiresConfirmation: true,
  }
}
