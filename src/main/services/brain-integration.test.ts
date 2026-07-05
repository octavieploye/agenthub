import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { BrainScannerService } from './brain-scanner'
import { GitService } from './git-service'
import Database from 'better-sqlite3'
import { getDb } from '../db/connection'
import {
  getBrainEntries,
  getBrainEntryById,
  upsertBrainEntry,
  updateBrainEntryStatus,
  createTaskFromBrainEntry
} from '../db/queries/brain.queries'

// Mock GitService
def createMockGitService(): GitService {
  return {
    getLog: vi.fn().mockResolvedValue([]),
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

// Create test database
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

describe('Brain Feature Integration', () => {
  let db: Database.Database
  let brainScanner: BrainScannerService
  let mockGitService: GitService

  beforeEach(() => {
    db = createTestDb()
    mockGitService = createMockGitService()
    brainScanner = new BrainScannerService(mockGitService)

    // Insert test repo
    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
      'repo1', 'Integration Test Repo', '/tmp/integration-test', '2023-01-01T00:00:00Z'
    )
  })

  afterEach(() => {
    db.close()
  })

  describe('Complete Workflow: Brainstorm → Spec → Plan → Tasks', () => {
    test('should handle complete brain entry lifecycle', async () => {
      // Step 1: Create brainstorm entry
      const brainstormId = brainScanner.registerBrainEntry(
        'repo1',
        'New Feature Idea',
        'brainstorm',
        '/tmp/integration-test/docs/brainstorm.md',
        undefined,
        'Initial ideas for new feature'
      )

      expect(brainstormId).toBeDefined()

      // Verify brainstorm was created
      let brainstorm = getBrainEntryById(db, brainstormId)
      expect(brainstorm?.subject).toBe('New Feature Idea')
      expect(brainstorm?.type).toBe('brainstorm')
      expect(brainstorm?.status).toBe('draft')

      // Step 2: Update to spec
      brainScanner.updateBrainEntryStatus(brainstormId, 'active')
      upsertBrainEntry(db, {
        ...brainstorm!,
        id: brainstormId,
        type: 'spec',
        subject: 'New Feature Specification',
        status: 'active',
        note: 'Detailed specification with requirements'
      })

      let spec = getBrainEntryById(db, brainstormId)
      expect(spec?.type).toBe('spec')
      expect(spec?.subject).toBe('New Feature Specification')
      expect(spec?.status).toBe('active')

      // Step 3: Create plan
      const planId = brainScanner.registerBrainEntry(
        'repo1',
        'New Feature Implementation Plan',
        'plan',
        '/tmp/integration-test/docs/plan.md',
        'Q3 2023',
        'Step-by-step implementation plan'
      )

      const plan = getBrainEntryById(db, planId)
      expect(plan?.type).toBe('plan')
      expect(plan?.note).toContain('Project: Q3 2023')

      // Step 4: Create tasks from plan
      const task1Id = brainScanner.createTaskFromBrainEntry(
        planId,
        'Implement core functionality',
        'Build the main feature components'
      )

      const task2Id = brainScanner.createTaskFromBrainEntry(
        planId,
        'Add tests',
        'Write unit and integration tests'
      )

      const task3Id = brainScanner.createTaskFromBrainEntry(
        planId,
        'Document feature',
        'Write documentation and examples'
      )

      // Verify tasks were created and linked
      const tasks = db.prepare('SELECT * FROM tasks WHERE brain_entry_id = ?').all(planId) as any[]
      expect(tasks).toHaveLength(3)
      expect(tasks.every(t => t.brain_entry_id === planId)).toBe(true)

      // Step 5: Check query results
      const allEntries = brainScanner.getBrainEntries()
      expect(allEntries).toHaveLength(2) // brainstorm/spec (updated) + plan

      const planEntry = allEntries.find(e => e.id === planId)
      expect(planEntry?.tasksTotal).toBe(3)
      expect(planEntry?.tasksDone).toBe(0)
      expect(planEntry?.tasksInProgress).toBe(0)

      // Step 6: Update task statuses
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('completed', task1Id)
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('in_progress', task2Id)

      // Verify task counts update
      const updatedPlanEntry = brainScanner.getBrainEntries().find(e => e.id === planId)
      expect(updatedPlanEntry?.tasksDone).toBe(1)
      expect(updatedPlanEntry?.tasksInProgress).toBe(1)

      // Step 7: Mark plan as implemented
      brainScanner.updateBrainEntryStatus(planId, 'implemented')

      const implementedPlan = getBrainEntryById(db, planId)
      expect(implementedPlan?.status).toBe('implemented')

      // Step 8: Check timeline
      const timeline = await brainScanner.getTimeline('repo1')
      expect(timeline).toHaveLength(2) // brainstorm/spec + plan
      expect(timeline.every(e => e.type === 'brain')).toBe(true)
    })
  })

  describe('Task Creation and Linking', () => {
    test('should create tasks with proper brain entry linking', async () => {
      // Create brain entry
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Test Entry',
        'spec',
        '/tmp/integration-test/docs/test.md'
      )

      // Create multiple tasks
      const taskIds = []
      for (let i = 1; i <= 5; i++) {
        const taskId = brainScanner.createTaskFromBrainEntry(
          entryId,
          `Task ${i}`,
          `Description for task ${i}`
        )
        taskIds.push(taskId)
      }

      // Verify all tasks were created
      expect(taskIds).toHaveLength(5)
      taskIds.forEach(id => expect(id).toBeDefined())

      // Verify database records
      const tasks = db.prepare('SELECT * FROM tasks WHERE brain_entry_id = ?').all(entryId) as any[]
      expect(tasks).toHaveLength(5)
      expect(tasks.every(t => t.brain_entry_id === entryId)).toBe(true)

      // Verify query returns correct task counts
      const entry = brainScanner.getBrainEntries().find(e => e.id === entryId)
      expect(entry?.tasksTotal).toBe(5)
      expect(entry?.tasksDone).toBe(0)
      expect(entry?.tasksInProgress).toBe(0)
    })

    test('should handle task creation with default values', async () => {
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Entry with Default Tasks',
        'plan',
        '/tmp/integration-test/docs/plan.md'
      )

      // Create task without custom subject/description
      const taskId = brainScanner.createTaskFromBrainEntry(entryId)

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task.subject).toBe('Implement: Entry with Default Tasks')
      expect(task.description).toBe('Task created from brain entry: Entry with Default Tasks')
      expect(task.brain_entry_id).toBe(entryId)
    })
  })

  describe('Timeline Integration', () => {
    test('should merge brain events and git commits chronologically', async () => {
      // Create brain entries with different dates
      const entry1Id = brainScanner.registerBrainEntry(
        'repo1',
        'First Entry',
        'brainstorm',
        '/tmp/integration-test/docs/first.md'
      )

      // Mock git commits
      const mockCommits = [
        {
          hash: 'commit1',
          shortHash: 'c1',
          author: 'Test Author',
          date: '2023-01-02T10:00:00Z',
          message: 'First commit'
        },
        {
          hash: 'commit2',
          shortHash: 'c2',
          author: 'Test Author',
          date: '2023-01-03T10:00:00Z',
          message: 'Second commit'
        }
      ]

      mockGitService.getRecentCommits = vi.fn().mockResolvedValue(mockCommits)

      // Create second brain entry
      const entry2Id = brainScanner.registerBrainEntry(
        'repo1',
        'Second Entry',
        'spec',
        '/tmp/integration-test/docs/second.md'
      )

      const timeline = await brainScanner.getTimeline('repo1')

      // Should have brain entries + git commits
      expect(timeline).toHaveLength(4)

      // Verify both types are present
      const brainEvents = timeline.filter(e => e.type === 'brain')
      const gitEvents = timeline.filter(e => e.type === 'git')

      expect(brainEvents).toHaveLength(2)
      expect(gitEvents).toHaveLength(2)

      // Verify chronological ordering (newest first)
      const dates = timeline.map(e => new Date(e.date).getTime())
      expect(dates).toEqual([...dates].sort((a, b) => b - a))
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing repo gracefully', () => {
      expect(() => {
        brainScanner.registerBrainEntry(
          'nonexistent-repo',
          'Test Entry',
          'spec',
          '/tmp/integration-test/docs/test.md'
        )
      }).toThrow()
    })

    test('should handle invalid entry ID in operations', () => {
      // These should not throw errors
      expect(() => {
        brainScanner.updateBrainEntryStatus('nonexistent', 'active')
      }).not.toThrow()

      expect(() => {
        brainScanner.createTaskFromBrainEntry('nonexistent')
      }).toThrow() // This should throw as it requires the entry to exist
    })

    test('should handle empty repository', () => {
      const emptyRepoEntries = brainScanner.getBrainEntries()
      expect(emptyRepoEntries).toEqual([])
    })

    test('should handle entry without optional fields', () => {
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Minimal Entry',
        'brainstorm',
        '/tmp/integration-test/docs/minimal.md'
      )

      const entry = getBrainEntryById(db, entryId)
      expect(entry?.subject).toBe('Minimal Entry')
      expect(entry?.note).toBeNull()
      expect(entry?.projectId).toBeNull()
    })
  })

  describe('Data Consistency', () => {
    test('should maintain data consistency across operations', async () => {
      // Create entry
      const entryId = brainScanner.registerBrainEntry(
        'repo1',
        'Consistency Test',
        'spec',
        '/tmp/integration-test/docs/consistency.md',
        'Test Project',
        'Testing data consistency'
      )

      // Verify initial state
      let entry = getBrainEntryById(db, entryId)
      expect(entry?.subject).toBe('Consistency Test')
      expect(entry?.note).toContain('Project: Test Project')

      // Update status
      brainScanner.updateBrainEntryStatus(entryId, 'active')
      entry = getBrainEntryById(db, entryId)
      expect(entry?.status).toBe('active')

      // Create task
      const taskId = brainScanner.createTaskFromBrainEntry(entryId, 'Test Task')
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task.brain_entry_id).toBe(entryId)

      // Verify query consistency
      const entries = brainScanner.getBrainEntries()
      const foundEntry = entries.find(e => e.id === entryId)
      expect(foundEntry?.tasksTotal).toBe(1)

      // Verify timeline consistency
      const timeline = await brainScanner.getTimeline('repo1')
      const timelineEntry = timeline.find(e => e.id === entryId)
      expect(timelineEntry).toBeDefined()
      expect(timelineEntry?.subject).toBe('Consistency Test')
    })
  })
})