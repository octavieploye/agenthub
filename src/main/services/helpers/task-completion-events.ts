import { isAbsolute, relative } from 'path'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { getTaskById } from '../../db/queries/tasks.queries'
import { getRepoById } from '../../db/queries/repos.queries'
import { insertTaskEvent } from '../../db/queries/task-events.queries'
import { getSBARByAgentId } from '../../db/queries/sbar.queries'
import { updateTaskLogSummary } from '../../db/queries/orchestrator.queries'
import { getAnamnesisWriter } from '../service-registry'
import type { TaskEvent, TaskItem } from '../../../shared/types/task.types'
import type { OrchestratorTaskLog } from '../../../shared/types/orchestrator.types'
import type { SBARHandoff } from '../../../shared/types/recovery.types'

export interface TaskCompletionEventInput {
  taskId: string
  agentId: string
  /** Status before the completion write. Defaults to the task's current status. */
  fromStatus?: string | null
}

/** SBAR text copied into event payloads and summaries (purge deletes sbar_handoffs rows after 24 h). */
type SBARCopy = Pick<
  SBARHandoff,
  'id' | 'situation' | 'background' | 'assessment' | 'recommendation' | 'createdAt'
>

/** S87: the only CARD_COMPLETED payload keys that are stored and forwarded to Anamnesis. */
export const COMPLETION_PAYLOAD_KEYS = ['taskTitle', 'sprintName', 'repoId', 'sbar'] as const
type CompletionPayloadKey = (typeof COMPLETION_PAYLOAD_KEYS)[number]

/** S87: the only SBAR keys kept in the copy. */
export const SBAR_COPY_KEYS = ['id', 'situation', 'background', 'assessment', 'recommendation', 'createdAt'] as const

/** Task facts the redaction needs: title + sprint replace the prompt, repoPath makes paths relative. */
export interface SBARRedactionContext {
  taskTitle: string
  sprintName: string | null
  taskDescription: string | null
  repoPath: string | null
}

const WORKING_ON_MARKER = ' while working on: '
const WORKING_DIR_PATTERN = /Working directory: (.*?)(?=\. Model: |$)/
/** Raw terminal text (sbar-generator assessment): errors and last output lines, always the tail. */
const RAW_OUTPUT_PATTERN = /(?:\.\s)?(?:Errors encountered \(\d+\):|Last output:)[\s\S]*$/
const OUTSIDE_REPO = '[outside repo]'

/**
 * Record the single CARD_COMPLETED task_event for (task, agent), with a COPY of the agent's SBAR.
 * Looks the task up by id (getTaskByAgentId hides completed tasks), so it still emits when the
 * task is already 'completed'. Idempotent: returns null when the event already exists.
 * Unknown task → null. Never throws: an event failure must not break the completion write.
 */
