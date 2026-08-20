import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { KanbanOrchestratorService } from './kanban-orchestrator'
import { getRun, insertTaskLog } from '../db/queries/orchestrator.queries'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskDependency } from '../db/queries/task-dependencies.queries'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  // Create a repo for FK constraints
  db.prepare("INSERT INTO repos (id, name, path, created_at, last_used_at) VALUES ('repo-1', 'test', '/tmp/test', datetime('now'), datetime('now'))").run()
})

afterEach(() => {
  db.close()
})

describe('KanbanOrchestratorService', () => {
  it('start creates a run and sets it to running', () => {
    const service = new KanbanOrchestratorService(db)
    const run = service.start({
      sprintName: 'R7-A',
      repoId: 'repo-1',
      concurrencyCap: 3,
      telegramNotify: false
    })

    expect(run.status).toBe('running')
    expect(run.sprintName).toBe('R7-A')
    expect(run.startedAt).toBeTruthy()
  })

  it('start throws if a run is already running', () => {
    const service = new KanbanOrchestratorService(db)
    service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    expect(() =>
      service.start({ sprintName: 'R7-B', repoId: 'repo-1' })
    ).toThrow(/already running/i)
  })

  it('pause sets status to paused', () => {
    const service = new KanbanOrchestratorService(db)
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    service.pause(run.id)
    const updated = getRun(db, run.id)
    expect(updated?.status).toBe('paused')
  })

  it('resume sets status back to running', () => {
    const service = new KanbanOrchestratorService(db)
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    service.pause(run.id)
    service.resume(run.id)
    const updated = getRun(db, run.id)
    expect(updated?.status).toBe('running')
  })

  it('getStatus returns null when no active run', () => {
    const service = new KanbanOrchestratorService(db)
    const status = service.getStatus()
    expect(status.run).toBeNull()
    expect(status.completedCount).toBe(0)
  })

  it('getStatus returns active run info', () => {
    const service = new KanbanOrchestratorService(db)
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    const status = service.getStatus()
    expect(status.run?.id).toBe(run.id)
  })

  it('getTaskLog returns logs for a task', () => {
    const service = new KanbanOrchestratorService(db)
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1' })
    const task = insertTask(db, { repoId: 'repo-1', title: 'Test task', status: 'backlog' })
    insertTaskLog(db, { runId: run.id, taskId: task.id, phase: 'dev' })
    const logs = service.getTaskLog(task.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].phase).toBe('dev')
  })

  it('getNextDispatchableTasks returns unblocked tasks by priority', () => {
    const service = new KanbanOrchestratorService(db)
    const run = service.start({ sprintName: 'R7-A', repoId: 'repo-1', concurrencyCap: 2 })
    const t1 = insertTask(db, { repoId: 'repo-1', title: 'Task 1', priority: 1, status: 'backlog' })
    const t2 = insertTask(db, { repoId: 'repo-1', title: 'Task 2', priority: 2, status: 'backlog' })
    // t3 depends on t1 — insert dependency manually
    const t3 = insertTask(db, { repoId: 'repo-1', title: 'Task 3', priority: 1, status: 'backlog' })
    insertTaskDependency(db, t3.id, t1.id)

    const dispatchable = service.getNextDispatchableTasks(run.id)
    const ids = dispatchable.map(t => t.id)
    // t3 blocked by t1, so only t1 and t2
    expect(ids).toContain(t1.id)
    expect(ids).toContain(t2.id)
    expect(ids).not.toContain(t3.id)
  })
})
