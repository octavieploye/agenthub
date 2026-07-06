import { describe, expect, test, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  getBrainEntries,
  getBrainEntryById,
  upsertBrainEntry,
  updateBrainEntryStatus,
  deleteBrainEntry,
  getBrainTimeline,
  createTaskFromBrainEntry
} from './brain.queries'

// Creates an isolated in-memory DB with the brain_entries schema (including computed status columns).
// Does NOT use getDb() / migration runner — schema is defined inline for full isolation.
function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')

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
      type TEXT NOT NULL CHECK(type IN (
        'brainstorm','spec','plan','sprint',
        'strategy','marketing','how-to','reference','learning'
      )),
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('draft','active','parked','implemented')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_to_anamnesis INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      computed_status TEXT NOT NULL DEFAULT 'remaining'
        CHECK(computed_status IN ('remaining','in_progress','done')),
      checklist_total INTEGER NOT NULL DEFAULT 0,
      checklist_done  INTEGER NOT NULL DEFAULT 0,
      git_signal      INTEGER NOT NULL DEFAULT 0
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

  db.exec('CREATE INDEX idx_brain_entries_repo ON brain_entries(repo_id)')
  db.exec('CREATE INDEX idx_brain_entries_project ON brain_entries(project_id)')
  db.exec('CREATE INDEX idx_brain_entries_status ON brain_entries(status)')
  db.exec('CREATE INDEX idx_brain_entries_type ON brain_entries(type)')
  db.exec('CREATE INDEX idx_brain_entries_computed_status ON brain_entries(computed_status)')
  db.exec('CREATE INDEX idx_tasks_brain_entry ON tasks(brain_entry_id)')

  return db
}

