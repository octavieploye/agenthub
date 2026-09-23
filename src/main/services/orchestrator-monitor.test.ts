// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { OrchestratorMonitorService, MONITOR_LIMITS } from './orchestrator-monitor'
import type { OrchestratorPhase } from '@shared/types/orchestrator.types'
import { OPERATING_RULES } from './orchestrator-rules'
import {
  insertRun,
  updateRunStatus,
  insertTaskLog,
  updateTaskLogStatus,
  getRun,
  insertApproval,
  getApproval
} from '../db/queries/orchestrator.queries'
import { insertTask, getTaskById } from '../db/queries/tasks.queries'
import { insertNotification, markExpired } from '../db/queries/telegram-notifications.queries'

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

function insertPhaseFailure(runId: string, taskId: string, phase: OrchestratorPhase): void {
  const log = insertTaskLog(db, { runId, taskId, phase })
  updateTaskLogStatus(db, log.id, 'failed')
}

function createExpiredApproval(runId: string, taskId: string, reminderCount: number): void {
  insertApproval(db, { runId, taskId, windowMinutes: 1 })
  db.prepare(
    `UPDATE orchestrator_approvals SET expires_at = datetime('now','-1 minute'), reminder_count = ? WHERE run_id = ? AND task_id = ?`
  ).run(reminderCount, runId, taskId)
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
  it('runs active-agent reconciliation on every healthy-run monitor pass', () => {
    const reconcileActiveAgents = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, {
        pause: vi.fn(),
        reconcileActiveAgents,
      })
    )
    createRunningRun()

    monitor.check()

    expect(reconcileActiveAgents).toHaveBeenCalledTimes(1)
  })

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

  it('detects stuck-loop in dev phase and pauses + alerts', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    // 3 dev phase failures for the same task = stuck loop
    for (let i = 0; i < MONITOR_LIMITS.stuckLoopThreshold; i++) {
      insertPhaseFailure(runId, 'task-1', 'dev')
    }

    monitor.check()

    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('stuck-loop')
  })

  it('detects stuck-loop in security phase and pauses + alerts', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    // 3 security phase failures for the same task = stuck loop
    for (let i = 0; i < MONITOR_LIMITS.stuckLoopThreshold; i++) {
      insertPhaseFailure(runId, 'task-1', 'security')
    }

    monitor.check()

    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('stuck-loop')
  })

  it('does not flag stuck-loop when same task fails in different phases below threshold', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    // 2 dev failures + 2 review failures for the same task (each phase below 3)
    for (let i = 0; i < 2; i++) {
      insertPhaseFailure(runId, 'task-1', 'dev')
      insertPhaseFailure(runId, 'task-1', 'review')
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

  it('includes extend command with run id in duration breach message', () => {
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

    const msg: string = sendTelegramNotification.mock.calls[0][0]
    expect(msg).toContain('extend')
    expect(msg).toContain(runId)
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

  // -------------------------------------------------------------------------
  // OLH-4: Global retry cap (total failed logs >= maxRunRetries)
  // -------------------------------------------------------------------------

  it('checkTotalRetries pauses when failed logs >= maxRunRetries', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    // Insert 30 failed task logs — each with a unique task ID so no
    // single task+phase combo hits the stuck-loop threshold of 3
    for (let i = 0; i < OPERATING_RULES.limits.maxRunRetries; i++) {
      insertPhaseFailure(runId, `task-cap-${i}`, 'dev')
    }

    monitor.check()

    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('global retry cap')
  })

  it('checkTotalRetries does not pause below threshold', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runId = createRunningRun()

    // Insert 29 failed task logs (one below threshold) — spread across many tasks
    for (let i = 0; i < OPERATING_RULES.limits.maxRunRetries - 1; i++) {
      insertPhaseFailure(runId, `task-${i}`, 'dev')
    }

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

  // -------------------------------------------------------------------------
  // APS-4: Approval-stall supervisor (A→C→B state machine)
  // -------------------------------------------------------------------------

  it('A: re-notifies and extends the window when approval expires at reminder_count=0', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const notifyApproval = vi.fn()
    const sendEscalation = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, notifyApproval, sendEscalation })
    )
    const runId = createRunningRun()
    const task = insertTask(db, { repoId: 'repo-1', title: 'Approve me' })
    createExpiredApproval(runId, task.id, 0)

    monitor.check()

    expect(notifyApproval).toHaveBeenCalledTimes(1)
    expect(notifyApproval).toHaveBeenCalledWith(`task:${task.id}:${runId}`, 'Approve me', 'repo-1', 'S6-run', '')
    expect(sendEscalation).not.toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
    const approval = getApproval(db, runId, task.id)!
    expect(approval.reminderCount).toBe(1)
    expect(approval.status).toBe('pending')
  })

  it('A again at reminder_count=1: re-notifies and bumps count to 2', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const notifyApproval = vi.fn()
    const sendEscalation = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, notifyApproval, sendEscalation })
    )
    const runId = createRunningRun()
    const task = insertTask(db, { repoId: 'repo-1', title: 'Approve me again' })
    createExpiredApproval(runId, task.id, 1)

    monitor.check()

    expect(notifyApproval).toHaveBeenCalledTimes(1)
    expect(sendEscalation).not.toHaveBeenCalled()
    const approval = getApproval(db, runId, task.id)!
    expect(approval.reminderCount).toBe(2)
    expect(approval.status).toBe('pending')
  })

  it('C: escalates via plain-text /approve at reminder_count=2 without resetting the task', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const notifyApproval = vi.fn()
    const sendEscalation = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, notifyApproval, sendEscalation })
    )
    const runId = createRunningRun()
    const task = insertTask(db, { repoId: 'repo-1', title: 'Escalate me', status: 'in_progress' })
    createExpiredApproval(runId, task.id, 2)

    monitor.check()

    expect(sendEscalation).toHaveBeenCalledTimes(1)
    expect(sendEscalation).toHaveBeenCalledWith(`task:${task.id}:${runId}`, 'Escalate me', 'repo-1', 'S6-run', '')
    expect(notifyApproval).not.toHaveBeenCalled()
    const approval = getApproval(db, runId, task.id)!
    expect(approval.reminderCount).toBe(3)
    expect(approval.status).toBe('pending')
    expect(getTaskById(db, task.id)!.status).toBe('in_progress')
  })

  it('B: resets task to backlog when approval expired and the task never ran', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const notifyApproval = vi.fn()
    const sendEscalation = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, notifyApproval, sendEscalation })
    )
    const runId = createRunningRun()
    const task = insertTask(db, { repoId: 'repo-1', title: 'Never ran', status: 'in_progress' })
    createExpiredApproval(runId, task.id, 3)

    monitor.check()

    expect(getApproval(db, runId, task.id)!.status).toBe('expired')
    expect(getTaskById(db, task.id)!.status).toBe('backlog')
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('backlog')
    expect(notifyApproval).not.toHaveBeenCalled()
    expect(sendEscalation).not.toHaveBeenCalled()
  })

  it('B: skips reset when the task already reported files_changed', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const notifyApproval = vi.fn()
    const sendEscalation = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, notifyApproval, sendEscalation })
    )
    const runId = createRunningRun()
    const task = insertTask(db, { repoId: 'repo-1', title: 'Already worked', status: 'in_progress' })
    const log = insertTaskLog(db, { runId, taskId: task.id, phase: 'dev' })
    db.prepare(`UPDATE orchestrator_task_log SET files_changed_json = ? WHERE id = ?`).run('[]', log.id)
    createExpiredApproval(runId, task.id, 3)

    monitor.check()

    expect(getApproval(db, runId, task.id)!.status).toBe('pending')
    expect(getTaskById(db, task.id)!.status).toBe('in_progress')
    expect(sendTelegramNotification).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // APS-5: Telegram delivery health check
  // -------------------------------------------------------------------------

  it('alerts once when notifications expired, throttled on immediate re-check', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    createRunningRun()
    const notifId = insertNotification(db, {
      type: 'completed',
      agentId: 'agent-1',
      agentName: 'Test Agent',
      repo: 'repo-1',
      summary: 'done',
      timestamp: new Date().toISOString(),
    })
    markExpired(db, notifId)

    monitor.check()

    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('Telegram delivery')

    monitor.check()

    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
  })

  it('enforces limits across ALL active runs (two running runs both breached)', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification })
    )
    const runIdA = createRunningRun('S6-run-A')
    const runIdB = createRunningRun('S6-run-B')

    // 3 review failures on a distinct task per run = stuck loop in each
    for (let i = 0; i < MONITOR_LIMITS.stuckLoopThreshold; i++) {
      insertReviewFailure(runIdA, 'task-a-1')
      insertReviewFailure(runIdB, 'task-b-1')
    }

    monitor.check()

    expect(pause).toHaveBeenCalledWith(runIdA)
    expect(pause).toHaveBeenCalledWith(runIdB)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(2)
  })

  it('R-004: pauses run (fail-safe) when getRunTokenUsage throws', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const getRunTokenUsage = vi.fn(() => { throw new Error('JSONL dir unreadable') })
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, getRunTokenUsage })
    )
    const runId = createRunningRun()

    // Must NOT crash — must pause the run fail-safe
    monitor.check()

    expect(getRunTokenUsage).toHaveBeenCalledWith(runId)
    expect(pause).toHaveBeenCalledWith(runId)
    expect(sendTelegramNotification).toHaveBeenCalledTimes(1)
    expect(sendTelegramNotification.mock.calls[0][0]).toContain('token')
  })

  it('does nothing when no approvals and no expired notifications', () => {
    const pause = vi.fn()
    const sendTelegramNotification = vi.fn()
    const notifyApproval = vi.fn()
    const sendEscalation = vi.fn()
    const monitor = trackMonitor(
      new OrchestratorMonitorService(db, { pause, sendTelegramNotification, notifyApproval, sendEscalation })
    )
    createRunningRun()

    monitor.check()

    expect(notifyApproval).not.toHaveBeenCalled()
    expect(sendEscalation).not.toHaveBeenCalled()
    expect(sendTelegramNotification).not.toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
  })
})
