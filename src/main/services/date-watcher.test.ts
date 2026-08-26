import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runMigrations } from '../db/migration-runner'
import { DateWatcherService, type DateWatcherDeps } from './date-watcher'
import { checkOllamaHealthWithRetry } from './helpers/ollama-cloud-health'
import { insertProject } from '../db/queries/projects.queries'
import { insertRepo } from '../db/queries/repos.queries'
import { linkRepoToProject } from '../db/queries/project-repos.queries'
import { insertTask, getTaskById } from '../db/queries/tasks.queries'
import { insertRun, updateRunStatus, getUnacknowledgedRetryFailures } from '../db/queries/orchestrator.queries'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

vi.mock('./helpers/ollama-cloud-health', () => ({
  checkOllamaHealthWithRetry: vi.fn()
}))

const mockedHealth = vi.mocked(checkOllamaHealthWithRetry)

let db: Database.Database
let tempDir: string
let activeWatchers: DateWatcherService[] = []
let projectId: string
let repoId: string

function trackWatcher(w: DateWatcherService): DateWatcherService {
  activeWatchers.push(w)
  return w
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function createDeps(overrides: Partial<DateWatcherDeps> = {}): DateWatcherDeps {
  return {
    startOrchestratorRun: vi.fn(),
    sendTelegramNotification: vi.fn(),
    onEventInserted: vi.fn(),
    getOllamaBaseUrl: () => 'http://localhost:11434',
    ...overrides
  }
}

function insertDateTask(overrides: Partial<Parameters<typeof insertTask>[1]> = {}): string {
  const task = insertTask(db, {
    repoId,
    title: 'date-task',
    status: 'backlog',
    category: 'marketing',
    projectId,
    sectionTargetDate: today(),
    requiresApproval: false,
    ...overrides
  })
  return task.id
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  // S74: DateWatcher.poll() now checks isOrchestratorEnabled — enable it for tests
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('orchestrator.enabled', 'true')
  tempDir = mkdtempSync(join(tmpdir(), 'date-watcher-'))
  projectId = insertProject(db, { name: 'test-project' }).id
  repoId = insertRepo(db, { name: 'test-repo', path: tempDir }).id
  linkRepoToProject(db, projectId, repoId)
  mockedHealth.mockReset()
  mockedHealth.mockResolvedValue({ available: true, attempts: 1, lastError: null, diagnostics: null })
})

afterEach(() => {
  for (const w of activeWatchers) w.stop()
  activeWatchers = []
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('DateWatcherService — auto-dispatch matrix', () => {
  it('auto-dispatches an unsupervised, no-approval task with today target date', async () => {
    const deps = createDeps()
    const watcher = trackWatcher(new DateWatcherService(db, deps))
    const taskId = insertDateTask({ category: 'marketing', requiresApproval: false })

    watcher.poll()
    await vi.waitFor(() => {
      expect(deps.startOrchestratorRun).toHaveBeenCalledTimes(1)
    })

    const call = vi.mocked(deps.startOrchestratorRun).mock.calls[0][0]
    expect(call.taskIds).toContain(taskId)
    expect(call.triggerSource).toBe('date-watcher')
    // S73: DateWatcher no longer hardcodes confirmed:true — authorization is via triggerSource
    expect(call.confirmed).toBe(false)
    expect(getTaskById(db, taskId)!.status).toBe('today')
  })

  it('promotes a supervised-category task to today but never dispatches', async () => {
    const deps = createDeps()
    const watcher = trackWatcher(new DateWatcherService(db, deps))
    const taskId = insertDateTask({ category: 'backend' })

    watcher.poll()
    await vi.waitFor(() => {
      expect(getTaskById(db, taskId)!.status).toBe('today')
    })

    expect(deps.startOrchestratorRun).not.toHaveBeenCalled()
  })

  it('promotes a requiresApproval task to today but never dispatches', async () => {
    const deps = createDeps()
    const watcher = trackWatcher(new DateWatcherService(db, deps))
    const taskId = insertDateTask({ category: 'marketing', requiresApproval: true })

    watcher.poll()
    await vi.waitFor(() => {
      expect(getTaskById(db, taskId)!.status).toBe('today')
    })

    expect(deps.startOrchestratorRun).not.toHaveBeenCalled()
  })

  it('skips an already-fired task (date_trigger_fired_at === today)', async () => {
    const deps = createDeps()
    const watcher = trackWatcher(new DateWatcherService(db, deps))
    const taskId = insertDateTask()
    db.prepare('UPDATE tasks SET date_trigger_fired_at = ? WHERE id = ?').run(today(), taskId)

    watcher.poll()
    await new Promise((r) => setTimeout(r, 0))

    expect(deps.startOrchestratorRun).not.toHaveBeenCalled()
    expect(getTaskById(db, taskId)!.status).toBe('backlog')
  })

  it('skips a stale task outside the [yesterday, today] window', async () => {
    const deps = createDeps()
    const watcher = trackWatcher(new DateWatcherService(db, deps))
    const stale = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
    insertDateTask({ sectionTargetDate: stale })

    watcher.poll()
    await new Promise((r) => setTimeout(r, 0))

    expect(deps.startOrchestratorRun).not.toHaveBeenCalled()
  })

  it('promotes but does not dispatch when the orchestrator is busy', async () => {
    const deps = createDeps()
    const watcher = trackWatcher(new DateWatcherService(db, deps))
    const taskId = insertDateTask()
    const run = insertRun(db, { sprintName: 'busy-run', repoId })
    updateRunStatus(db, run.id, 'running')

    watcher.poll()
    await vi.waitFor(() => {
      expect(getTaskById(db, taskId)!.status).toBe('today')
    })

    expect(deps.startOrchestratorRun).not.toHaveBeenCalled()
  })

  it('moves tasks to backlog and records a retry failure when ollama is unhealthy', async () => {
    mockedHealth.mockResolvedValue({
      available: false,
      attempts: 2,
      lastError: 'connection refused',
      diagnostics: 'GET /api/tags failed'
    })
    const deps = createDeps()
    const watcher = trackWatcher(new DateWatcherService(db, deps))
    const taskId = insertDateTask()

    watcher.poll()
    await vi.waitFor(() => {
      expect(getTaskById(db, taskId)!.status).toBe('backlog')
    })

    expect(deps.startOrchestratorRun).not.toHaveBeenCalled()
    const failures = getUnacknowledgedRetryFailures(db)
    expect(failures.some((f) => f.taskId === taskId && f.provider === 'ollama-cloud')).toBe(true)
  })
})
