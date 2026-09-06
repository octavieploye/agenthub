/**
 * TDD — files-changed-mcp-signal sprint
 * Tests for report_files_changed MCP tool and the updated B-2 dispatch path.
 * Failing tests MUST exist before T3+T4 implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ContextHandlerDeps } from '../../mcp-server/handlers/context-handlers'
import { handleReportFilesChanged } from '../../mcp-server/handlers/context-handlers'
import { getFilesChangedForTask } from '../../db/queries/orchestrator.queries'
import Database from 'better-sqlite3'
import { runMigrations } from '../../db/migration-runner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDeps(sendIpc: ContextHandlerDeps['sendIpc']): ContextHandlerDeps {
  return {
    sendIpc,
    agenthubPath: '/fake/agenthub',
    appVersion: '0.0.0',
    getRepos: () => [],
    getQuota: () => ({ used: 0, limit: 1000, percent: 0 }),
    getSafeguards: () => ({
      killSwitchActive: false,
      protectedPaths: [],
      supervisedCategories: [],
      requiresConfirmation: false
    }),
    getModelCatalog: () => []
  }
}

// ── Unit tests: handleReportFilesChanged — path validation ────────────────────

describe('handleReportFilesChanged() — path validation', () => {
  it('rejects absolute paths', async () => {
    const deps = makeDeps(vi.fn())
    await expect(
      handleReportFilesChanged({ taskId: 'task-1', files: ['/etc/passwd'] }, deps)
    ).rejects.toThrow(/absolute/)
  })

  it('rejects paths with ".." segments', async () => {
    const deps = makeDeps(vi.fn())
    await expect(
      handleReportFilesChanged({ taskId: 'task-1', files: ['src/../../../etc/passwd'] }, deps)
    ).rejects.toThrow(/\.\./)
  })

  it('rejects arrays with more than 100 files', async () => {
    const deps = makeDeps(vi.fn())
    const files = Array.from({ length: 101 }, (_, i) => `src/file${i}.ts`)
    await expect(
      handleReportFilesChanged({ taskId: 'task-1', files }, deps)
    ).rejects.toThrow(/100/)
  })

  it('rejects paths exceeding 260 chars', async () => {
    const deps = makeDeps(vi.fn())
    const longPath = 'src/' + 'a'.repeat(260)
    await expect(
      handleReportFilesChanged({ taskId: 'task-1', files: [longPath] }, deps)
    ).rejects.toThrow(/260/)
  })

  it('sends IPC for valid input', async () => {
    const sendIpc = vi.fn().mockResolvedValue({ type: 'success', data: { ok: true, count: 2 } })
    const deps = makeDeps(sendIpc)
    const result = await handleReportFilesChanged(
      { taskId: 'task-1', files: ['src/foo.ts', 'src/bar.ts'] },
      deps
    )
    expect(sendIpc).toHaveBeenCalledWith({
      type: 'report_files_changed',
      payload: { taskId: 'task-1', files: ['src/foo.ts', 'src/bar.ts'] }
    })
    expect(result).toEqual({ ok: true, count: 2 })
  })

  it('throws on IPC error response', async () => {
    const sendIpc = vi.fn().mockResolvedValue({ type: 'error', message: 'task not found' })
    const deps = makeDeps(sendIpc)
    await expect(
      handleReportFilesChanged({ taskId: 'bad-task', files: ['src/foo.ts'] }, deps)
    ).rejects.toThrow('task not found')
  })
})

// ── Integration: getFilesChangedForTask — DB read ─────────────────────────────

describe('getFilesChangedForTask()', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, __dirname + '/../../db/migrations')
    // Seed minimal records
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r1', 'test', '/tmp/test')").run()
    db.prepare(
      "INSERT INTO tasks (id, repo_id, title, status) VALUES ('t1', 'r1', 'Test', 'in_progress')"
    ).run()
    db.prepare(
      "INSERT INTO orchestrator_runs (id, sprint_name, repo_id, status, concurrency_cap, telegram_notify, created_at, updated_at) VALUES ('run1', 'sprint', 'r1', 'running', 3, 0, datetime('now'), datetime('now'))"
    ).run()
    db.prepare(
      "INSERT INTO orchestrator_task_log (id, run_id, task_id, phase, status, created_at, updated_at) VALUES ('log1', 'run1', 't1', 'dev', 'done', datetime('now'), datetime('now'))"
    ).run()
  })

  afterEach(() => { db.close() })

  it('returns empty array when files_changed_json is NULL', () => {
    expect(getFilesChangedForTask(db, 't1')).toEqual([])
  })

  it('returns parsed array when files_changed_json is set', () => {
    db.prepare(
      "UPDATE orchestrator_task_log SET files_changed_json = ? WHERE id = 'log1'"
    ).run(JSON.stringify(['src/foo.ts', 'src/bar.ts']))
    expect(getFilesChangedForTask(db, 't1')).toEqual(['src/foo.ts', 'src/bar.ts'])
  })

  it('returns empty array when task has no dev log', () => {
    expect(getFilesChangedForTask(db, 'nonexistent-task')).toEqual([])
  })

  it('returns empty array on malformed JSON', () => {
    db.prepare(
      "UPDATE orchestrator_task_log SET files_changed_json = ? WHERE id = 'log1'"
    ).run('not-valid-json')
    expect(getFilesChangedForTask(db, 't1')).toEqual([])
  })
})

// ── Integration: routeRequest DB contract — exercises the same SQL as mcp-server-manager.ts ──

describe('Path B-2 lifecycle — routeRequest DB contract', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db, __dirname + '/../../db/migrations')
    db.prepare("INSERT INTO repos (id, name, path) VALUES ('r2', 'repo', '/tmp/repo')").run()
    db.prepare(
      "INSERT INTO tasks (id, repo_id, title, status) VALUES ('t2', 'r2', 'B2 task', 'in_progress')"
    ).run()
    db.prepare(
      "INSERT INTO orchestrator_runs (id, sprint_name, repo_id, status, concurrency_cap, telegram_notify, created_at, updated_at) VALUES ('run2', 'sprint', 'r2', 'running', 3, 0, datetime('now'), datetime('now'))"
    ).run()
    db.prepare(
      "INSERT INTO orchestrator_task_log (id, run_id, task_id, phase, status, created_at, updated_at) VALUES ('log2', 'run2', 't2', 'dev', 'active', datetime('now'), datetime('now'))"
    ).run()
  })

  afterEach(() => { db.close() })

  it('B-2: routeRequest SQL writes files_changed_json → getFilesChangedForTask reads it back', () => {
    // Exercises the same UPDATE query as mcp-server-manager.ts routeRequest case 'report_files_changed'
    const files = ['src/foo.ts', 'src/bar.ts']
    const now = new Date().toISOString()
    const result = db.prepare(
      `UPDATE orchestrator_task_log
         SET files_changed_json = ?, updated_at = ?
       WHERE id = (
         SELECT id FROM orchestrator_task_log
         WHERE task_id = ? AND phase = 'dev'
         ORDER BY created_at DESC LIMIT 1
       )`
    ).run(JSON.stringify(files), now, 't2')
    expect(result.changes).toBe(1)
    expect(getFilesChangedForTask(db, 't2')).toEqual(['src/foo.ts', 'src/bar.ts'])
  })

  it('B-2: no report_files_changed call → files_changed_json is NULL → no-commit path returns []', () => {
    // Simulates agent completing without calling report_files_changed
    expect(getFilesChangedForTask(db, 't2')).toEqual([])
  })

  it('B-2: routeRequest returns changes=0 for unknown taskId → signals NO_DEV_LOG', () => {
    const now = new Date().toISOString()
    const result = db.prepare(
      `UPDATE orchestrator_task_log
         SET files_changed_json = ?, updated_at = ?
       WHERE id = (
         SELECT id FROM orchestrator_task_log
         WHERE task_id = ? AND phase = 'dev'
         ORDER BY created_at DESC LIMIT 1
       )`
    ).run(JSON.stringify(['src/foo.ts']), now, 'no-such-task')
    expect(result.changes).toBe(0)
  })
})
