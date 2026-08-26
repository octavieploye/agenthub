import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { OrchestratorMonitorService, MONITOR_LIMITS } from './orchestrator-monitor'
import { OPERATING_RULES } from './orchestrator-rules'
import {
  insertRun,
  updateRunStatus,
  insertTaskLog,
  updateTaskLogStatus,
  getRun
} from '../db/queries/orchestrator.queries'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

let db: Database.Database
let activeMonitors: OrchestratorMonitorService[] = []

function trackMonitor(monitor: OrchestratorMonitorService): OrchestratorMonitorService {
  activeMonitors.push(monitor)
  return monitor
}

function createRunningRun(sprintName = 'S6-run'): string {
  const run = insertRun(db, { sprintName, repoId: 'repo-1' })
  updateRunStatus(db, run.id, 'running')
  return run.id
}

function insertReviewFailure(runId: string, taskId: string): void {
  const log = insertTaskLog(db, { runId, taskId, phase: 'review' })
  updateTaskLogStatus(db, log.id, 'failed')
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  db.prepare(
    "INSERT INTO repos (id, name, path, created_at, last_used_at) VALUES ('repo-1', 'test', '/tmp/test', datetime('now'), datetime('now'))"
  ).run()
})

afterEach(() => {
  for (const m of activeMonitors) m.stop()
  activeMonitors = []
  db.close()
})

describe('OrchestratorMonitorService', () => {
  it('detects stuck-loop (dev→review→fail repeated) and pauses + alerts', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    // 3 review failures for the same task = stuck loop
    for (let i = 0; i < MONITOR_LIMITS.stuckLoopThreshold; i++) {
      insertReviewFailure(runId, 'task-1')
    }

    monitor.check()

    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('stuck-loop')
  })

  it('does not flag a stuck-loop below the threshold', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    for (let i = 0; i < MONITOR_LIMITS.stuckLoopThreshold - 1; i++) {
      insertReviewFailure(runId, 'task-1')
    }

    monitor.check()

    expect(pause).not.toHaveBeenCalled()
    expect(sendTelegramNotification).not.toHaveBeenCalled()
  })

  it('pauses when active task logs exceed max concurrent agents', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    for (let i = 0; i < OPERATING_RULES.limits.maxAgents + 1; i++) {
      const log = insertTaskLog(db, { runId, taskId: `task-${i}`, phase: 'dev' })
      updateTaskLogStatus(db, log.id, 'active')
    }

    monitor.check()

    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('concurrent')
  })

  it('pauses when run duration exceeds maxWallClockMs', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    const past = new Date(
      Date.now() - OPERATING_RULES.limits.maxWallClockMs - 60_000
    ).toISOString()
    db.prepare('UPDATE orchestrator_runs SET started_at = ? WHERE id = ?').run(past, runId)

    monitor.check()

    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('duration')
  })

  it('pauses when token usage exceeds the token cap', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const getRunTokenUsage = vi.fn(() => MONITOR_LIMITS.maxTokens + 1)
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, getRunTokenUsage })
    )
    const runId = createRunningRun()

    monitor.check()

    expect(getRunTokenUsage).toHaveBeenCalledWith(runId)
    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('token')
  })

  it('does nothing when there is no active run', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )

    monitor.check()

    expect(pause).not.toHaveBeenCalled()
    expect(sendTelegramNotification).not.toHaveBeenCalled()
  })

  it('does not pause a healthy run', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const getRunTokenUsage = vi.fn(() => 0)
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, getRunTokenUsage })
    )
    const runId = createRunningRun()

    // One active task (under the cap), no review failures, fresh start, zero tokens
    const log = insertTaskLog(db, { runId, taskId: 'task-1', phase: 'dev' })
    updateTaskLogStatus(db, log.id, 'active')

    monitor.check()

    expect(pause).not.toHaveBeenCalled()
    expect(sendTelegramNotification).not.toHaveBeenCalled()
    expect(getRun(db, runId)!.status).toBe('running')
  })
})
