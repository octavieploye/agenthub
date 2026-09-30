import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { getTaskById } from '../../db/queries/tasks.queries'
import { insertTaskEvent } from '../../db/queries/task-events.queries'
import { getSBARByAgentId } from '../../db/queries/sbar.queries'
import { updateTaskLogSummary } from '../../db/queries/orchestrator.queries'
import { getAnamnesisWriter } from '../service-registry'
import type { TaskEvent } from '../../../shared/types/task.types'
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
        repoId: task.repoId,
        sbar: copyAgentSBAR(db, input.agentId)
      }
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
    const sbar = copyAgentSBAR(db, agentId)
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

function copyAgentSBAR(db: Database.Database, agentId: string): SBARCopy | null {
  const sbar = getSBARByAgentId(db, agentId)
  if (!sbar) return null
  return {
    id: sbar.id,
    situation: sbar.situation,
    background: sbar.background,
    assessment: sbar.assessment,
    recommendation: sbar.recommendation,
    createdAt: sbar.createdAt
  }
}
