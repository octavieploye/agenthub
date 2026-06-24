import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type { WorkspaceMemoryEntry } from '../../../shared/types/workspace-memory.types'

export type { WorkspaceMemoryEntry }

export interface SBARSummary {
  taskTitle: string
  sprintName: string | null
  epicName: string | null
  completedAt: string
  situation: string | null
  background: string | null
  assessment: string | null
  recommendation: string | null
}

interface InsertLearningInput {
  projectId: string
  content: string
  sourceId?: string
}

function mapEntry(row: Record<string, unknown>): WorkspaceMemoryEntry {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    content: row.content as string,
    sourceId: (row.source_id as string) ?? null,
    createdAt: row.created_at as string,
    pinnedAt: row.pinned_at as string,
    anamnesisId: (row.anamnesis_id as string) ?? null,
    syncedToAnamnesis: row.synced_to_anamnesis as number
  }
}

export function insertLearning(
  db: Database.Database,
  input: InsertLearningInput
): WorkspaceMemoryEntry {
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO workspace_memory (id, project_id, content, source_id, created_at, pinned_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.projectId, input.content, input.sourceId ?? null, now, now)
  return {
    id,
    projectId: input.projectId,
    content: input.content,
    sourceId: input.sourceId ?? null,
    createdAt: now,
    pinnedAt: now,
    anamnesisId: null,
    syncedToAnamnesis: 0
  }
}

export function getLearningsByProject(
  db: Database.Database,
  projectId: string
): WorkspaceMemoryEntry[] {
  const rows = db
    .prepare(`SELECT * FROM workspace_memory WHERE project_id = ? ORDER BY pinned_at DESC`)
    .all(projectId) as Record<string, unknown>[]
  return rows.map(mapEntry)
}

export function deleteLearning(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM workspace_memory WHERE id = ?').run(id)
}

export function getRecentCompletedSBARs(
  db: Database.Database,
  projectId: string,
  limit: number
): SBARSummary[] {
  const rows = db
    .prepare(
      `SELECT
        t.title        AS task_title,
        t.sprint_name,
        t.epic_name,
        te.created_at  AS completed_at,
        sh.situation,
        sh.background,
        sh.assessment,
        sh.recommendation
      FROM task_events te
      JOIN tasks t ON te.task_id = t.id
      LEFT JOIN sbar_handoffs sh ON t.sbar_id = sh.id
      WHERE te.event_type = 'CARD_COMPLETED'
        AND t.project_id = ?
      ORDER BY te.created_at DESC
      LIMIT ?`
    )
    .all(projectId, limit) as Record<string, unknown>[]

  return rows.map((row) => ({
    taskTitle: row.task_title as string,
    sprintName: (row.sprint_name as string) ?? null,
    epicName: (row.epic_name as string) ?? null,
    completedAt: row.completed_at as string,
    situation: (row.situation as string) ?? null,
    background: (row.background as string) ?? null,
    assessment: (row.assessment as string) ?? null,
    recommendation: (row.recommendation as string) ?? null
  }))
}
