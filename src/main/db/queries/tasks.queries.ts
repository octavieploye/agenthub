import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { TaskItem, TaskPriority, TaskStatus, TaskCategory, CreateTaskInput, UpdateTaskInput } from '../../../shared/types/task.types'
import { insertActivityEvent } from './activity.queries'
import { getDependencyMap } from './task-dependencies.queries'

const VALID_PROVIDERS = ['anthropic', 'ollama-local', 'ollama-cloud', 'openai-codex'] as const

function validateProviderOverride(value: string | null | undefined): void {
  if (value != null && !VALID_PROVIDERS.includes(value as typeof VALID_PROVIDERS[number])) {
    throw new Error(`Invalid provider_override: "${value}". Must be one of: ${VALID_PROVIDERS.join(', ')}`)
  }
}

function mapRow(row: Record<string, unknown>, depMap?: Map<string, string[]>): TaskItem {
  const id = row.id as string
  return {
    id,
    repoId: row.repo_id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    priority: (row.priority as TaskPriority) ?? 3,
    status: (row.status as TaskStatus) ?? 'backlog',
    category: (row.category as TaskCategory) ?? null,
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
    blockedBy: depMap?.get(id) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function getAllTasks(db: Database.Database): TaskItem[] {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY priority ASC, created_at DESC').all()
  const depMap = getDependencyMap(db)
  return rows.map((r) => mapRow(r as Record<string, unknown>, depMap))
}

export function getTasksByRepo(db: Database.Database, repoId: string): TaskItem[] {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE repo_id = ? ORDER BY priority ASC, created_at DESC')
    .all(repoId)
  const depMap = getDependencyMap(db)
  return rows.map((r) => mapRow(r as Record<string, unknown>, depMap))
}

export function getTasksBySprint(db: Database.Database, repoId: string, sprintName: string): TaskItem[] {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE repo_id = ? AND sprint_name = ? ORDER BY priority ASC, created_at DESC')
    .all(repoId, sprintName)
  const depMap = getDependencyMap(db)
  return rows.map((r) => mapRow(r as Record<string, unknown>, depMap))
}

export function getTasksByStatus(db: Database.Database, status: TaskStatus): TaskItem[] {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY priority ASC, created_at DESC')
    .all(status)
  const depMap = getDependencyMap(db)
  return rows.map((r) => mapRow(r as Record<string, unknown>, depMap))
}

export function getTaskById(db: Database.Database, id: string): TaskItem | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return null
  const deps = db
    .prepare('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?')
    .all(id) as { depends_on_id: string }[]
  const depMap = new Map([[id, deps.map((d) => d.depends_on_id)]])
  return mapRow(row, depMap)
}

export function getTaskByAgentId(db: Database.Database, agentId: string): TaskItem | null {
  const row = db
    .prepare(
      "SELECT * FROM tasks WHERE agent_id = ? AND status NOT IN ('completed', 'tested') LIMIT 1"
    )
    .get(agentId) as Record<string, unknown> | undefined
  if (!row) return null
  const id = row.id as string
  const deps = db
    .prepare('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?')
    .all(id) as { depends_on_id: string }[]
  const depMap = new Map([[id, deps.map((d) => d.depends_on_id)]])
  return mapRow(row, depMap)
}

export function insertTask(db: Database.Database, input: CreateTaskInput): TaskItem {
  validateProviderOverride(input.providerOverride)
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO tasks (id, repo_id, title, description, priority, status, category, sprint_name, epic_name, project_id, section_target_date, note, requires_approval, model_override, provider_override, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.repoId,
    input.title,
    input.description ?? '',
    input.priority ?? 3,
    input.status ?? 'backlog',
    input.category ?? null,
    input.sprintName ?? null,
    input.epicName ?? null,
    input.projectId ?? null,
    input.sectionTargetDate ?? null,
    input.note ?? null,
    input.requiresApproval ? 1 : 0,
    input.modelOverride ?? null,
    input.providerOverride ?? null,
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
    position: 0,
    category: input.category ?? null,
    sbarId: null,
    sprintName: input.sprintName ?? null,
    epicName: input.epicName ?? null,
    projectId: input.projectId ?? null,
    sectionTargetDate: input.sectionTargetDate ?? null,
    note: input.note ?? null,
    requiresApproval: input.requiresApproval ?? false,
    modelOverride: input.modelOverride ?? null,
    providerOverride: input.providerOverride ?? null,
    dateTriggerFiredAt: null,
    blockedBy: [],
    createdAt: now,
    updatedAt: now
  }
}

export function updateTask(db: Database.Database, id: string, input: UpdateTaskInput): void {
  if (input.providerOverride !== undefined) {
    validateProviderOverride(input.providerOverride)
  }
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
  if (input.category !== undefined) {
    sets.push('category = ?')
    values.push(input.category)
  }
  if (input.agentId !== undefined) {
    sets.push('agent_id = ?')
    values.push(input.agentId)
  }
  if (input.position !== undefined) {
    sets.push('position = ?')
    values.push(input.position)
  }
  if (input.sbarId !== undefined) {
    sets.push('sbar_id = ?')
    values.push(input.sbarId)
  }
  if (input.sprintName !== undefined) {
    sets.push('sprint_name = ?')
    values.push(input.sprintName)
  }
  if (input.epicName !== undefined) {
    sets.push('epic_name = ?')
    values.push(input.epicName)
  }
  if (input.projectId !== undefined) {
    sets.push('project_id = ?')
    values.push(input.projectId)
  }
  if (input.sectionTargetDate !== undefined) {
    sets.push('section_target_date = ?')
    values.push(input.sectionTargetDate)
  }
  if (input.note !== undefined) {
    sets.push('note = ?')
    values.push(input.note)
  }
  if (input.requiresApproval !== undefined) {
    sets.push('requires_approval = ?')
    values.push(input.requiresApproval ? 1 : 0)
  }
  if (input.modelOverride !== undefined) {
    sets.push('model_override = ?')
    values.push(input.modelOverride)
  }
  if (input.providerOverride !== undefined) {
    sets.push('provider_override = ?')
    values.push(input.providerOverride)
  }
  if (input.dateTriggerFiredAt !== undefined) {
    sets.push('date_trigger_fired_at = ?')
    values.push(input.dateTriggerFiredAt)
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

export function updateTaskPosition(db: Database.Database, id: string, position: number): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?').run(position, now, id)
}

export function linkSBARToTask(db: Database.Database, id: string, sbarId: string): void {
  const now = new Date().toISOString()
  // sbar_id FK was added via ALTER TABLE (migration 014) — application-layer enforcement
  // per migration 021 pattern. Temporarily relax FK to avoid constraint on the ALTER-added column.
  const fkWasOn = db.pragma('foreign_keys', { simple: true }) as number
  if (fkWasOn) db.pragma('foreign_keys = OFF')
  db.prepare('UPDATE tasks SET sbar_id = ?, updated_at = ? WHERE id = ?').run(sbarId, now, id)
  if (fkWasOn) db.pragma('foreign_keys = ON')
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
  const depMap = getDependencyMap(db)
  return rows.map((r) => mapRow(r as Record<string, unknown>, depMap))
}

export function getCompletedTasksSince(db: Database.Database, since: string): TaskItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM tasks WHERE status IN ('completed', 'tested') AND updated_at >= ? ORDER BY updated_at DESC`
    )
    .all(since)
  const depMap = getDependencyMap(db)
  return rows.map((r) => mapRow(r as Record<string, unknown>, depMap))
}
