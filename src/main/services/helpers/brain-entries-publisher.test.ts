import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../db/migration-runner'
import { insertRepo } from '../../db/queries/repos.queries'
import { upsertBrainEntry } from '../../db/queries/brain.queries'
import { getUnsyncedEvents } from '../../db/queries/task-events.queries'
import {
  publishUnsyncedBrainEntries,
  countUnsyncedBrainEntries,
  publishBrainEntryById
} from './brain-entries-publisher'

// Outbox event type the publisher must enqueue — not yet in TaskEventType (red until C-T8).
const BRAIN_EVENT_TYPE = 'BRAIN_ENTRY_PUBLISHED'

let db: Database.Database
let repoId: string

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../../db/migrations')
  repoId = insertRepo(db, { name: 'brain-repo', path: '/tmp/brain-repo' }).id
})

afterEach(() => {
  db.close()
})

function seedEntry(id: string, type: string, subject: string): void {
  upsertBrainEntry(db, {
    id,
    repoId,
    pointerPath: `/tmp/brain-repo/docs/brain/${id}.md`,
    artifactPath: `/tmp/brain-repo/docs/${id}.md`,
    type,
    subject,
    status: 'active',
    createdAt: '2026-09-30T10:00:00.000Z'
  })
}

function syncedFlag(id: string): number {
  const row = db.prepare('SELECT synced_to_anamnesis AS s FROM brain_entries WHERE id = ?').get(id) as { s: number }
  return row.s
}

function brainOutbox(): ReturnType<typeof getUnsyncedEvents> {
  return getUnsyncedEvents(db).filter((e) => (e.eventType as string) === BRAIN_EVENT_TYPE)
}

describe('publishUnsyncedBrainEntries', () => {
  it('enqueues one outbox event per unsynced brain entry', () => {
    seedEntry('b1', 'strategy', 'Go-to-market')
    seedEntry('b2', 'how-to', 'Deploy guide')
    seedEntry('b3', 'plan', 'Q4 plan')

    const published = publishUnsyncedBrainEntries(db)

    expect(published).toBe(3)
    expect(brainOutbox()).toHaveLength(3)
  })

  it('marks every published entry synced_to_anamnesis=1', () => {
    seedEntry('b1', 'strategy', 'Go-to-market')
    seedEntry('b2', 'spec', 'Auth spec')

    publishUnsyncedBrainEntries(db)

    expect(syncedFlag('b1')).toBe(1)
    expect(syncedFlag('b2')).toBe(1)
  })

  it('puts the entry id, type, subject and mapped domain_category in the outbox payload', () => {
    seedEntry('b-how', 'how-to', 'Deploy guide')

    publishUnsyncedBrainEntries(db)

    const [event] = brainOutbox()
    expect(event).toBeDefined()
    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>
    const serialized = JSON.stringify(payload)
    expect(serialized).toContain('b-how')
    expect(serialized).toContain('Deploy guide')
    expect(payload.type).toBe('how-to')
    expect(payload.domain_category).toBe('operations')
  })

  it('maps a strategy entry to the strategy domain_category in its payload', () => {
    seedEntry('b-strat', 'strategy', 'Positioning')

    publishUnsyncedBrainEntries(db)

    const payload = JSON.parse(brainOutbox()[0].payloadJson) as Record<string, unknown>
    expect(payload.domain_category).toBe('strategy')
  })

  it('does not re-enqueue entries that are already synced', () => {
    seedEntry('b-old', 'strategy', 'Already synced')
    seedEntry('b-new', 'marketing', 'Fresh')
    db.prepare('UPDATE brain_entries SET synced_to_anamnesis = 1 WHERE id = ?').run('b-old')

    const published = publishUnsyncedBrainEntries(db)

    expect(published).toBe(1)
    const outbox = brainOutbox()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].payloadJson).toContain('b-new')
    expect(outbox[0].payloadJson).not.toContain('b-old')
  })

  it('is idempotent: a second run enqueues nothing', () => {
    seedEntry('b1', 'strategy', 'Go-to-market')

    expect(publishUnsyncedBrainEntries(db)).toBe(1)
    expect(publishUnsyncedBrainEntries(db)).toBe(0)
    expect(brainOutbox()).toHaveLength(1)
  })

  it('returns 0 and leaves the outbox empty when there are no brain entries', () => {
    expect(publishUnsyncedBrainEntries(db)).toBe(0)
    expect(brainOutbox()).toHaveLength(0)
  })
})

function seedEntryAt(id: string, createdAt: string): void {
  upsertBrainEntry(db, {
    id,
    repoId,
    pointerPath: `/tmp/brain-repo/docs/brain/${id}.md`,
    artifactPath: `/tmp/brain-repo/docs/${id}.md`,
    type: 'plan',
    subject: `Subject ${id}`,
    status: 'active',
    createdAt
  })
}

function seedMany(count: number): void {
  db.transaction(() => {
    for (let i = 0; i < count; i++) {
      seedEntryAt(`m${String(i).padStart(4, '0')}`, `2026-09-01T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`)
    }
  })()
}

