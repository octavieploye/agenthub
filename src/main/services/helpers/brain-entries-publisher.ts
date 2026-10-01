import { isAbsolute, relative } from 'path'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { insertTaskEvent } from '../../db/queries/task-events.queries'
import { getAnamnesisWriter } from '../service-registry'
import { mapBrainTypeToDomainCategory } from './anamnesis-domain-mapper'
import type { BrainEntryType } from '../../../shared/types/brain.types'

interface UnsyncedBrainEntryRow {
  id: string
  repoId: string
  repoName: string | null
  repoPath: string | null
  artifactPath: string
  type: string
  subject: string
  status: string
  computedStatus: string | null
  createdAt: string
}

/** Default and maximum number of entries one publish call may enqueue. */
const DEFAULT_PUBLISH_LIMIT = 50
const MAX_PUBLISH_LIMIT = 200

const UNSYNCED_ENTRY_SELECT = `SELECT be.id, be.repo_id AS repoId, r.name AS repoName, r.path AS repoPath,
              be.artifact_path AS artifactPath, be.type, be.subject, be.status,
              be.computed_status AS computedStatus, be.created_at AS createdAt
       FROM brain_entries be
       LEFT JOIN repos r ON r.id = be.repo_id
       WHERE be.synced_to_anamnesis = 0`

/** Clamp a requested batch size to 1..MAX_PUBLISH_LIMIT; non-finite input falls back to the default. */
function clampPublishLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PUBLISH_LIMIT
  return Math.min(MAX_PUBLISH_LIMIT, Math.max(1, Math.floor(limit)))
}

/** At most `limit` brain entries not yet enqueued for Anamnesis, oldest first. */
function getUnsyncedBrainEntries(db: Database.Database, limit: number): UnsyncedBrainEntryRow[] {
  return db
    .prepare(`${UNSYNCED_ENTRY_SELECT}
       ORDER BY be.created_at ASC, be.id ASC
       LIMIT ?`)
    .all(limit) as UnsyncedBrainEntryRow[]
}

/** One brain entry by id, only if it is not yet enqueued for Anamnesis. */
function getUnsyncedBrainEntryById(db: Database.Database, entryId: string): UnsyncedBrainEntryRow | undefined {
  return db
    .prepare(`${UNSYNCED_ENTRY_SELECT} AND be.id = ?`)
    .get(entryId) as UnsyncedBrainEntryRow | undefined
}

/** Repo-relative artifact path, so the payload never carries the local home directory. */
function toRepoRelativePath(artifactPath: string, repoPath: string | null): string {
  if (!repoPath) return artifactPath
  const rel = relative(repoPath, artifactPath)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : artifactPath
}

/** Outbox payload for one brain entry. `domain_category` is one of the 7 shared categories. */
function buildBrainEntryPayload(entry: UnsyncedBrainEntryRow): Record<string, unknown> {
  return {
    entry_id: entry.id,
    repo_id: entry.repoId,
    repo_name: entry.repoName,
    type: entry.type,
    subject: entry.subject,
    status: entry.status,
    computed_status: entry.computedStatus,
    artifact_path: toRepoRelativePath(entry.artifactPath, entry.repoPath),
    created_at: entry.createdAt,
    domain_category: mapBrainTypeToDomainCategory(entry.type as BrainEntryType)
  }
}

/** Enqueue one BRAIN_ENTRY_PUBLISHED outbox event and flag the entry synced, atomically. */
function enqueueBrainEntry(db: Database.Database, entry: UnsyncedBrainEntryRow): void {
  insertTaskEvent(db, {
    taskId: null,
    eventType: 'BRAIN_ENTRY_PUBLISHED',
    fromStatus: null,
    toStatus: entry.status,
    agentId: null,
    payload: buildBrainEntryPayload(entry)
  })
  db.prepare('UPDATE brain_entries SET synced_to_anamnesis = 1 WHERE id = ?').run(entry.id)
}

/** Number of brain entries not yet enqueued for Anamnesis (backfill dry-run). */
export function countUnsyncedBrainEntries(db: Database.Database): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM brain_entries WHERE synced_to_anamnesis = 0')
    .get() as { n: number }
  return row.n
}

/**
 * Publish one batch of unsynced brain entries (oldest first, at most `limit`, default 50,
 * clamped to 1..200) to the Anamnesis outbox (task_events), marking each
 * `synced_to_anamnesis=1` in the same transaction as its enqueue. The AnamnesisWriter
 * delivers the outbox; `synced_to_anamnesis` here means "handed to the outbox".
 * Returns the number of entries enqueued.
 */
export function publishUnsyncedBrainEntries(
  db: Database.Database,
  options: { limit?: number } = {}
): number {
  const entries = getUnsyncedBrainEntries(db, clampPublishLimit(options.limit))
  if (entries.length === 0) return 0

  db.transaction((rows: UnsyncedBrainEntryRow[]) => {
    for (const entry of rows) enqueueBrainEntry(db, entry)
  })(entries)

  log.info(`Brain publisher: enqueued ${entries.length} brain entries for Anamnesis`)
  getAnamnesisWriter()?.onEventInserted()
  return entries.length
}

/**
 * Publish a single brain entry if it is still unsynced — never the backlog.
 * Returns true when the entry was enqueued, false when it is unknown or already synced.
 */
export function publishBrainEntryById(db: Database.Database, entryId: string): boolean {
  const entry = getUnsyncedBrainEntryById(db, entryId)
  if (!entry) return false

  db.transaction((row: UnsyncedBrainEntryRow) => enqueueBrainEntry(db, row))(entry)

  log.info(`Brain publisher: enqueued brain entry ${entryId} for Anamnesis`)
  getAnamnesisWriter()?.onEventInserted()
  return true
}
