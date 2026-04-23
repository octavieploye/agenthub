import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { TaskItem, TaskPriority, TaskStatus, CreateTaskInput, UpdateTaskInput } from '../../../shared/types/task.types'
import { insertActivityEvent } from './activity.queries'

function mapRow(row: Record<string, unknown>): TaskItem {
  return {
    id: row.id as string,
    repoId: row.repo_id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    priority: (row.priority as TaskPriority) ?? 3,
    status: (row.status as TaskStatus) ?? 'backlog',
    agentId: (row.agent_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function getAllTasks(db: Database.Database): TaskItem[] {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY priority ASC, created_at DESC').all()
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getTasksByRepo(db: Database.Database, repoId: string): TaskItem[] {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE repo_id = ? ORDER BY priority ASC, created_at DESC')
    .all(repoId)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getTasksByStatus(db: Database.Database, status: TaskStatus): TaskItem[] {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY priority ASC, created_at DESC')
    .all(status)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getTaskById(db: Database.Database, id: string): TaskItem | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? mapRow(row) : null
}

export function insertTask(db: Database.Database, input: CreateTaskInput): TaskItem {
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO tasks (id, repo_id, title, description, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.repoId,
    input.title,
    input.description ?? '',
    input.priority ?? 3,
    input.status ?? 'backlog',
    now,
    now
  )

  log.info('Task inserted', { id, title: input.title })
  insertActivityEvent(db, {
    eventType: 'task_created',
    entityType: 'task',
    entityId: id,
    repoId: input.repoId,
    details: { title: input.title, status: input.status ?? 'backlog' }
  })
  return {
    id,
    repoId: input.repoId,
    title: input.title,
    description: input.description ?? '',
    priority: (input.priority ?? 3) as TaskPriority,
    status: input.status ?? 'backlog',
    agentId: null,
    createdAt: now,
    updatedAt: now
  }
}

export function updateTask(db: Database.Database, id: string, input: UpdateTaskInput): void {
  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (input.title !== undefined) {
    sets.push('title = ?')
    values.push(input.title)
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    values.push(input.description)
  }
  if (input.priority !== undefined) {
    sets.push('priority = ?')
    values.push(input.priority)
  }
  if (input.status !== undefined) {
    sets.push('status = ?')
    values.push(input.status)
  }
  if (input.agentId !== undefined) {
    sets.push('agent_id = ?')
    values.push(input.agentId)
  }

  values.push(id)
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  log.debug('Task updated', { id, fields: Object.keys(input) })
  if (input.status !== undefined) {
    insertActivityEvent(db, {
      eventType: 'task_status_changed',
      entityType: 'task',
      entityId: id,
      details: { to: input.status }
    })
  }
}

export function deleteTask(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  log.info('Task deleted', { id })
}

export function searchTasks(db: Database.Database, query: string): TaskItem[] {
  const pattern = `%${query}%`
  const rows = db
    .prepare(
      `SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ? ORDER BY priority ASC, created_at DESC`
    )
    .all(pattern, pattern)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getCompletedTasksSince(db: Database.Database, since: string): TaskItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM tasks WHERE status IN ('completed', 'tested') AND updated_at >= ? ORDER BY updated_at DESC`
    )
    .all(since)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}
