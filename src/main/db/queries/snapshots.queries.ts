import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import type {
  SessionSnapshot,
  WorkspaceState,
  SnapshotTrigger
} from '../../../shared/types/recovery.types'

interface SnapshotRow {
  id: number
  state_json: string
  trigger_type: string
  created_at: string
}

function mapRow(row: SnapshotRow): SessionSnapshot {
  return {
    id: row.id,
    stateJson: JSON.parse(row.state_json) as WorkspaceState,
    trigger: row.trigger_type as SnapshotTrigger,
    createdAt: row.created_at
  }
}

export function insertSnapshot(
  db: Database.Database,
  state: WorkspaceState,
  trigger: SnapshotTrigger
): SessionSnapshot {
  const stateJson = JSON.stringify(state)
  const stmt = db.prepare(
    'INSERT INTO snapshots (state_json, trigger_type) VALUES (?, ?)'
  )
  const result = stmt.run(stateJson, trigger)

  log.debug('Snapshot saved', { id: result.lastInsertRowid, trigger })

  return {
    id: result.lastInsertRowid as number,
    stateJson: state,
    trigger,
    createdAt: new Date().toISOString()
  }
}

export function getLatestSnapshot(db: Database.Database): SessionSnapshot | null {
  const row = db.prepare(
    'SELECT * FROM snapshots ORDER BY id DESC LIMIT 1'
  ).get() as SnapshotRow | undefined

  return row ? mapRow(row) : null
}

export function getSnapshotById(db: Database.Database, id: number): SessionSnapshot | null {
  const row = db.prepare(
    'SELECT * FROM snapshots WHERE id = ?'
  ).get(id) as SnapshotRow | undefined

  return row ? mapRow(row) : null
}

export function pruneOldSnapshots(db: Database.Database, maxAgeHours: number = 24): number {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString()
  const result = db.prepare(
    'DELETE FROM snapshots WHERE created_at < ?'
  ).run(cutoff)

  if (result.changes > 0) {
    log.info('Pruned old snapshots', { deleted: result.changes, cutoffHours: maxAgeHours })
  }

  return result.changes
}

export function getSnapshotCount(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }
  return row.count
}
