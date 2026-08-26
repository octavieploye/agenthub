import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type {
  OrchestratorRun,
  OrchestratorRunStatus,
  OrchestratorPhase,
  OrchestratorPhaseStatus,
  OrchestratorTaskLog,
  OrchestratorTriggerSource
} from '../../../shared/types/orchestrator.types'

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function parseTaskIds(value: unknown): string[] | null {
  if (value == null) return null
  try {
    const parsed = JSON.parse(value as string)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

function mapRunRow(row: Record<string, unknown>): OrchestratorRun {
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
    taskIds: parseTaskIds(row.task_ids_json)
  }
}

function mapTaskLogRow(row: Record<string, unknown>): OrchestratorTaskLog {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    taskId: row.task_id as string,
    phase: row.phase as OrchestratorPhase,
    status: row.status as OrchestratorPhaseStatus,
    agentId: (row.agent_id as string) ?? null,
    modelUsed: (row.model_used as string) ?? null,
    providerUsed: (row.provider_used as string) ?? null,
    summaryJson: (row.summary_json as string) ?? null,
    issuesJson: (row.issues_json as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null
  }
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export function insertRun(
  db: Database.Database,
  input: {
    sprintName: string
    repoId: string
    projectId?: string
    concurrencyCap?: number
    telegramNotify?: boolean
    singleTaskId?: string
    startedBy?: string
    triggerSource?: OrchestratorTriggerSource
    taskIds?: string[]
  }
): OrchestratorRun {
  const id = randomUUID()
  const now = new Date().toISOString()
  const taskIdsJson = input.taskIds && input.taskIds.length > 0 ? JSON.stringify(input.taskIds) : null

  db.prepare(
    `INSERT INTO orchestrator_runs
       (id, sprint_name, project_id, repo_id, status, concurrency_cap, telegram_notify, single_task_id, started_by, trigger_source, task_ids_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.sprintName,
    input.projectId ?? null,
    input.repoId,
    input.concurrencyCap ?? 3,
    input.telegramNotify ? 1 : 0,
    input.singleTaskId ?? null,
    input.startedBy ?? null,
    input.triggerSource ?? null,
    taskIdsJson,
    now,
    now
  )

  log.info('Orchestrator run inserted', { id, sprintName: input.sprintName })

  return {
    id,
    sprintName: input.sprintName,
    projectId: input.projectId ?? null,
    repoId: input.repoId,
    status: 'idle',
    concurrencyCap: input.concurrencyCap ?? 3,
    telegramNotify: input.telegramNotify ?? false,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    singleTaskId: input.singleTaskId ?? null,
    startedBy: input.startedBy ?? null,
    triggerSource: input.triggerSource ?? null,
    taskIds: input.taskIds ?? null
  }
}

export function getRun(db: Database.Database, id: string): OrchestratorRun | null {
  const row = db.prepare('SELECT * FROM orchestrator_runs WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapRunRow(row) : null
}

export function getActiveRun(db: Database.Database): OrchestratorRun | null {
  const row = db
    .prepare("SELECT * FROM orchestrator_runs WHERE status IN ('running', 'paused') LIMIT 1")
    .get() as Record<string, unknown> | undefined
  return row ? mapRunRow(row) : null
}

export function updateRunStatus(
  db: Database.Database,
  id: string,
  status: OrchestratorRunStatus
): void {
  const now = new Date().toISOString()

  if (status === 'running') {
    db.prepare(
      `UPDATE orchestrator_runs
         SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ?
       WHERE id = ?`
    ).run(status, now, now, id)
  } else if (status === 'completed' || status === 'failed') {
    db.prepare(
      `UPDATE orchestrator_runs
         SET status = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(status, now, now, id)
  } else {
    db.prepare(
      `UPDATE orchestrator_runs SET status = ?, updated_at = ? WHERE id = ?`
    ).run(status, now, id)
  }

  log.info('Orchestrator run status updated', { id, status })
}

export function updateRunTimestamp(db: Database.Database, id: string): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE orchestrator_runs SET updated_at = ? WHERE id = ?').run(now, id)
}

// ---------------------------------------------------------------------------
// Task logs
// ---------------------------------------------------------------------------

export function insertTaskLog(
  db: Database.Database,
  input: {
    runId: string
    taskId: string
    phase: OrchestratorPhase
    modelUsed?: string
    providerUsed?: string
  }
): OrchestratorTaskLog {
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO orchestrator_task_log
       (id, run_id, task_id, phase, status, model_used, provider_used, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).run(
    id,
    input.runId,
    input.taskId,
    input.phase,
    input.modelUsed ?? null,
    input.providerUsed ?? null,
    now,
    now
  )

  log.info('Orchestrator task log inserted', { id, runId: input.runId, phase: input.phase })

  return {
    id,
    runId: input.runId,
    taskId: input.taskId,
    phase: input.phase,
    status: 'pending',
    agentId: null,
    modelUsed: input.modelUsed ?? null,
    providerUsed: input.providerUsed ?? null,
    summaryJson: null,
    issuesJson: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null
  }
}

export function updateTaskLogStatus(
  db: Database.Database,
  id: string,
  status: OrchestratorPhaseStatus,
  agentId?: string
): void {
  const now = new Date().toISOString()

  if (status === 'active') {
    if (agentId !== undefined) {
      db.prepare(
        `UPDATE orchestrator_task_log
           SET status = ?, agent_id = ?, started_at = COALESCE(started_at, ?), updated_at = ?
         WHERE id = ?`
      ).run(status, agentId, now, now, id)
    } else {
      db.prepare(
        `UPDATE orchestrator_task_log
           SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ?
         WHERE id = ?`
      ).run(status, now, now, id)
    }
  } else if (status === 'done' || status === 'failed' || status === 'skipped') {
    if (agentId !== undefined) {
      db.prepare(
        `UPDATE orchestrator_task_log
           SET status = ?, agent_id = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(status, agentId, now, now, id)
    } else {
      db.prepare(
        `UPDATE orchestrator_task_log
           SET status = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(status, now, now, id)
    }
  } else {
    if (agentId !== undefined) {
      db.prepare(
        `UPDATE orchestrator_task_log SET status = ?, agent_id = ?, updated_at = ? WHERE id = ?`
      ).run(status, agentId, now, id)
    } else {
      db.prepare(
        `UPDATE orchestrator_task_log SET status = ?, updated_at = ? WHERE id = ?`
      ).run(status, now, id)
    }
  }

  log.info('Orchestrator task log status updated', { id, status })
}

export function updateTaskLogSummary(
  db: Database.Database,
  id: string,
  summaryJson: string,
  issuesJson?: string
): void {
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE orchestrator_task_log
       SET summary_json = ?, issues_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(summaryJson, issuesJson ?? null, now, id)
}

export function getTaskLogsByRun(
  db: Database.Database,
  runId: string
): OrchestratorTaskLog[] {
  const rows = db
    .prepare('SELECT * FROM orchestrator_task_log WHERE run_id = ? ORDER BY created_at ASC')
    .all(runId)
  return rows.map((r) => mapTaskLogRow(r as Record<string, unknown>))
}

export function getTaskLogsByTask(
  db: Database.Database,
  taskId: string
): OrchestratorTaskLog[] {
  const rows = db
    .prepare('SELECT * FROM orchestrator_task_log WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId)
  return rows.map((r) => mapTaskLogRow(r as Record<string, unknown>))
}

export function getActiveTaskLogs(
  db: Database.Database,
  runId: string
): OrchestratorTaskLog[] {
  const rows = db
    .prepare(
      "SELECT * FROM orchestrator_task_log WHERE run_id = ? AND status = 'active' ORDER BY created_at ASC"
    )
    .all(runId)
  return rows.map((r) => mapTaskLogRow(r as Record<string, unknown>))
}

export function getActiveTaskLogByAgentId(
  db: Database.Database,
  runId: string,
  agentId: string
): OrchestratorTaskLog | null {
  const row = db
    .prepare(
      "SELECT * FROM orchestrator_task_log WHERE run_id = ? AND agent_id = ? AND status = 'active' LIMIT 1"
    )
    .get(runId, agentId) as Record<string, unknown> | undefined
  return row ? mapTaskLogRow(row) : null
}

// ---------------------------------------------------------------------------
// Retry failures
// ---------------------------------------------------------------------------

export interface RetryFailureRow {
  id: string
  taskId: string
  provider: string
  attempts: number
  lastError: string | null
  diagnostics: string | null
  createdAt: string
}

export function insertRetryFailure(
  db: Database.Database,
  input: {
    taskId: string
    provider: string
    attempts: number
    lastError?: string | null
    diagnostics?: string | null
  }
): void {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO retry_failures (id, task_id, provider, attempts, last_error, diagnostics)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.taskId, input.provider, input.attempts, input.lastError ?? null, input.diagnostics ?? null)
  log.info('Retry failure recorded', { id, taskId: input.taskId, provider: input.provider })
}

export function getUnacknowledgedRetryFailures(db: Database.Database): RetryFailureRow[] {
  const rows = db.prepare(
    `SELECT id, task_id, provider, attempts, last_error, diagnostics, created_at
     FROM retry_failures
     WHERE acknowledged_at IS NULL
     ORDER BY created_at DESC`
  ).all() as Record<string, unknown>[]
  return rows.map(r => ({
    id: r.id as string,
    taskId: r.task_id as string,
    provider: r.provider as string,
    attempts: r.attempts as number,
    lastError: (r.last_error as string) ?? null,
    diagnostics: (r.diagnostics as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

export function acknowledgeRetryFailures(db: Database.Database): void {
  db.prepare(
    `UPDATE retry_failures SET acknowledged_at = datetime('now')
     WHERE acknowledged_at IS NULL`
  ).run()
  log.info('Retry failures acknowledged')
}

export function cleanupOldRetryFailures(db: Database.Database): number {
  const result = db.prepare(
    `DELETE FROM retry_failures
     WHERE acknowledged_at IS NOT NULL
     AND acknowledged_at < datetime('now', '-30 days')`
  ).run()
  if (result.changes > 0) {
    log.info('Cleaned up old retry failures', { count: result.changes })
  }
  return result.changes
}
