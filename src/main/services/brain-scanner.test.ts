import { describe, expect, test, beforeEach, afterEach, vi, beforeAll } from 'vitest'
import { BrainScannerService } from './brain-scanner'
import { GitService } from './git-service'
import Database from 'better-sqlite3'
import { getDb } from '../db/connection'

// Mock GitService
def createMockGitService(): GitService {
  return {
    getLog: vi.fn().mockResolvedValue([]),
    // Mock other GitService methods as needed
    getStatus: vi.fn(),
    getDiff: vi.fn(),
    stageFiles: vi.fn(),
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
    getRecentCommits: vi.fn().mockResolvedValue([])
  } as any
}

// Mock database setup
def createTestDb(): Database.Database {
  const db = getDb(':memory:')

  // Create required tables
  db.exec(`
    CREATE TABLE repos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      glow_color TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      hidden INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      path TEXT,
      created_at TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE brain_entries (
      id TEXT PRIMARY KEY,
      repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      pointer_path TEXT NOT NULL UNIQUE,
      artifact_path TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('brainstorm','spec','plan','sprint')),
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
                CHECK(status IN ('draft','active','parked','implemented')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_to_anamnesis INTEGER NOT NULL DEFAULT 0,
      note TEXT
    )
  `)

  db.exec(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      brain_entry_id TEXT REFERENCES brain_entries(id) ON DELETE SET NULL
    )
  `)

  return db
}

describe('BrainScannerService', () => {
  let brainScanner: BrainScannerService
  let mockGitService: GitService
  let db: Database.Database

  beforeEach(() => {
    mockGitService = createMockGitService()
    brainScanner = new BrainScannerService(mockGitService)
    db = createTestDb()

    // Insert test repo
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
      'repo1', 'Test Repo', '/tmp/test-repo', '2023-01-01T00:00:00Z'
    )
  })

  afterEach(() => {
    db.close()
  })

  describe('registerBrainEntry', () => {
    test('should create brain entry and return entry ID', () => {
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Test Brainstorm',
        'brainstorm',
        '/tmp/test-repo/docs/test.md',
        'Test Project',
        'Initial brainstorm session'
      )

      expect(entryId).toBeDefined()
      expect(entryId).toContain('brain_repo1_')

      // Verify entry was created in database
      const entry = db.prepare('SELECT * FROM brain_entries WHERE id = ?').get(entryId) as any
      expect(entry).toBeDefined()
      expect(entry.subject).toBe('Test Brainstorm')
      expect(entry.type).toBe('brainstorm')
      expect(entry.note).toContain('Project: Test Project')
    })

    test('should handle entry without project or note', () => {
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Simple Entry',
        'spec',
        '/tmp/test-repo/docs/simple.md'
      )

      expect(entryId).toBeDefined()

      const entry = db.prepare('SELECT * FROM brain_entries WHERE id = ?').get(entryId) as any
      expect(entry.subject).toBe('Simple Entry')
      expect(entry.type).toBe('spec')
      expect(entry.note).toBeNull()
    })
  })

  describe('updateBrainEntryStatus', () => {
    test('should update entry status in database', () => {
      // Create entry first
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Test Entry',
        'spec',
        '/tmp/test-repo/docs/test.md'
      )

      // Update status
      brainScanner.updateBrainEntryStatus(entryId, 'active')

      // Verify status was updated
      const entry = db.prepare('SELECT * FROM brain_entries WHERE id = ?').get(entryId) as any
      expect(entry.status).toBe('active')
    })
  })

  describe('createTaskFromBrainEntry', () => {
    test('should create task linked to brain entry', async () => {
      // Create entry first
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Test Entry',
        'spec',
        '/tmp/test-repo/docs/test.md'
      )

      // Create task
      const taskId = brainScanner.createTaskFromBrainEntry(entryId, 'Implement feature', 'Task description')

      expect(taskId).toBeDefined()

      // Verify task was created with correct linking
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task).toBeDefined()
      expect(task.subject).toBe('Implement feature')
      expect(task.description).toBe('Task description')
      expect(task.brain_entry_id).toBe(entryId)
    })

    test('should use default subject and description when not provided', async () => {
      // Create entry first
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Test Entry',
        'spec',
        '/tmp/test-repo/docs/test.md'
      )

      // Create task without custom subject/description
      const taskId = brainScanner.createTaskFromBrainEntry(entryId)

      expect(taskId).toBeDefined()

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task.subject).toBe('Implement: Test Entry')
      expect(task.description).toBe('Task created from brain entry: Test Entry')
    })
  })

  describe('getTimeline', () => {
    test('should return timeline with brain events', async () => {
      // Create entry
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Test Entry',
        'spec',
        '/tmp/test-repo/docs/test.md'
      )

      const timeline = await brainScanner.getTimeline('repo1')

      expect(timeline).toHaveLength(1)
      expect(timeline[0].type).toBe('brain')
      expect(timeline[0].subject).toBe('Test Entry')
    })

    test('should merge git events when available', async () => {
      // Mock git service to return commits
      const mockCommits = [
        {
          hash: 'abc123',
          shortHash: 'abc123',
          author: 'Test Author',
          date: '2023-01-01T10:00:00Z',
          message: 'Initial commit'
        }
      ]
      mockGitService.getRecentCommits = vi.fn().mockResolvedValue(mockCommits)

      // Create entry
      brainScanner.registerBrainEntry(
        'repo1',
        'Test Entry',
        'spec',
        '/tmp/test-repo/docs/test.md'
      )

      const timeline = await brainScanner.getTimeline('repo1')

      // Should have both brain event and git commit
      expect(timeline).toHaveLength(2)
      expect(timeline.some(e => e.type === 'brain')).toBe(true)
      expect(timeline.some(e => e.type === 'git')).toBe(true)
    })
  })

  describe('getBrainEntries', () => {
    test('should return empty array when no entries exist', () => {
      const entries = brainScanner.getBrainEntries()
      expect(entries).toEqual([])
    })

    test('should return brain entries with task counts', () => {
      // Create entry
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Test Entry',
        'spec',
        '/tmp/test-repo/docs/test.md'
      )

      // Create tasks
      brainScanner.createTaskFromBrainEntry(entryId, 'Task 1', 'Description 1')
      brainScanner.createTaskFromBrainEntry(entryId, 'Task 2', 'Description 2')

      const entries = brainScanner.getBrainEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].tasksTotal).toBe(2)
    })
  })

  describe('error handling', () => {
    test('should handle missing repo gracefully', () => {
      expect(() => {
        brainScanner.registerBrainEntry(
          'nonexistent',
          'Test Entry',
          'spec',
          '/tmp/test-repo/docs/test.md'
        )
      }).toThrow()
    })

    test('should handle invalid entry ID in status update', () => {
      expect(() => {
        brainScanner.updateBrainEntryStatus('nonexistent', 'active')
      }).not.toThrow() // Should handle gracefully
    })
  })
})