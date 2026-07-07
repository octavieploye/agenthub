import { Database } from 'better-sqlite3'
import { BrainEntry, BrainTimelineEntry } from '../../../shared/types/brain.types'

// Get all brain entries, optionally filtered by repo
export function getBrainEntries(db: Database, repoId?: string): BrainEntry[] {
  let query = `
    SELECT
      be.id,
      be.repo_id as repoId,
      r.name as repoName,
      be.project_id as projectId,
      p.name as projectName,
      be.pointer_path as pointerPath,
      be.artifact_path as artifactPath,
      be.type,
      be.subject,
      be.status,
      be.created_at as createdAt,
      be.updated_at as updatedAt,
      be.note,
      be.computed_status as computedStatus,
      be.checklist_total as checklistTotal,
      be.checklist_done as checklistDone,
      CASE WHEN be.git_signal = 1 THEN 1 ELSE 0 END as gitSignal,
      COUNT(t.id) as tasksTotal,
      SUM(CASE WHEN t.status IN ('completed', 'tested') THEN 1 ELSE 0 END) as tasksDone,
      SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as tasksInProgress
    FROM brain_entries be
    LEFT JOIN repos r ON be.repo_id = r.id
    LEFT JOIN projects p ON be.project_id = p.id
    LEFT JOIN tasks t ON be.id = t.brain_entry_id
  `

  const params: any[] = []

  if (repoId) {
    query += ' WHERE be.repo_id = ?'
    params.push(repoId)
  }

  query += ' GROUP BY be.id ORDER BY be.updated_at DESC'

  const rows = db.prepare(query).all(...params) as any[]
  return rows.map(row => ({ ...row, gitSignal: row.gitSignal === 1 })) as BrainEntry[]
}

// Get a single brain entry by ID
export function getBrainEntryById(db: Database, id: string): BrainEntry | null {
  const query = `
    SELECT
      be.id,
      be.repo_id as repoId,
      r.name as repoName,
      be.project_id as projectId,
      p.name as projectName,
      be.pointer_path as pointerPath,
      be.artifact_path as artifactPath,
      be.type,
      be.subject,
      be.status,
      be.created_at as createdAt,
      be.updated_at as updatedAt,
      be.note,
      be.computed_status as computedStatus,
      be.checklist_total as checklistTotal,
      be.checklist_done as checklistDone,
      CASE WHEN be.git_signal = 1 THEN 1 ELSE 0 END as gitSignal
    FROM brain_entries be
    LEFT JOIN repos r ON be.repo_id = r.id
    LEFT JOIN projects p ON be.project_id = p.id
    WHERE be.id = ?
  `

  const row = db.prepare(query).get(id) as any
  return row ? { ...row, gitSignal: row.gitSignal === 1 } as BrainEntry : null
}

// Create or update a brain entry.
// NOTE: status is intentionally excluded from ON CONFLICT DO UPDATE
// to preserve user manual overrides when the scanner re-discovers an entry.
export function upsertBrainEntry(db: Database, entry: {
  id: string
  repoId: string
  projectId?: string | null
  pointerPath: string
  artifactPath: string
  type: string
  subject: string
  status: string
  createdAt: string
  note?: string | null
  computedStatus?: string
  checklistTotal?: number
  checklistDone?: number
  gitSignal?: number
}): void {
  db.prepare(`
    INSERT INTO brain_entries (
      id, repo_id, project_id, pointer_path, artifact_path,
      type, subject, status, created_at, updated_at, note,
      computed_status, checklist_total, checklist_done, git_signal
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    ) ON CONFLICT(id) DO UPDATE SET
      project_id      = excluded.project_id,
      pointer_path    = excluded.pointer_path,
      artifact_path   = excluded.artifact_path,
      type            = excluded.type,
      subject         = excluded.subject,
      updated_at      = datetime('now'),
      note            = excluded.note,
      computed_status = excluded.computed_status,
      checklist_total = excluded.checklist_total,
      checklist_done  = excluded.checklist_done,
      git_signal      = excluded.git_signal
  `).run(
    entry.id,
    entry.repoId,
    entry.projectId ?? null,
    entry.pointerPath,
    entry.artifactPath,
    entry.type,
    entry.subject,
    entry.status,
    entry.createdAt,
    entry.createdAt,  // updated_at equals created_at on first insert; ON CONFLICT sets it to datetime('now')
    entry.note ?? null,
    entry.computedStatus ?? 'remaining',
    entry.checklistTotal ?? 0,
    entry.checklistDone ?? 0,
    entry.gitSignal ?? 0
  )
}

// Update brain entry status
export function updateBrainEntryStatus(db: Database, id: string, status: string): void {
  db.prepare(`
    UPDATE brain_entries
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, id)
}

// Delete a brain entry
export function deleteBrainEntry(db: Database, id: string): void {
  db.prepare('DELETE FROM brain_entries WHERE id = ?').run(id)
}

// Get timeline entries (brain events + git commits) for a repo
export function getBrainTimeline(db: Database, repoId: string): BrainTimelineEntry[] {
  // This will be implemented with git service integration
  // For now, return brain events only
  const query = `
    SELECT
      id,
      repo_id as repoId,
      created_at as date,
      'brain' as type,
      subject,
      'Brain entry created' as details,
      'brain' as icon
    FROM brain_entries
    WHERE repo_id = ?

    UNION ALL

    SELECT
      id,
      repo_id as repoId,
      updated_at as date,
      'brain' as type,
      subject || ' (updated)' as subject,
      'Brain entry updated' as details,
      'brain' as icon
    FROM brain_entries
    WHERE repo_id = ? AND updated_at > created_at

    ORDER BY date DESC
  `

  return db.prepare(query).all(repoId, repoId) as BrainTimelineEntry[]
}

// Create a task linked to a brain entry
export function createTaskFromBrainEntry(db: Database, brainEntryId: string, repoId: string, title: string, description: string): string {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

  db.prepare(`
    INSERT INTO tasks (
      id, repo_id, title, description, status, created_at, brain_entry_id
    ) VALUES (
      ?, ?, ?, ?, 'backlog', datetime('now'), ?
    )
  `).run(taskId, repoId, title, description, brainEntryId)

  return taskId
}