describe('Brain Queries', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDb()

    db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
      'repo1', 'Test Repo 1', '/test/repo1', '2023-01-01T00:00:00Z'
    )

    db.prepare('INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)').run(
      'proj1', 'Test Project', '2023-01-01T00:00:00Z'
    )
  })

  afterEach(() => {
    db.close()
  })

  describe('getBrainEntries', () => {
    test('should return empty array when no entries exist', () => {
      const result = getBrainEntries(db)
      expect(result).toEqual([])
    })

    test('should return brain entries with task counts', () => {
      db.prepare(`
        INSERT INTO brain_entries (
          id, repo_id, project_id, pointer_path, artifact_path,
          type, subject, status, created_at, updated_at, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'entry1', 'repo1', 'proj1', '/test/docs/brain/entry1.md',
        '/test/docs/spec.md', 'spec', 'Test Entry', 'active',
        '2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z', 'Test note'
      )

      db.prepare('INSERT INTO tasks (id, subject, status, created_at, brain_entry_id) VALUES (?, ?, ?, ?, ?)').run(
        'task1', 'Task 1', 'completed', '2023-01-01T00:00:00Z', 'entry1'
      )
      db.prepare('INSERT INTO tasks (id, subject, status, created_at, brain_entry_id) VALUES (?, ?, ?, ?, ?)').run(
        'task2', 'Task 2', 'in_progress', '2023-01-01T00:00:00Z', 'entry1'
      )
      db.prepare('INSERT INTO tasks (id, subject, status, created_at, brain_entry_id) VALUES (?, ?, ?, ?, ?)').run(
        'task3', 'Task 3', 'pending', '2023-01-01T00:00:00Z', 'entry1'
      )

      const result = getBrainEntries(db)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'entry1',
        repoId: 'repo1',
        repoName: 'Test Repo 1',
        projectId: 'proj1',
        projectName: 'Test Project',
        type: 'spec',
        subject: 'Test Entry',
        status: 'active',
        note: 'Test note',
        tasksTotal: 3,
        tasksDone: 1,
        tasksInProgress: 1
      })
    })

    test('should filter by repoId when provided', () => {
      db.prepare(`
        INSERT INTO brain_entries (
          id, repo_id, pointer_path, artifact_path,
          type, subject, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('entry1', 'repo1', '/test1.md', '/artifact1.md', 'spec', 'Entry 1', 'active', '2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z')

      db.prepare('INSERT INTO repos (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
        'repo2', 'Test Repo 2', '/test/repo2', '2023-01-01T00:00:00Z'
      )

      db.prepare(`
        INSERT INTO brain_entries (
          id, repo_id, pointer_path, artifact_path,
          type, subject, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('entry2', 'repo2', '/test2.md', '/artifact2.md', 'brainstorm', 'Entry 2', 'draft', '2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z')

      const result = getBrainEntries(db, 'repo1')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('entry1')
    })
  })

  describe('getBrainEntryById', () => {
    test('should return null for non-existent entry', () => {
      const result = getBrainEntryById(db, 'nonexistent')
      expect(result).toBeNull()
    })

    test('should return brain entry with all fields', () => {
      db.prepare(`
        INSERT INTO brain_entries (
          id, repo_id, project_id, pointer_path, artifact_path,
          type, subject, status, created_at, updated_at, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'entry1', 'repo1', 'proj1', '/test/docs/brain/entry1.md',
        '/test/docs/spec.md', 'spec', 'Test Entry', 'active',
        '2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z', 'Test note'
      )

      const result = getBrainEntryById(db, 'entry1')
      expect(result).toMatchObject({
        id: 'entry1',
        repoId: 'repo1',
        repoName: 'Test Repo 1',
        projectId: 'proj1',
        projectName: 'Test Project',
        type: 'spec',
        subject: 'Test Entry',
        status: 'active',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-02T00:00:00Z',
        note: 'Test note'
      })
    })
  })

  describe('upsertBrainEntry', () => {
    test('should insert new brain entry', () => {
      upsertBrainEntry(db, {
        id: 'entry1',
        repoId: 'repo1',
        projectId: 'proj1',
        pointerPath: '/test/docs/brain/entry1.md',
        artifactPath: '/test/docs/spec.md',
        type: 'spec',
        subject: 'Test Entry',
        status: 'active',
        createdAt: '2023-01-01T00:00:00Z',
        note: 'Test note'
      })

      const result = getBrainEntryById(db, 'entry1')
      expect(result).not.toBeNull()
      expect(result?.subject).toBe('Test Entry')
    })

    test('should update existing brain entry', () => {
      upsertBrainEntry(db, {
        id: 'entry1',
        repoId: 'repo1',
        projectId: 'proj1',
        pointerPath: '/test/docs/brain/entry1.md',
        artifactPath: '/test/docs/spec.md',
        type: 'spec',
        subject: 'Original Subject',
        status: 'draft',
        createdAt: '2023-01-01T00:00:00Z',
        note: 'Original note'
      })

      upsertBrainEntry(db, {
        id: 'entry1',
        repoId: 'repo1',
        projectId: 'proj1',
        pointerPath: '/test/docs/brain/entry1.md',
        artifactPath: '/test/docs/spec.md',
        type: 'spec',
        subject: 'Updated Subject',
        status: 'active',
        createdAt: '2023-01-01T00:00:00Z',
        note: 'Updated note'
      })

      const result = getBrainEntryById(db, 'entry1')
      expect(result?.subject).toBe('Updated Subject')
      expect(result?.note).toBe('Updated note')
    })
  })

  describe('updateBrainEntryStatus', () => {
    test('should update entry status', () => {
      upsertBrainEntry(db, {
        id: 'entry1',
        repoId: 'repo1',
        projectId: 'proj1',
        pointerPath: '/test/docs/brain/entry1.md',
        artifactPath: '/test/docs/spec.md',
        type: 'spec',
        subject: 'Test Entry',
        status: 'draft',
        createdAt: '2023-01-01T00:00:00Z'
      })

      updateBrainEntryStatus(db, 'entry1', 'active')

      const result = getBrainEntryById(db, 'entry1')
      expect(result?.status).toBe('active')
    })
  })

  describe('deleteBrainEntry', () => {
    test('should delete brain entry', () => {
      upsertBrainEntry(db, {
        id: 'entry1',
        repoId: 'repo1',
        projectId: 'proj1',
        pointerPath: '/test/docs/brain/entry1.md',
        artifactPath: '/test/docs/spec.md',
        type: 'spec',
        subject: 'Test Entry',
        status: 'draft',
        createdAt: '2023-01-01T00:00:00Z'
      })

      deleteBrainEntry(db, 'entry1')

      const result = getBrainEntryById(db, 'entry1')
      expect(result).toBeNull()
    })
  })

  describe('getBrainTimeline', () => {
    test('should return brain events from entries', () => {
      upsertBrainEntry(db, {
        id: 'entry1',
        repoId: 'repo1',
        projectId: 'proj1',
        pointerPath: '/test/docs/brain/entry1.md',
        artifactPath: '/test/docs/spec.md',
        type: 'spec',
        subject: 'Test Entry',
        status: 'active',
        createdAt: '2023-01-01T10:00:00Z',
        note: 'Test note'
      })

      const result = getBrainTimeline(db, 'repo1')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'entry1',
        repoId: 'repo1',
        type: 'brain',
        subject: 'Test Entry',
        icon: 'brain'
      })
    })
  })

  describe('createTaskFromBrainEntry', () => {
    test('should create task linked to brain entry', () => {
      upsertBrainEntry(db, {
        id: 'entry1',
        repoId: 'repo1',
        projectId: 'proj1',
        pointerPath: '/test/docs/brain/entry1.md',
        artifactPath: '/test/docs/spec.md',
        type: 'spec',
        subject: 'Test Entry',
        status: 'active',
        createdAt: '2023-01-01T00:00:00Z'
      })

      const taskId = createTaskFromBrainEntry(db, 'entry1', 'Test Task', 'Task description')
      expect(taskId).toBeDefined()

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
      expect(task).toBeDefined()
      expect(task.brain_entry_id).toBe('entry1')
      expect(task.subject).toBe('Test Task')
      expect(task.description).toBe('Task description')
    })
  })

  describe('computed status fields', () => {
    test('upsertBrainEntry stores and retrieves computed_status', () => {
      upsertBrainEntry(db, {
        id: 'cs1',
        repoId: 'repo1',
        pointerPath: '/test/cs1.md',
        artifactPath: '/test/cs1.md',
        type: 'spec',
        subject: 'Computed Status Test',
        status: 'active',
        createdAt: '2026-01-01',
        computedStatus: 'done',
        checklistTotal: 4,
        checklistDone: 4,
        gitSignal: 1,
      })

      const entries = getBrainEntries(db)
      expect(entries).toHaveLength(1)
      expect(entries[0].computedStatus).toBe('done')
      expect(entries[0].checklistTotal).toBe(4)
      expect(entries[0].checklistDone).toBe(4)
      expect(entries[0].gitSignal).toBe(true)
    })

    test('upsertBrainEntry defaults computedStatus to remaining when not provided', () => {
      upsertBrainEntry(db, {
        id: 'cs2',
        repoId: 'repo1',
        pointerPath: '/test/cs2.md',
        artifactPath: '/test/cs2.md',
        type: 'spec',
        subject: 'Default Status',
        status: 'active',
        createdAt: '2026-01-01',
      })

      const entries = getBrainEntries(db)
      expect(entries[0].computedStatus).toBe('remaining')
      expect(entries[0].checklistTotal).toBe(0)
      expect(entries[0].checklistDone).toBe(0)
      expect(entries[0].gitSignal).toBe(false)
    })

    test('manual status is preserved on upsert (not overwritten)', () => {
      upsertBrainEntry(db, {
        id: 'cs3',
        repoId: 'repo1',
        pointerPath: '/test/cs3.md',
        artifactPath: '/test/cs3.md',
        type: 'spec',
        subject: 'Preserve Status',
        status: 'parked',
        createdAt: '2026-01-01',
      })

      // Second upsert passes status: 'active' — should NOT overwrite 'parked'
      upsertBrainEntry(db, {
        id: 'cs3',
        repoId: 'repo1',
        pointerPath: '/test/cs3.md',
        artifactPath: '/test/cs3.md',
        type: 'spec',
        subject: 'Preserve Status',
        status: 'active',
        createdAt: '2026-01-01',
        computedStatus: 'in_progress',
      })

      const entries = getBrainEntries(db)
      expect(entries[0].status).toBe('parked')           // manual untouched
      expect(entries[0].computedStatus).toBe('in_progress') // computed updated
    })
  })
})
