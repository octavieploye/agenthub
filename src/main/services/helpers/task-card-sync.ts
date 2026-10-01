import type Database from 'better-sqlite3'
import { getTaskByAgentId, updateTask } from '../../db/queries/tasks.queries'
import { insertTaskEvent } from '../../db/queries/task-events.queries'
import type { TaskEventType, TaskItem, TaskStatus } from '../../../shared/types/task.types'

const AGENT_TO_TASK_STATUS: Partial<Record<string, TaskStatus>> = {
  busy: 'in_progress',
  completed: 'completed',
  interrupted: 'interrupted'
}

const AGENT_TO_EVENT_TYPE: Partial<Record<string, TaskEventType>> = {
  busy: 'CARD_TRANSITION',
  completed: 'CARD_COMPLETED',
  interrupted: 'CARD_INTERRUPTED'
}

const SEALED_TASK_STATUSES: ReadonlySet<string> = new Set(['archived', 'completed', 'tested'])

/** A sealed card is final: no agent signal may move it (an archived card must not resurrect). */
export function isTaskStatusSealed(status: string): boolean {
  return SEALED_TASK_STATUSES.has(status)
}

export interface AgentTaskSync {
  task: TaskItem
  eventType: TaskEventType
}

/**
 * Move the live task linked to `agentId` to the status matching the agent's new status.
 * Logs the task event, except CARD_COMPLETED — the caller emits that one after linking the SBAR.
 * Returns null when the agent status has no mapping, no task is linked, or the task is sealed.
 */
export function syncAgentStatusToTask(
  db: Database.Database,
  agentId: string,
  newStatus: string
): AgentTaskSync | null {
  const taskStatus = AGENT_TO_TASK_STATUS[newStatus]
  const eventType = AGENT_TO_EVENT_TYPE[newStatus]
  if (!taskStatus || !eventType) return null

  const task = getTaskByAgentId(db, agentId)
  if (!task || isTaskStatusSealed(task.status)) return null

  updateTask(db, task.id, { status: taskStatus })
  if (eventType !== 'CARD_COMPLETED') {
    insertTaskEvent(db, {
      taskId: task.id,
      eventType,
      fromStatus: task.status,
      toStatus: taskStatus,
      agentId,
      payload: { taskTitle: task.title, repoId: task.repoId }
    })
  }
  return { task, eventType }
}
