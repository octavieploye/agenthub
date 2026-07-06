import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
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

describe('detectGitSignal', () => {
  const gitLog = [
    { message: 'feat(telegram): add sidecar service', date: '2026-07-01' },
    { message: 'fix(brain): resolve scanner bug', date: '2026-07-03' },
    { message: 'chore: update dependencies', date: '2026-06-20' },
  ]

  test('returns true when a commit after docDate matches a subject keyword', () => {
    const result = detectGitSignal(gitLog, '2026-06-28', 'Telegram Sidecar Service')
    expect(result).toBe(true)
  })

  test('returns false when matching commit is before docDate', () => {
    // 'chore: update dependencies' is 2026-06-20, before 2026-06-28
    const result = detectGitSignal(gitLog, '2026-06-28', 'Update Dependencies')
    expect(result).toBe(false)
  })

  test('returns false when no commit matches any keyword', () => {
    const result = detectGitSignal(gitLog, '2026-06-01', 'Forgejo Integration Adapters')
    expect(result).toBe(false)
  })

  test('returns false for empty git log', () => {
    const result = detectGitSignal([], '2026-06-01', 'Telegram Sidecar')
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

  test('returns in_progress when some checklist items done', () => {
    expect(deriveComputedStatus(4, 2, false, '')).toBe('in_progress')
  })

  test('returns in_progress when gitSignal is true and no checklist', () => {
    expect(deriveComputedStatus(0, 0, true, '')).toBe('in_progress')
  })

  test('returns remaining when no checklist and no git signal', () => {
    expect(deriveComputedStatus(0, 0, false, '')).toBe('remaining')
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

  test('uses git log from gitService to set git_signal', () => {
    const specsDir = join(tmpDir, 'docs', 'superpowers', 'specs')
    mkdirSync(specsDir, { recursive: true })
    // File named 2026-06-15 — commit dated 2026-07-01 mentioning "telegram" comes after
    writeFileSync(
      join(specsDir, '2026-06-15-telegram-sidecar.md'),
      '# Telegram Sidecar\n\nDetailed spec content for telegram sidecar service architecture.\n'
    )

    ;(mockGitService.getLog as ReturnType<typeof vi.fn>).mockReturnValue([
      { hash: 'abc1', shortHash: 'abc1', author: 'Dev', date: '2026-07-01', message: 'feat(telegram): add sidecar service' }
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
