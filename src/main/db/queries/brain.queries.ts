import { Database } from 'better-sqlite3'
import { BrainEntry } from '../../../shared/types/brain.types'

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

  return db.prepare(query).all(...params) as BrainEntry[]
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
      be.note
    FROM brain_entries be
    LEFT JOIN repos r ON be.repo_id = r.id
    LEFT JOIN projects p ON be.project_id = p.id
    WHERE be.id = ?
  `

  return db.prepare(query).get(id) as BrainEntry | null
}

// Create or update a brain entry
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
}): void {
  db.prepare(`
    INSERT INTO brain_entries (
      id, repo_id, project_id, pointer_path, artifact_path,
      type, subject, status, created_at, updated_at, note
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?
    ) ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      pointer_path = excluded.pointer_path,
      artifact_path = excluded.artifact_path,
      type = excluded.type,
      subject = excluded.subject,
      status = excluded.status,
      created_at = excluded.created_at,
      updated_at = datetime('now'),
      note = excluded.note
  `).run(
    entry.id,
    entry.repoId,
    entry.projectId,
    entry.pointerPath,
    entry.artifactPath,
    entry.type,
    entry.subject,
    entry.status,
    entry.createdAt,
    entry.note
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
export function getBrainTimeline(db: Database, repoId: string): any[] {
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

  return db.prepare(query).all(repoId, repoId)
}

// Create a task linked to a brain entry
export function createTaskFromBrainEntry(db: Database, brainEntryId: string, subject: string, description: string): string {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

  db.prepare(`
    INSERT INTO tasks (
      id, subject, description, status, created_at, brain_entry_id
    ) VALUES (
      ?, ?, ?, 'pending', datetime('now'), ?
    )
  `).run(taskId, subject, description, brainEntryId)

  return taskId
}