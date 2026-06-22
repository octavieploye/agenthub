import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type { ActivityEvent, InsertActivityEvent, ActivityStats } from '../../../shared/types/activity.types'

export function insertActivityEvent(db: Database.Database, event: InsertActivityEvent): void {
  try {
    db.prepare(
      `INSERT INTO activity_log (event_type, entity_type, entity_id, repo_id, agent_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.eventType,
      event.entityType,
      event.entityId,
      event.repoId ?? null,
      event.agentId ?? null,
      event.details ? JSON.stringify(event.details) : null,
      new Date().toISOString()
    )
  } catch (err) {
    log.warn('Failed to insert activity event', { eventType: event.eventType, error: (err as Error).message })
  }
}

function mapRow(row: Record<string, unknown>): ActivityEvent {
  let details: Record<string, unknown> = {}
  if (row.details && typeof row.details === 'string') {
    try {
      details = JSON.parse(row.details)
    } catch {
      details = {}
    }
  }
  return {
    id: row.id as number,
    eventType: row.event_type as ActivityEvent['eventType'],
    entityType: row.entity_type as ActivityEvent['entityType'],
    entityId: row.entity_id as string,
    repoId: (row.repo_id as string) ?? null,
    agentId: (row.agent_id as string) ?? null,
    details,
    createdAt: row.created_at as string
  }
}

export function getActivitySince(
  db: Database.Database,
  since: string,
  repoId?: string
): ActivityEvent[] {
  if (repoId) {
    const rows = db.prepare(
      'SELECT * FROM activity_log WHERE created_at >= ? AND repo_id = ? ORDER BY created_at DESC'
    ).all(since, repoId)
    return rows.map((r) => mapRow(r as Record<string, unknown>))
  }
  const rows = db.prepare(
    'SELECT * FROM activity_log WHERE created_at >= ? ORDER BY created_at DESC'
  ).all(since)
  return rows.map((r) => mapRow(r as Record<string, unknown>))
}

export function getActivityStats(db: Database.Database, since: string): ActivityStats {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'agent_spawned' THEN 1 ELSE 0 END), 0) as agents_spawned,
      COALESCE(SUM(CASE WHEN event_type = 'agent_completed' THEN 1 ELSE 0 END), 0) as agents_completed,
      COALESCE(SUM(CASE WHEN event_type = 'agent_error' THEN 1 ELSE 0 END), 0) as agents_errored,
      COALESCE(SUM(CASE WHEN event_type = 'task_status_changed' AND details LIKE '%"to":"done"%' THEN 1 ELSE 0 END), 0) as tasks_completed,
      COALESCE(SUM(CASE WHEN event_type = 'bug_created' THEN 1 ELSE 0 END), 0) as bugs_created,
      COALESCE(SUM(CASE WHEN event_type = 'bug_resolved' THEN 1 ELSE 0 END), 0) as bugs_resolved
    FROM activity_log
    WHERE created_at >= ?
  `).get(since) as Record<string, number>

  return {
    agentsSpawned: row.agents_spawned,
    agentsCompleted: row.agents_completed,
    agentsErrored: row.agents_errored,
    tasksCompleted: row.tasks_completed,
    bugsCreated: row.bugs_created,
    bugsResolved: row.bugs_resolved
  }
}
