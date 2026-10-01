import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  parseChecklist,
  detectGitSignal,
  deriveComputedStatus,
  BrainScannerService
} from './brain-scanner'
import { GitService } from './git-service'
import { getDb, resetDb, closeDb } from '../db/connection'
import { upsertBrainEntry } from '../db/queries/brain.queries'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockGitService(): GitService {
  return {
    getLog: vi.fn().mockReturnValue([]),
    getStatus: vi.fn(),
    getDiff: vi.fn(),
    stageFiles: vi.fn(),
    unstageFiles: vi.fn(),
    commit: vi.fn(),
    push: vi.fn(),
    pull: vi.fn(),
    getBranches: vi.fn(),
    getCurrentBranch: vi.fn(),
    getAheadBehind: vi.fn(),
    getStagedFiles: vi.fn(),
    getUnstagedFiles: vi.fn(),
    getUntrackedFiles: vi.fn(),
    parseDiffStats: vi.fn(),
    suggestCommitMessage: vi.fn(),
  } as unknown as GitService
}

// ---------------------------------------------------------------------------
// parseChecklist
// ---------------------------------------------------------------------------

describe('parseChecklist', () => {
  test('returns zero counts for content with no checklist items', () => {
    const result = parseChecklist('# My Spec\n\nSome text with no tasks.')
    expect(result).toEqual({ total: 0, done: 0 })
  })

  test('counts done and remaining items correctly', () => {
    const content = `
# Plan
- [x] Step one done
- [x] Step two done
- [ ] Step three pending
- [ ] Step four pending
    `
    const result = parseChecklist(content)
    expect(result).toEqual({ total: 4, done: 2 })
  })

  test('is case-insensitive for X marker', () => {
    const content = '- [X] Done uppercase\n- [x] Done lowercase\n- [ ] Pending'
    const result = parseChecklist(content)
    expect(result).toEqual({ total: 3, done: 2 })
  })

  test('returns zero for empty string', () => {
    expect(parseChecklist('')).toEqual({ total: 0, done: 0 })
  })
})

// ---------------------------------------------------------------------------
// detectGitSignal
// ---------------------------------------------------------------------------

