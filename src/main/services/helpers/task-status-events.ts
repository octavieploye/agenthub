import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { getTaskById, updateTask } from '../../db/queries/tasks.queries'
import { insertTaskEvent } from '../../db/queries/task-events.queries'
import { getAnamnesisWriter } from '../service-registry'
import type { TaskEvent, TaskEventType, TaskStatus } from '../../../shared/types/task.types'

export interface TaskStatusEventInput {
  taskId: string
  fromStatus: string | null
  toStatus: string
  agentId?: string | null
  /** Defaults to CARD_TRANSITION. ORCHESTRATOR_* / SPRINT_INTAKE go through as-is (all mapped in AnamnesisWriter ENDPOINT_MAP). */
  eventType?: TaskEventType
  payload?: Record<string, unknown>
}

export interface TaskMoveContext {
  agentId?: string | null
  payload?: Record<string, unknown>
}

/**
 * Record one task_event for a status change (from → to) so AnamnesisWriter can deliver it.
 * A CARD_TRANSITION whose from and to are equal is a no-op. Unknown task → null.
 * Never throws: an event failure must not break the status write that triggered it.
 */
export function emitTaskStatusEvent(
  db: Database.Database,
  input: TaskStatusEventInput
): TaskEvent | null {
  const eventType = input.eventType ?? 'CARD_TRANSITION'
  if (eventType === 'CARD_TRANSITION' && input.fromStatus === input.toStatus) return null
  try {
    const task = getTaskById(db, input.taskId)
    if (!task) return null
    const event = insertTaskEvent(db, {
      taskId: task.id,
      eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      agentId: input.agentId ?? null,
      payload: { ...input.payload, taskTitle: task.title, repoId: task.repoId }
    })
    notifyAnamnesisWriter()
    return event
  } catch (err) {
    log.warn('task-status-events: failed to record task event', {
      taskId: input.taskId,
      eventType,
      error: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

/**
 * Move a task to `toStatus` and record the CARD_TRANSITION from its current status.
 * Reads the previous status right before the write, so an earlier writer that already
 * set the same status yields no duplicate event.
 */
export function moveTaskWithEvent(
  db: Database.Database,
  taskId: string,
  toStatus: TaskStatus,
  context: TaskMoveContext = {}
): void {
  const fromStatus = getTaskById(db, taskId)?.status ?? null
  updateTask(db, taskId, { status: toStatus })
  emitTaskStatusEvent(db, {
    taskId,
    fromStatus,
    toStatus,
    agentId: context.agentId,
    payload: context.payload
  })
}

/** Nudge the Anamnesis outbox to flush the newly inserted event (no-op when no writer is registered). */
function notifyAnamnesisWriter(): void {
  getAnamnesisWriter()?.onEventInserted()
}