export function emitTaskCompletionEvent(
  db: Database.Database,
  input: TaskCompletionEventInput
): TaskEvent | null {
  try {
    const task = getTaskById(db, input.taskId)
    if (!task) return null
    if (hasCompletionEvent(db, task.id, input.agentId)) return null
    const event = insertTaskEvent(db, {
      taskId: task.id,
      eventType: 'CARD_COMPLETED',
      fromStatus: input.fromStatus === undefined ? task.status : input.fromStatus,
      toStatus: 'completed',
      agentId: input.agentId,
      payload: {
        taskTitle: task.title,
        sprintName: task.sprintName,
        repoId: task.repoId,
        sbar: copyAgentSBAR(db, input.agentId, buildRedactionContext(db, task))
      } satisfies Record<CompletionPayloadKey, unknown>
    })
    getAnamnesisWriter()?.onEventInserted()
    return event
  } catch (err) {
    log.warn('task-completion-events: failed to record CARD_COMPLETED', {
      taskId: input.taskId,
      agentId: input.agentId,
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

/**
 * Copy the agent's SBAR into the orchestrator task log summary_json. No SBAR → no write.
 * Keeps the log's existing issues_json. Never throws.
 */
export function writeTaskCompletionSummary(
  db: Database.Database,
  taskLog: OrchestratorTaskLog,
  agentId: string
): void {
  try {
    const task = getTaskById(db, taskLog.taskId)
    if (!task) return
    const sbar = copyAgentSBAR(db, agentId, buildRedactionContext(db, task))
    if (!sbar) return
    updateTaskLogSummary(
      db,
      taskLog.id,
      JSON.stringify({ source: 'sbar', agentId, sbar }),
      taskLog.issuesJson ?? undefined
    )
  } catch (err) {
    log.warn('task-completion-events: failed to write task log summary', {
      taskLogId: taskLog.id,
      agentId,
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

function hasCompletionEvent(db: Database.Database, taskId: string, agentId: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM task_events WHERE task_id = ? AND agent_id = ? AND event_type = 'CARD_COMPLETED' LIMIT 1"
    )
    .get(taskId, agentId)
  return row !== undefined
}

function copyAgentSBAR(
  db: Database.Database,
  agentId: string,
  ctx: SBARRedactionContext
): SBARCopy | null {
  const sbar = getSBARByAgentId(db, agentId)
  if (!sbar) return null
  return redactSBARCopy(sbar, ctx)
}

function buildRedactionContext(db: Database.Database, task: TaskItem): SBARRedactionContext {
  return {
    taskTitle: task.title,
    sprintName: task.sprintName,
    taskDescription: task.description || null,
    repoPath: getRepoById(db, task.repoId)?.path ?? null
  }
}

/**
 * S87: keep only SBAR_COPY_KEYS, with the prompt replaced by title + sprint, raw terminal
 * output dropped and paths made repo-relative. Non-string values become ''.
 */
export function redactSBARCopy(
  sbar: Partial<Record<(typeof SBAR_COPY_KEYS)[number], unknown>>,
  ctx: SBARRedactionContext
): SBARCopy {
  const text = (key: (typeof SBAR_COPY_KEYS)[number]): string =>
    typeof sbar[key] === 'string' ? (sbar[key] as string) : ''
  return {
    id: text('id'),
    situation: relativizePaths(redactSituation(text('situation'), ctx), ctx.repoPath),
    background: relativizePaths(redactWorkingDirectory(text('background'), ctx.repoPath), ctx.repoPath),
    assessment: relativizePaths(text('assessment').replace(RAW_OUTPUT_PATTERN, ''), ctx.repoPath),
    recommendation: relativizePaths(text('recommendation'), ctx.repoPath),
    createdAt: text('createdAt')
  }
}

/**
 * S87: the allowlisted CARD_COMPLETED payload (COMPLETION_PAYLOAD_KEYS), with a redacted SBAR.
 * Used for events queued before the allowlist existed.
 */
export function redactCompletionPayload(
  raw: Record<string, unknown>,
  ctx: SBARRedactionContext
): Record<CompletionPayloadKey, unknown> {
  const sbar = raw['sbar']
  return {
    taskTitle: ctx.taskTitle,
    sprintName: ctx.sprintName,
    repoId: raw['repoId'] ?? null,
    sbar: sbar && typeof sbar === 'object' ? redactSBARCopy(sbar as Record<string, unknown>, ctx) : null
  }
}

/** Redaction context for a task id; null when the task no longer exists. */
export function resolveRedactionContext(db: Database.Database, taskId: string): SBARRedactionContext | null {
  const task = getTaskById(db, taskId)
  return task ? buildRedactionContext(db, task) : null
}

/** Replace the task prompt after "while working on:" (and any verbatim copy of it) with title + sprint. */
function redactSituation(situation: string, ctx: SBARRedactionContext): string {
  const label = ctx.sprintName ? `${ctx.taskTitle} (sprint: ${ctx.sprintName})` : ctx.taskTitle
  const markerAt = situation.indexOf(WORKING_ON_MARKER)
  const withoutPrompt =
    markerAt >= 0 ? situation.slice(0, markerAt + WORKING_ON_MARKER.length) + label : situation
  if (!ctx.taskDescription) return withoutPrompt
  return withoutPrompt.split(ctx.taskDescription).join(label)
}

/** Replace the absolute working directory with a repo-relative one (or OUTSIDE_REPO). */
function redactWorkingDirectory(background: string, repoPath: string | null): string {
  return background.replace(WORKING_DIR_PATTERN, (_match, cwd: string) => {
    return `Working directory: ${toRepoRelative(cwd.trim(), repoPath)}`
  })
}

function toRepoRelative(path: string, repoPath: string | null): string {
  if (!isAbsolute(path)) return path
  if (!repoPath) return OUTSIDE_REPO
  const rel = relative(repoPath, path)
  if (rel === '') return '.'
  if (rel.startsWith('..') || isAbsolute(rel)) return OUTSIDE_REPO
  return rel
}

/** Strip the repo root prefix from any path left in free text (e.g. "Files modified: /repo/src/x.ts"). */
function relativizePaths(text: string, repoPath: string | null): string {
  if (!repoPath) return text
  const root = repoPath.replace(/\/+$/, '')
  return text.split(`${root}/`).join('').split(root).join('.')
}