// detectGitSignal uses explicit [Refs] footer matching (not fuzzy keywords).
// Old keyword-based tests replaced here because keyword matching produced false positives:
// common words like "telegram", "brain", "agent" appeared in unrelated commits, marking
// nearly every spec as in_progress regardless of actual implementation activity.
describe('detectGitSignal', () => {
  const gitLog = [
    {
      message: 'feat(telegram): add sidecar service\n\n[Task]        N/A — Telegram Sidecar\n[Category]    Implementation\n[Refs]        2026-06-27-telegram-sidecar',
      date: '2026-07-01'
    },
    {
      message: 'fix(brain): resolve scanner bug',
      date: '2026-07-03'
    },
    {
      message: 'chore: update deps\n\n[Refs]        2026-06-24-kanban-daisy-ui-redesign',
      date: '2026-06-20'
    },
  ]

  test('returns true when a later commit [Refs] line includes the artifact slug', () => {
    const result = detectGitSignal(gitLog, '2026-06-28', '2026-06-27-telegram-sidecar')
    expect(result).toBe(true)
  })

  test('returns false when matching [Refs] commit is before docDate', () => {
    // kanban commit is 2026-06-20, before 2026-06-25
    const result = detectGitSignal(gitLog, '2026-06-25', '2026-06-24-kanban-daisy-ui-redesign')
    expect(result).toBe(false)
  })

  test('returns false when no commit has a matching [Refs] line', () => {
    const result = detectGitSignal(gitLog, '2026-06-01', '2026-07-06-brain-status-filter')
    expect(result).toBe(false)
  })

  test('returns false for empty git log', () => {
    const result = detectGitSignal([], '2026-06-01', '2026-06-27-telegram-sidecar')
    expect(result).toBe(false)
  })

  test('returns false when commit subject mentions keyword but has no [Refs] line', () => {
    // Proves old fuzzy matching is gone — subject words no longer trigger git signal
    const result = detectGitSignal(gitLog, '2026-06-01', 'Telegram Sidecar')
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// deriveComputedStatus
// ---------------------------------------------------------------------------

describe('deriveComputedStatus', () => {
  test('returns done when all checklist items are checked', () => {
    expect(deriveComputedStatus(3, 3, false, '')).toBe('done')
  })

  test('returns done when fileContent contains implemented marker', () => {
    expect(deriveComputedStatus(0, 0, false, '## Status: implemented')).toBe('done')
  })

  test('returns done when fileContent contains "Status: done" marker', () => {
    expect(deriveComputedStatus(0, 0, false, '## Status: done')).toBe('done')
  })

  test('returns in_progress when some checklist items done', () => {
    expect(deriveComputedStatus(4, 2, false, '')).toBe('in_progress')
  })

  test('returns in_progress when gitSignal is true and no checklist', () => {
    expect(deriveComputedStatus(0, 0, true, '')).toBe('in_progress')
  })

  test('returns remaining when no checklist and no git signal', () => {
    expect(deriveComputedStatus(0, 0, false, '')).toBe('remaining')
  })

  test('does NOT return done for file mentioning "not yet implemented"', () => {
    expect(deriveComputedStatus(0, 0, false, 'This feature is not yet implemented in the codebase.')).toBe('remaining')
  })

  test('gitSignal does not override all-done checklist', () => {
    expect(deriveComputedStatus(2, 2, true, '')).toBe('done')
  })
})

// ---------------------------------------------------------------------------
// discoverRepoArtifacts integration
// ---------------------------------------------------------------------------

describe('discoverRepoArtifacts', () => {
  let tmpDir: string
  let mockGitService: GitService
  let scanner: BrainScannerService

  beforeEach(() => {
    // Reset the DB singleton so each test gets a fresh in-memory DB with migrations
    resetDb()
    tmpDir = mkdtempSync(join(tmpdir(), 'brain-scanner-test-'))
    mockGitService = createMockGitService()
    scanner = new BrainScannerService(mockGitService)

    // Seed the test repo using the same singleton getDb() will return
    const db = getDb()
    db.prepare(
      'INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)'
    ).run('repo-test', 'Test Repo', tmpDir, '2026-01-01T00:00:00Z')
  })

  afterEach(() => {
    closeDb()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('returns 0 when repo path does not exist', () => {
    const result = scanner.discoverRepoArtifacts({
      id: 'nonexistent',
      name: 'Ghost',
      path: '/tmp/definitely-does-not-exist-xyz-abc',
    } as any)
    expect(result).toBe(0)
  })

  test('returns 0 when no known scan directories exist in repo', () => {
    const result = scanner.discoverRepoArtifacts({
      id: 'repo-test',
      name: 'Test Repo',
      path: tmpDir,
    } as any)
    expect(result).toBe(0)
  })

  test('registers an artifact by writing a pointer file and upserting its database row', () => {
    const artifactPath = join(tmpDir, 'docs', 'spec.md')
    mkdirSync(join(tmpDir, 'docs'), { recursive: true })
    writeFileSync(artifactPath, '# Spec\n')

    const entryId = scanner.registerBrainEntry({
      repoId: 'repo-test',
      subject: 'Safe Registration',
      type: 'spec',
      artifactPath,
      project: 'Reliability',
      note: 'Registered manually'
    })

    const db = getDb()
    const entry = db.prepare('SELECT * FROM brain_entries WHERE id = ?').get(entryId) as {
      pointer_path: string
      artifact_path: string
      subject: string
      type: string
      note: string
    }

    expect(entry).toMatchObject({
      artifact_path: artifactPath,
      subject: 'Safe Registration',
      type: 'spec',
      note: 'Registered manually'
    })
    expect(existsSync(entry.pointer_path)).toBe(true)
    expect(readFileSync(entry.pointer_path, 'utf-8')).toContain('project: "Reliability"')
  })

  test('discovers .md files in a known scan directory', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    writeFileSync(
      join(specsDir, '2026-07-01-my-feature-design.md'),
      '# My Feature\n\nSome content that is long enough to be discovered.\n\n- [ ] Task one\n- [x] Task two\n'
    )

    const result = scanner.discoverRepoArtifacts({
      id: 'repo-test',
      name: 'Test Repo',
      path: tmpDir,
    } as any)

    expect(result).toBe(1)
  })

  test('populates checklist columns from file content', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    writeFileSync(
      join(specsDir, '2026-07-01-checklist-spec.md'),
      '# Spec\n\n- [x] Done item\n- [x] Done item two\n- [ ] Pending item\n'
    )

    scanner.discoverRepoArtifacts({
      id: 'repo-test',
      name: 'Test Repo',
      path: tmpDir,
    } as any)

    const db = getDb()
    const row = db
      .prepare('SELECT checklist_total, checklist_done, computed_status FROM brain_entries LIMIT 1')
      .get() as any

    expect(row.checklist_total).toBe(3)
    expect(row.checklist_done).toBe(2)
    expect(row.computed_status).toBe('in_progress')
  })

  test('sets computed_status to done when all checklist items checked', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    writeFileSync(
      join(specsDir, '2026-07-01-all-done.md'),
      '# Complete Spec\n\n- [x] Step one\n- [x] Step two\n- [x] Step three\n'
    )

    scanner.discoverRepoArtifacts({
      id: 'repo-test',
      name: 'Test Repo',
      path: tmpDir,
    } as any)

    const db = getDb()
    const row = db
      .prepare('SELECT computed_status FROM brain_entries LIMIT 1')
      .get() as any

    expect(row.computed_status).toBe('done')
  })

  test('uses git log from gitService to set git_signal when [Refs] footer matches slug', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    // File slug is "2026-06-15-telegram-sidecar" — commit must reference it via [Refs]
    writeFileSync(
      join(specsDir, '2026-06-15-telegram-sidecar.md'),
      '# Telegram Sidecar\n\nDetailed spec content for telegram sidecar service architecture.\n'
    )

    ;(mockGitService.getLog as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        hash: 'abc1', shortHash: 'abc1', author: 'Dev', date: '2026-07-01',
        message: 'feat(telegram): add sidecar service\n\n[Task]        N/A\n[Refs]        2026-06-15-telegram-sidecar'
      }
    ])

    scanner.discoverRepoArtifacts({
      id: 'repo-test',
      name: 'Test Repo',
      path: tmpDir,
    } as any)

    const db = getDb()
    const row = db
      .prepare('SELECT git_signal, computed_status FROM brain_entries LIMIT 1')
      .get() as any

    expect(row.git_signal).toBe(1)
    expect(row.computed_status).toBe('in_progress')
  })

  test('handles git service throwing gracefully — git_signal stays 0', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    writeFileSync(
      join(specsDir, '2026-07-01-error-spec.md'),
      '# Error Test\n\nFile content for a spec with no git available.\n'
    )

    ;(mockGitService.getLog as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('git not available')
    })

    const result = scanner.discoverRepoArtifacts({
      id: 'repo-test',
      name: 'Test Repo',
      path: tmpDir,
    } as any)

    expect(result).toBe(1)

    const db = getDb()
    const row = db
      .prepare('SELECT git_signal FROM brain_entries LIMIT 1')
      .get() as any

    expect(row.git_signal).toBe(0)
  })

  test('skips files smaller than 20 bytes', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    writeFileSync(join(specsDir, '2026-07-01-tiny.md'), '# Hi')

    const result = scanner.discoverRepoArtifacts({
      id: 'repo-test',
      name: 'Test Repo',
      path: tmpDir,
    } as any)

    expect(result).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Anamnesis publish scope — discovery publishes only the entries it newly inserted
// (max 50 per call, option A); registration publishes only the entry it just registered.
// Neither ever publishes the pre-existing unsynced backlog (S92 protection).
// ---------------------------------------------------------------------------

describe('brain scanner Anamnesis publish scope', () => {
  let tmpDir: string
  let scanner: BrainScannerService

  function brainOutboxCount(): number {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS n FROM task_events WHERE event_type = 'BRAIN_ENTRY_PUBLISHED'`)
      .get() as { n: number }
    return row.n
  }

  function syncedFlag(id: string): number {
    const row = getDb()
      .prepare('SELECT synced_to_anamnesis AS s FROM brain_entries WHERE id = ?')
      .get(id) as { s: number }
    return row.s
  }

  function unsyncedCount(): number {
    const row = getDb()
      .prepare('SELECT COUNT(*) AS n FROM brain_entries WHERE synced_to_anamnesis = 0')
      .get() as { n: number }
    return row.n
  }

  function seedUnsyncedEntry(id: string, artifactPath: string): void {
    upsertBrainEntry(getDb(), {
      id,
      repoId: 'repo-pub',
      pointerPath: artifactPath,
      artifactPath,
      type: 'spec',
      subject: 'Seeded backlog entry',
      status: 'active',
      createdAt: '2026-06-01'
    })
  }

  beforeEach(() => {
    resetDb()
    tmpDir = mkdtempSync(join(tmpdir(), 'brain-scanner-publish-test-'))
    scanner = new BrainScannerService(createMockGitService())
    getDb().prepare(
      'INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)'
    ).run('repo-pub', 'Publish Repo', tmpDir, '2026-01-01T00:00:00Z')
  })

  afterEach(() => {
    closeDb()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('discoverAllArtifacts enqueues one BRAIN_ENTRY_PUBLISHED per newly discovered entry', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    writeFileSync(join(specsDir, '2026-07-01-first-spec.md'), '# First\n\nLong enough spec content here.\n')
    writeFileSync(join(specsDir, '2026-07-02-second-spec.md'), '# Second\n\nLong enough spec content here.\n')

    const result = scanner.discoverAllArtifacts()

    expect(result.discovered).toBe(2)
    expect(brainOutboxCount()).toBe(2)
    expect(unsyncedCount()).toBe(0)
  })

  test('discoverAllArtifacts never publishes an entry that already existed unsynced before the scan', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    const existingPath = join(specsDir, '2026-07-01-existing-spec.md')
    writeFileSync(existingPath, '# Existing\n\nLong enough spec content here.\n')
    seedUnsyncedEntry('auto_repo-pub_docs_superpowers_specs_2026_07_01_existing_spec_md', existingPath)
    writeFileSync(join(specsDir, '2026-07-02-new-spec.md'), '# New\n\nLong enough spec content here.\n')

    scanner.discoverAllArtifacts()

    expect(brainOutboxCount()).toBe(1)
    expect(syncedFlag('auto_repo-pub_docs_superpowers_specs_2026_07_01_existing_spec_md')).toBe(0)
    expect(unsyncedCount()).toBe(1)
  })

  test('discoverAllArtifacts leaves a pre-existing unsynced entry unsynced even when nothing is new', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    const backlogPath = join(specsDir, '2026-07-01-backlog-spec.md')
    writeFileSync(backlogPath, '# Backlog\n\nLong enough spec content here.\n')
    const backlogId = 'auto_repo-pub_docs_superpowers_specs_2026_07_01_backlog_spec_md'
    seedUnsyncedEntry(backlogId, backlogPath)

    scanner.discoverAllArtifacts()

    expect(brainOutboxCount()).toBe(0)
    expect(syncedFlag(backlogId)).toBe(0)
  })

  test('discoverAllArtifacts publishes at most 50 new entries per call, oldest first, and leaves the overflow unsynced', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    for (let i = 1; i <= 60; i++) {
      // Dates ascend with i: 2026-08-01..30, then 2026-09-01..30 — the filename date is created_at.
      const month = i <= 30 ? '08' : '09'
      const day = String(i <= 30 ? i : i - 30).padStart(2, '0')
      writeFileSync(
        join(specsDir, `2026-${month}-${day}-spec-${i}.md`),
        `# Spec ${i}\n\nLong enough spec content here.\n`
      )
    }

    const result = scanner.discoverAllArtifacts()

    expect(result.discovered).toBe(60)
    expect(brainOutboxCount()).toBe(50)
    expect(unsyncedCount()).toBe(10)
    const unsyncedDates = (getDb()
      .prepare('SELECT created_at AS c FROM brain_entries WHERE synced_to_anamnesis = 0 ORDER BY created_at')
      .all() as { c: string }[]).map((r) => r.c)
    const newestPublished = (getDb()
      .prepare('SELECT MAX(created_at) AS c FROM brain_entries WHERE synced_to_anamnesis = 1')
      .get() as { c: string }).c
    expect(unsyncedDates.every((d) => d > newestPublished)).toBe(true)
  })

  test('a second scan with nothing new enqueues nothing, and the overflow stays unsynced', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    for (let i = 1; i <= 60; i++) {
      const day = String(i).padStart(2, '0')
      writeFileSync(join(specsDir, `2026-07-01-spec-${day}.md`), `# Spec ${day}\n\nLong enough spec content here.\n`)
    }
    scanner.discoverAllArtifacts()
    const afterFirst = brainOutboxCount()

    scanner.discoverAllArtifacts()

    expect(afterFirst).toBe(50)
    expect(brainOutboxCount()).toBe(50)
    expect(unsyncedCount()).toBe(10)
  })

  test('discoverAllArtifacts never re-publishes a pre-existing synced entry', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    const syncedPath = join(specsDir, '2026-07-01-synced-spec.md')
    writeFileSync(syncedPath, '# Synced\n\nLong enough spec content here.\n')
    const syncedId = 'auto_repo-pub_docs_superpowers_specs_2026_07_01_synced_spec_md'
    seedUnsyncedEntry(syncedId, syncedPath)
    getDb().prepare('UPDATE brain_entries SET synced_to_anamnesis = 1 WHERE id = ?').run(syncedId)

    scanner.discoverAllArtifacts()

    expect(brainOutboxCount()).toBe(0)
    expect(syncedFlag(syncedId)).toBe(1)
  })

  test('registerBrainEntry enqueues only its own entry when other unsynced entries exist', () => {
    mkdirSync(join(tmpDir, 'docs'), { recursive: true })
    seedUnsyncedEntry('backlog-entry', join(tmpDir, 'docs', 'backlog.md'))

    const artifactPath = join(tmpDir, 'docs', 'manual.md')
    writeFileSync(artifactPath, '# Manual\n')
    const entryId = scanner.registerBrainEntry({
      repoId: 'repo-pub',
      subject: 'Manual Entry',
      type: 'spec',
      artifactPath
    })

    expect(brainOutboxCount()).toBe(1)
    const event = getDb()
      .prepare(`SELECT payload_json AS p FROM task_events WHERE event_type = 'BRAIN_ENTRY_PUBLISHED'`)
      .get() as { p: string }
    expect(event.p).toContain(entryId)
    expect(syncedFlag(entryId)).toBe(1)
    const backlog = getDb()
      .prepare('SELECT COUNT(*) AS n FROM brain_entries WHERE synced_to_anamnesis = 0')
      .get() as { n: number }
    expect(backlog.n).toBe(1)
  })
})
