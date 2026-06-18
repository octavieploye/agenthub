import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type { TaskEvent, TaskEventType } from '../../../shared/types/task.types'

interface InsertTaskEventInput {
  taskId: string
  eventType: TaskEventType
  fromStatus: string | null
  toStatus: string
  agentId: string | null
  payload: Record<string, unknown>
}

export function insertTaskEvent(db: Database.Database, input: InsertTaskEventInput): TaskEvent {
  const id = randomUUID()
  const now = new Date().toISOString()
  const payloadJson = JSON.stringify(input.payload)

  db.prepare(
    `INSERT INTO task_events (id, task_id, event_type, from_status, to_status, agent_id, payload_json, created_at, synced_to_anamnesis, enriched_from_anamnesis)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
  ).run(id, input.taskId, input.eventType, input.fromStatus, input.toStatus, input.agentId, payloadJson, now)

  return {
    id,
    taskId: input.taskId,
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    agentId: input.agentId,
    payloadJson,
    createdAt: now,
    syncedToAnamnesis: 0,
    enrichedFromAnamnesis: 0
  }
}

export function getUnsyncedEvents(db: Database.Database): TaskEvent[] {
  const rows = db
    .prepare('SELECT * FROM task_events WHERE synced_to_anamnesis = 0 ORDER BY created_at ASC')
    .all() as Record<string, unknown>[]
  return rows.map(mapEventRow)
}

export function markEventSynced(db: Database.Database, id: string): void {
  db.prepare('UPDATE task_events SET synced_to_anamnesis = 1 WHERE id = ?').run(id)
}

export function getEventsByTask(db: Database.Database, taskId: string): TaskEvent[] {
  const rows = db
    .prepare('SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId) as Record<string, unknown>[]
  return rows.map(mapEventRow)
}

function mapEventRow(row: Record<string, unknown>): TaskEvent {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    eventType: row.event_type as TaskEventType,
    fromStatus: (row.from_status as string) ?? null,
    toStatus: row.to_status as string,
    agentId: (row.agent_id as string) ?? null,
    payloadJson: row.payload_json as string,
    createdAt: row.created_at as string,
    syncedToAnamnesis: row.synced_to_anamnesis as number,
    enrichedFromAnamnesis: row.enriched_from_anamnesis as number
  }
}
