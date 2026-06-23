import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { SprintWatcher } from './sprint-watcher'
import type { SprintPendingPayload, SprintDraftReadyPayload, SprintIntakePayload } from '../../shared/types/task.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

let intakeDir: string
let db: Database.Database
let emitted: { channel: string; payload: unknown }[]
let watcher: SprintWatcher

function mockEmit(channel: string, payload: unknown): void {
  emitted.push({ channel, payload })
}

beforeEach(() => {
  intakeDir = join(tmpdir(), `sprint-watcher-test-${Date.now()}`)
  mkdirSync(intakeDir, { recursive: true })
  db = new Database(':memory:')
  runMigrations(db)
  db.prepare("INSERT INTO repos (id, name, path, created_at) VALUES ('r1', 'repo', '/tmp', datetime('now'))").run()
  emitted = []
  watcher = new SprintWatcher()
})

afterEach(() => {
  watcher.stop()
  db.close()
  rmSync(intakeDir, { recursive: true, force: true })
})

describe('SprintWatcher.startupScan', () => {
  it('emits DRAFT_READY for each .draft.json file found', () => {
    writeFileSync(join(intakeDir, 'sprint-proj-abc.draft.json'), '{}', 'utf-8')
    writeFileSync(join(intakeDir, 'sprint-proj-xyz.draft.json'), '{}', 'utf-8')
    writeFileSync(join(intakeDir, 'sprint-ignore.json'), '{}', 'utf-8') // not a draft, should not emit

    watcher.startupScan(intakeDir, mockEmit)

    const draftEmits = emitted.filter((e) => e.channel === 'on-kanban:draft-ready')
    expect(draftEmits).toHaveLength(2)
    const projectIds = draftEmits.map((e) => (e.payload as SprintDraftReadyPayload).projectId)
    expect(projectIds).toContain('proj-abc')
    expect(projectIds).toContain('proj-xyz')
  })

  it('emits nothing when intake dir has no draft files', () => {
    watcher.startupScan(intakeDir, mockEmit)
    expect(emitted).toHaveLength(0)
  })
})

describe('SprintWatcher.parseAndStage', () => {
  it('stages a valid sprint JSON and emits SPRINT_PENDING', () => {
    const payload: SprintIntakePayload = {
      sprintName: 'Sprint 1',
      repoId: 'r1',
      epics: [
        {
          name: 'Auth',
          tasks: [
            { localId: 't1', title: 'JWT helpers', description: 'write helpers', priority: 1 },
            { localId: 't2', title: 'Protect routes', description: 'middleware', priority: 2, dependsOn: ['t1'] }
          ]
        }
      ]
    }
    const filename = 'sprint-proj-abc.json'
    writeFileSync(join(intakeDir, filename), JSON.stringify(payload), 'utf-8')

    watcher.parseAndStage(filename, intakeDir, mockEmit)

    expect(emitted).toHaveLength(1)
    expect(emitted[0].channel).toBe('on-kanban:sprint-pending')
    const p = emitted[0].payload as SprintPendingPayload
    expect(p.sprintName).toBe('Sprint 1')
    expect(p.taskCount).toBe(2)
    expect(p.dependencyCount).toBe(1)
    expect(p.epicCount).toBe(1)
  })

  it('ignores .draft.json files in parseAndStage', () => {
    writeFileSync(join(intakeDir, 'sprint-proj.draft.json'), '{}', 'utf-8')
    // parseAndStage should not be called by the watcher for .draft.json files
    // but if called directly it just returns null silently — test the real guard
    const result = watcher.parseAndStage('sprint-proj.draft.json', intakeDir, mockEmit)
    expect(result).toBeNull()
    expect(emitted).toHaveLength(0)
  })
})

describe('SprintWatcher.confirmDraft', () => {
  it('renames .draft.json to .json and the renamed file exists', () => {
    const projectId = 'proj-abc'
    const draftPath = join(intakeDir, `sprint-${projectId}.draft.json`)
    const finalPath = join(intakeDir, `sprint-${projectId}.json`)
    writeFileSync(draftPath, JSON.stringify({ sprintName: 'S1', repoId: 'r1', epics: [] }), 'utf-8')

    watcher.confirmDraft(projectId, intakeDir)

    expect(existsSync(draftPath)).toBe(false)
    expect(existsSync(finalPath)).toBe(true)
  })
})

describe('SprintWatcher.confirm', () => {
  it('inserts tasks and dependencies, deletes the file', () => {
    const payload: SprintIntakePayload = {
      sprintName: 'Sprint 1',
      repoId: 'r1',
      epics: [
        {
          name: 'Auth',
          tasks: [
            { localId: 't1', title: 'JWT helpers', description: 'write helpers', priority: 1 },
            { localId: 't2', title: 'Protect routes', description: 'middleware', priority: 2, dependsOn: ['t1'] }
          ]
        }
      ]
    }
    const filePath = join(intakeDir, 'sprint-proj-abc.json')
    writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
    watcher.parseAndStage('sprint-proj-abc.json', intakeDir, mockEmit)

    const pendingId = (emitted[0].payload as SprintPendingPayload).pendingId
    watcher.confirm(db, pendingId, mockEmit)

    const tasks = db.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[]
    expect(tasks).toHaveLength(2)
    const deps = db.prepare('SELECT * FROM task_dependencies').all()
    expect(deps).toHaveLength(1)
    expect(existsSync(filePath)).toBe(false)
  })
})

describe('SprintWatcher.reject', () => {
  it('deletes the file without inserting tasks', () => {
    const payload: SprintIntakePayload = {
      sprintName: 'Sprint 1',
      repoId: 'r1',
      epics: [{ name: 'Auth', tasks: [{ localId: 't1', title: 'T', description: '', priority: 3 }] }]
    }
    const filePath = join(intakeDir, 'sprint-rej.json')
    writeFileSync(filePath, JSON.stringify(payload), 'utf-8')
    watcher.parseAndStage('sprint-rej.json', intakeDir, mockEmit)

    const pendingId = (emitted[0].payload as SprintPendingPayload).pendingId
    watcher.reject(pendingId)

    expect(db.prepare('SELECT * FROM tasks').all()).toHaveLength(0)
    expect(existsSync(filePath)).toBe(false)
  })
})
