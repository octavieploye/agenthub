import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runMigrations } from '../db/migration-runner'
import { KanbanOrchestratorService, type OrchestratorDeps } from './kanban-orchestrator'
import { OrchestratorMonitorService } from './orchestrator-monitor'
import { OPERATING_RULES } from './orchestrator-rules'
import { getRun } from '../db/queries/orchestrator.queries'
import { insertTask } from '../db/queries/tasks.queries'
import { insertProject } from '../db/queries/projects.queries'
import { insertRepo } from '../db/queries/repos.queries'
import { linkRepoToProject } from '../db/queries/project-repos.queries'
import type { AgentState } from '../../shared/types/agent.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

let db: Database.Database
let tempDir: string
let activeServices: (KanbanOrchestratorService | OrchestratorMonitorService)[] = []

function track<T extends { stop: () => void }>(s: T): T {
  activeServices.push(s as never)
  return s
}

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: `agent-${Math.random().toString(36).slice(2, 8)}`,
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-5-20250514',
    provider: 'anthropic',
    effortLevel: 'high',
    taskDescription: 'test task',
    pid: null,
    ptyFd: null,
    cwd: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: 0,
    color: '#3B82F6',
    executionMode: 'native',
    voiceMode: 'off',
    telegramNotify: false,
    ...overrides
  }
}

function createDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  return {
    spawnAgent: vi.fn(() => createMockAgent()),
    getRepoPath: vi.fn(() => tempDir),
    gitStageAll: vi.fn(),
    gitCommit: vi.fn(() => 'abc123def456'),
    gitPush: vi.fn(),
    emitToRenderer: vi.fn(),
    sendTelegramNotification: vi.fn(),
    ...overrides
  }
}

function enableOrchestrator(): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('orchestrator.enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'"
  ).run()
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  tempDir = mkdtempSync(join(tmpdir(), 'orchestrator-e2e-'))
  const projectId = insertProject(db, { name: 'e2e-project' }).id
  const repoId = insertRepo(db, { name: 'e2e-repo', path: tempDir }).id
  linkRepoToProject(db, projectId, repoId)
  enableOrchestrator()
})

afterEach(() => {
  for (const s of activeServices) s.stop()
  activeServices = []
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('Orchestrator E2E — scoping + caps + monitor', () => {
  it('scopes a run to its taskIds, enforces the agent cap, and the monitor independently pauses', () => {
    const deps = createDeps()
    const orchestrator = track(new KanbanOrchestratorService(db, deps))
    const monitor = track(
      new OrchestratorMonitorService(db, {
        pause: (runId) => orchestrator.pause(runId),
        sendTelegramNotification: deps.sendTelegramNotification,
        getRunTokenUsage: () => 0,
      })
    )

    // Two sprint tasks + one out-of-scope task in the same repo
    const sprintTaskA = insertTask(db, { repoId: 'repo-1', title: 'Sprint A', status: 'backlog' })
    const sprintTaskB = insertTask(db, { repoId: 'repo-1', title: 'Sprint B', status: 'backlog' })
    insertTask(db, { repoId: 'repo-1', title: 'Out of scope', status: 'backlog' })

    const run = orchestrator.start({
      sprintName: 'e2e-sprint',
      repoId: 'repo-1',
      taskIds: [sprintTaskA.id, sprintTaskB.id],
      confirmed: true,
    })

    // Scoping: the run only carries the two sprint task IDs
    expect(getRun(db, run.id)!.taskIds).toEqual([sprintTaskA.id, sprintTaskB.id])

    // Caps: dispatching up to maxAgents is allowed, the next one auto-pauses
    for (let i = 0; i < OPERATING_RULES.limits.maxAgents; i++) {
      const task = insertTask(db, { repoId: 'repo-1', title: `Cap ${i}`, status: 'backlog' })
      orchestrator.dispatchDevPhase(task.id, run)
    }
    expect(deps.spawnAgent).toHaveBeenCalledTimes(OPERATING_RULES.limits.maxAgents)

    const overflow = insertTask(db, { repoId: 'repo-1', title: 'Overflow', status: 'backlog' })
    expect(orchestrator.dispatchDevPhase(overflow.id, run)).toBeNull()
    expect(getRun(db, run.id)!.status).toBe('paused')

    // Monitor: independent safety net also pauses on a fresh breach
    orchestrator.resume(run.id)
    const past = new Date(
      Date.now() - OPERATING_RULES.limits.maxWallClockMs - 60_000
    ).toISOString()
    db.prepare('UPDATE orchestrator_runs SET started_at = ? WHERE id = ?').run(past, run.id)

    monitor.check()

    expect(getRun(db, run.id)!.status).toBe('paused')
    expect(deps.sendTelegramNotification).toHaveBeenCalled()
  })
})