describe('publishUnsyncedBrainEntries — batch limit (S92)', () => {
  it('enqueues at most 50 entries when no limit is given', () => {
    seedMany(60)

    expect(publishUnsyncedBrainEntries(db)).toBe(50)
    expect(brainOutbox()).toHaveLength(50)
    expect(countUnsyncedBrainEntries(db)).toBe(10)
  })

  it('enqueues at most `limit` entries, oldest first', () => {
    seedEntryAt('newest', '2026-09-03T00:00:00.000Z')
    seedEntryAt('oldest', '2026-09-01T00:00:00.000Z')
    seedEntryAt('middle', '2026-09-02T00:00:00.000Z')

    expect(publishUnsyncedBrainEntries(db, { limit: 2 })).toBe(2)

    expect(syncedFlag('oldest')).toBe(1)
    expect(syncedFlag('middle')).toBe(1)
    expect(syncedFlag('newest')).toBe(0)
  })

  it('clamps a limit above 200 down to 200', () => {
    seedMany(210)

    expect(publishUnsyncedBrainEntries(db, { limit: 1000 })).toBe(200)
    expect(countUnsyncedBrainEntries(db)).toBe(10)
  })

  it('clamps a limit below 1 up to 1', () => {
    seedMany(3)

    expect(publishUnsyncedBrainEntries(db, { limit: 0 })).toBe(1)
    expect(publishUnsyncedBrainEntries(db, { limit: -5 })).toBe(1)
    expect(countUnsyncedBrainEntries(db)).toBe(1)
  })

  it('falls back to the default 50 when limit is not a finite number', () => {
    seedMany(55)

    expect(publishUnsyncedBrainEntries(db, { limit: Number.NaN })).toBe(50)
  })
})

describe('countUnsyncedBrainEntries', () => {
  it('returns 0 when there are no brain entries', () => {
    expect(countUnsyncedBrainEntries(db)).toBe(0)
  })

  it('counts only unsynced entries and enqueues nothing', () => {
    seedEntry('c1', 'plan', 'One')
    seedEntry('c2', 'plan', 'Two')
    seedEntry('c3', 'plan', 'Three')
    db.prepare('UPDATE brain_entries SET synced_to_anamnesis = 1 WHERE id = ?').run('c1')

    expect(countUnsyncedBrainEntries(db)).toBe(2)
    expect(brainOutbox()).toHaveLength(0)
    expect(syncedFlag('c2')).toBe(0)
  })
})

describe('publishBrainEntryById', () => {
  it('enqueues only the requested entry and marks it synced', () => {
    seedEntry('target', 'spec', 'Target spec')
    seedEntry('other1', 'plan', 'Backlog one')
    seedEntry('other2', 'plan', 'Backlog two')

    expect(publishBrainEntryById(db, 'target')).toBe(true)

    const outbox = brainOutbox()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].payloadJson).toContain('target')
    expect(syncedFlag('target')).toBe(1)
    expect(syncedFlag('other1')).toBe(0)
    expect(syncedFlag('other2')).toBe(0)
  })

  it('returns false and enqueues nothing for an already-synced entry', () => {
    seedEntry('done', 'spec', 'Already synced')
    db.prepare('UPDATE brain_entries SET synced_to_anamnesis = 1 WHERE id = ?').run('done')

    expect(publishBrainEntryById(db, 'done')).toBe(false)
    expect(brainOutbox()).toHaveLength(0)
  })

  it('returns false and enqueues nothing for an unknown id', () => {
    seedEntry('real', 'spec', 'Real entry')

    expect(publishBrainEntryById(db, 'does-not-exist')).toBe(false)
    expect(brainOutbox()).toHaveLength(0)
    expect(syncedFlag('real')).toBe(0)
  })
})

describe('publishUnsyncedBrainEntries — artifact path leakage (S93)', () => {
  function seedOutsideEntry(id: string, artifactPath: string): void {
    upsertBrainEntry(db, {
      id,
      repoId,
      pointerPath: `/tmp/brain-repo/docs/brain/${id}.md`,
      artifactPath,
      type: 'plan',
      subject: `Subject ${id}`,
      status: 'active',
      createdAt: '2026-09-30T10:00:00.000Z'
    })
  }

  function publishedPayload(): Record<string, unknown> {
    return JSON.parse(brainOutbox()[0].payloadJson) as Record<string, unknown>
  }

  it('keeps a repo-relative path for an artifact inside the repo and marks its scope', () => {
    seedEntry('in1', 'plan', 'Inside')

    publishUnsyncedBrainEntries(db)

    const payload = publishedPayload()
    expect(payload.artifact_path).toBe('docs/in1.md')
    expect(payload.artifact_path_scope).toBe('repo_relative')
  })

  it('sends only the file basename for an artifact outside the repo, never the absolute path', () => {
    seedOutsideEntry('out1', '/Users/someone/elsewhere/notes/plan.md')

    publishUnsyncedBrainEntries(db)

    const payload = publishedPayload()
    expect(payload.artifact_path).toBe('plan.md')
    expect(payload.artifact_path_scope).toBe('basename')
    expect(JSON.stringify(payload)).not.toContain('/Users/')
  })

  it('does not treat a sibling directory sharing the repo path prefix as inside the repo', () => {
    seedOutsideEntry('out2', '/tmp/brain-repo-other/secret/plan.md')

    publishUnsyncedBrainEntries(db)

    const payload = publishedPayload()
    expect(payload.artifact_path).toBe('plan.md')
    expect(payload.artifact_path_scope).toBe('basename')
  })
})
