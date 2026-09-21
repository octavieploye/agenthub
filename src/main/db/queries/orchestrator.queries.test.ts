// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { insertRepo } from './repos.queries'
import { insertTask } from './tasks.queries'
import type { OrchestratorTriggerSource, OrchestratorStartInput, RetryFailure } from '../../../shared/types/orchestrator.types'
import {
  insertRun,
  getRun,
  getActiveRun,
  getActiveRuns,
  updateRunStatus,
  updateRunTimestamp,
  insertTaskLog,
  updateTaskLogStatus,
  updateTaskLogSummary,
  getTaskLogsByRun,
  getTaskLogsByTask,
  getActiveTaskLogs,
  getActiveTaskLogByAgentIdAnyRun,
  incrementAgentsSpawned,
  getAgentsSpawned,
  insertApproval,
  getApproval,
  getExpiredPendingApprovals,
  getPendingApprovalsForRun,
  updateApprovalStatus,
  extendApproval,
  markApprovalExpired,
  deleteApprovalsForRun,
  insertRetryFailure,
  getUnacknowledgedRetryFailures,
  acknowledgeRetryFailures,
  getFilesChangedForTask,
  wasFilesChangedReported,
  updateRunTelegramNotify,
} from './orchestrator.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => {
  db.close()
})

function seedRepo(): string {
  const repo = insertRepo(db, { name: 'test-repo', path: '/tmp/test-repo' })
  return repo.id
}

function seedTask(repoId: string): string {
  const task = insertTask(db, { repoId, title: 'Test task' })
  return task.id
}

describe('orchestrator.queries', () => {
  describe('insertRun', () => {
    it('creates and returns a run with defaults', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })

      expect(run.id).toBeDefined()
      expect(run.sprintName).toBe('R7-A')
      expect(run.repoId).toBe(repoId)
      expect(run.projectId).toBeNull()
      expect(run.status).toBe('idle')
      expect(run.concurrencyCap).toBe(3)
      expect(run.telegramNotify).toBe(false)
      expect(run.createdAt).toBeDefined()
      expect(run.updatedAt).toBeDefined()
      expect(run.startedAt).toBeNull()
      expect(run.completedAt).toBeNull()
    })

    it('creates a run with custom values', () => {
      const repoId = seedRepo()
      const run = insertRun(db, {
        sprintName: 'R7-B',
        repoId,
        projectId: 'proj-123',
        concurrencyCap: 5,
        telegramNotify: true
      })

      expect(run.sprintName).toBe('R7-B')
      expect(run.projectId).toBe('proj-123')
      expect(run.concurrencyCap).toBe(5)
      expect(run.telegramNotify).toBe(true)
    })

    it('persists startedBy and triggerSource and returns them via getRun', () => {
      const repoId = seedRepo()
      const run = insertRun(db, {
        sprintName: 'R7-A',
        repoId,
        startedBy: 'user',
        triggerSource: 'manual'
      })

      expect(run.startedBy).toBe('user')
      expect(run.triggerSource).toBe('manual')

      const found = getRun(db, run.id)
      expect(found).not.toBeNull()
      expect(found!.startedBy).toBe('user')
      expect(found!.triggerSource).toBe('manual')
    })

    it('defaults startedBy and triggerSource to null when not provided', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })

      expect(run.startedBy).toBeNull()
      expect(run.triggerSource).toBeNull()
    })

    it('rejects an invalid triggerSource value (CHECK constraint)', () => {
      const repoId = seedRepo()
      expect(() =>
        insertRun(db, {
          sprintName: 'R7-A',
          repoId,
          triggerSource: 'invalid-source' as OrchestratorTriggerSource
        })
      ).toThrow()
    })

    it('accepts an explicit initial status', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'queued-sprint', repoId, status: 'queued' })

      expect(run.status).toBe('queued')

      const found = getRun(db, run.id)
      expect(found).not.toBeNull()
      expect(found!.status).toBe('queued')
    })

    it('defaults status to idle when not provided', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'default-status', repoId })

      expect(run.status).toBe('idle')
    })
  })

  describe('getRun', () => {
    it('returns the run by id', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const found = getRun(db, run.id)

      expect(found).not.toBeNull()
      expect(found!.id).toBe(run.id)
      expect(found!.sprintName).toBe('R7-A')
    })

    it('returns null for non-existent id', () => {
      expect(getRun(db, 'nonexistent-id')).toBeNull()
    })
  })

  describe('getActiveRun', () => {
    it('returns null when no running run exists', () => {
      const repoId = seedRepo()
      insertRun(db, { sprintName: 'R7-A', repoId })
      expect(getActiveRun(db)).toBeNull()
    })

    it('returns the running run', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      updateRunStatus(db, run.id, 'running')

      const active = getActiveRun(db)
      expect(active).not.toBeNull()
      expect(active!.id).toBe(run.id)
      expect(active!.status).toBe('running')
    })
  })

  describe('getActiveRuns', () => {
    it('returns empty array when no active runs exist', () => {
      const repoId = seedRepo()
      insertRun(db, { sprintName: 'idle-run', repoId })
      expect(getActiveRuns(db)).toEqual([])
    })

    it('returns all running and paused runs', () => {
      const repoId = seedRepo()
      const run1 = insertRun(db, { sprintName: 'run-1', repoId })
      const run2 = insertRun(db, { sprintName: 'run-2', repoId })
      const run3 = insertRun(db, { sprintName: 'run-3', repoId })
      updateRunStatus(db, run1.id, 'running')
      updateRunStatus(db, run2.id, 'running')
      updateRunStatus(db, run2.id, 'paused')
      updateRunStatus(db, run3.id, 'running')
      updateRunStatus(db, run3.id, 'completed')

      const active = getActiveRuns(db)
      expect(active).toHaveLength(2)
      const ids = active.map(r => r.id)
      expect(ids).toContain(run1.id)
      expect(ids).toContain(run2.id)
      expect(ids).not.toContain(run3.id)
    })

    it('excludes queued, idle, failed, and cancelled runs', () => {
      const repoId = seedRepo()
      insertRun(db, { sprintName: 'queued', repoId, status: 'queued' })
      insertRun(db, { sprintName: 'idle', repoId })
      const failed = insertRun(db, { sprintName: 'failed', repoId })
      updateRunStatus(db, failed.id, 'running')
      updateRunStatus(db, failed.id, 'failed')

      expect(getActiveRuns(db)).toEqual([])
    })
  })

  describe('updateRunStatus', () => {
    it('sets started_at when transitioning to running', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      expect(run.startedAt).toBeNull()

      updateRunStatus(db, run.id, 'running')
      const updated = getRun(db, run.id)

      expect(updated!.status).toBe('running')
      expect(updated!.startedAt).not.toBeNull()
      expect(updated!.completedAt).toBeNull()
    })

    it('sets completed_at when transitioning to completed', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      updateRunStatus(db, run.id, 'running')
      updateRunStatus(db, run.id, 'completed')

      const updated = getRun(db, run.id)
      expect(updated!.status).toBe('completed')
      expect(updated!.completedAt).not.toBeNull()
    })

    it('sets completed_at when transitioning to failed', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      updateRunStatus(db, run.id, 'running')
      updateRunStatus(db, run.id, 'failed')

      const updated = getRun(db, run.id)
      expect(updated!.status).toBe('failed')
      expect(updated!.completedAt).not.toBeNull()
    })

    it('does not overwrite started_at on subsequent status changes', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      updateRunStatus(db, run.id, 'running')
      const afterRunning = getRun(db, run.id)
      const originalStartedAt = afterRunning!.startedAt

      updateRunStatus(db, run.id, 'paused')
      const afterPaused = getRun(db, run.id)
      expect(afterPaused!.status).toBe('paused')
      expect(afterPaused!.startedAt).toBe(originalStartedAt)
    })

    it('updates updated_at on every status change', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })

      updateRunStatus(db, run.id, 'running')
      const updated = getRun(db, run.id)
      expect(updated!.updatedAt).toBeDefined()
      expect(updated!.startedAt).toBeTruthy()
    })
  })

  describe('updateRunTimestamp', () => {
    it('updates updated_at to now', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })

      updateRunTimestamp(db, run.id)
      const updated = getRun(db, run.id)
      expect(updated!.updatedAt).toBeDefined()
    })
  })

  describe('insertTaskLog', () => {
    it('creates and returns a task log with defaults', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)

      const log = insertTaskLog(db, {
        runId: run.id,
        taskId,
        phase: 'dev'
      })

      expect(log.id).toBeDefined()
      expect(log.runId).toBe(run.id)
      expect(log.taskId).toBe(taskId)
      expect(log.phase).toBe('dev')
      expect(log.status).toBe('pending')
      expect(log.agentId).toBeNull()
      expect(log.modelUsed).toBeNull()
      expect(log.providerUsed).toBeNull()
      expect(log.summaryJson).toBeNull()
      expect(log.issuesJson).toBeNull()
      expect(log.createdAt).toBeDefined()
      expect(log.updatedAt).toBeDefined()
      expect(log.startedAt).toBeNull()
      expect(log.completedAt).toBeNull()
    })

    it('creates a task log with model and provider', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)

      const log = insertTaskLog(db, {
        runId: run.id,
        taskId,
        phase: 'review',
        modelUsed: 'claude-sonnet-4-6',
        providerUsed: 'anthropic'
      })

      expect(log.phase).toBe('review')
      expect(log.modelUsed).toBe('claude-sonnet-4-6')
      expect(log.providerUsed).toBe('anthropic')
    })
  })

  describe('updateTaskLogStatus', () => {
    it('sets started_at when transitioning to active', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })

      updateTaskLogStatus(db, taskLog.id, 'active', 'agent-001')
      const logs = getTaskLogsByRun(db, run.id)
      const updated = logs.find((l) => l.id === taskLog.id)!

      expect(updated.status).toBe('active')
      expect(updated.agentId).toBe('agent-001')
      expect(updated.startedAt).not.toBeNull()
      expect(updated.completedAt).toBeNull()
    })

    it('sets completed_at when transitioning to done', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })

      updateTaskLogStatus(db, taskLog.id, 'active', 'agent-001')
      updateTaskLogStatus(db, taskLog.id, 'done')
      const logs = getTaskLogsByRun(db, run.id)
      const updated = logs.find((l) => l.id === taskLog.id)!

      expect(updated.status).toBe('done')
      expect(updated.completedAt).not.toBeNull()
    })

    it('sets completed_at when transitioning to failed', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'security' })

      updateTaskLogStatus(db, taskLog.id, 'active')
      updateTaskLogStatus(db, taskLog.id, 'failed')
      const logs = getTaskLogsByRun(db, run.id)
      const updated = logs.find((l) => l.id === taskLog.id)!

      expect(updated.status).toBe('failed')
      expect(updated.completedAt).not.toBeNull()
    })

    it('sets completed_at when transitioning to skipped', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'push' })

      updateTaskLogStatus(db, taskLog.id, 'skipped')
      const logs = getTaskLogsByRun(db, run.id)
      const updated = logs.find((l) => l.id === taskLog.id)!

      expect(updated.status).toBe('skipped')
      expect(updated.completedAt).not.toBeNull()
    })

    it('does not set agentId when not provided', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })

      updateTaskLogStatus(db, taskLog.id, 'active')
      const logs = getTaskLogsByRun(db, run.id)
      const updated = logs.find((l) => l.id === taskLog.id)!

      expect(updated.status).toBe('active')
      expect(updated.agentId).toBeNull()
    })
  })

  describe('updateTaskLogSummary', () => {
    it('stores summary JSON correctly', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })

      const summary = JSON.stringify({ filesChanged: 3, linesAdded: 42 })
      updateTaskLogSummary(db, taskLog.id, summary)

      const logs = getTaskLogsByRun(db, run.id)
      const updated = logs.find((l) => l.id === taskLog.id)!
      expect(updated.summaryJson).toBe(summary)
      expect(updated.issuesJson).toBeNull()
    })

    it('stores both summary and issues JSON', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'review' })

      const summary = JSON.stringify({ approved: true })
      const issues = JSON.stringify([{ severity: 'low', description: 'Minor lint' }])
      updateTaskLogSummary(db, taskLog.id, summary, issues)

      const logs = getTaskLogsByRun(db, run.id)
      const updated = logs.find((l) => l.id === taskLog.id)!
      expect(updated.summaryJson).toBe(summary)
      expect(updated.issuesJson).toBe(issues)
    })
  })

  describe('getTaskLogsByRun', () => {
    it('returns all logs for a run', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId1 = seedTask(repoId)
      const taskId2 = insertTask(db, { repoId, title: 'Task 2' }).id

      insertTaskLog(db, { runId: run.id, taskId: taskId1, phase: 'dev' })
      insertTaskLog(db, { runId: run.id, taskId: taskId1, phase: 'review' })
      insertTaskLog(db, { runId: run.id, taskId: taskId2, phase: 'dev' })

      const logs = getTaskLogsByRun(db, run.id)
      expect(logs).toHaveLength(3)
    })

    it('returns empty array when no logs exist', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      expect(getTaskLogsByRun(db, run.id)).toEqual([])
    })

    it('does not return logs from other runs', () => {
      const repoId = seedRepo()
      const run1 = insertRun(db, { sprintName: 'R7-A', repoId })
      const run2 = insertRun(db, { sprintName: 'R7-B', repoId })
      const taskId = seedTask(repoId)

      insertTaskLog(db, { runId: run1.id, taskId, phase: 'dev' })
      insertTaskLog(db, { runId: run2.id, taskId, phase: 'dev' })

      const logs1 = getTaskLogsByRun(db, run1.id)
      expect(logs1).toHaveLength(1)
      expect(logs1[0].runId).toBe(run1.id)
    })
  })

  describe('getTaskLogsByTask', () => {
    it('returns all phase logs for a task', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)

      insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })
      insertTaskLog(db, { runId: run.id, taskId, phase: 'review' })
      insertTaskLog(db, { runId: run.id, taskId, phase: 'security' })

      const logs = getTaskLogsByTask(db, taskId)
      expect(logs).toHaveLength(3)
      expect(logs.every((l) => l.taskId === taskId)).toBe(true)
    })

    it('returns empty array when task has no logs', () => {
      const repoId = seedRepo()
      const taskId = seedTask(repoId)
      expect(getTaskLogsByTask(db, taskId)).toEqual([])
    })
  })

  describe('agentsSpawned', () => {
    it('new run has agentsSpawned: 0 by default', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'OLH-1-default', repoId })

      expect(run.agentsSpawned).toBe(0)

      const found = getRun(db, run.id)
      expect(found).not.toBeNull()
      expect(found!.agentsSpawned).toBe(0)
    })

    it('incrementAgentsSpawned increments from 0 to 1, then 1 to 2', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'OLH-1-increment', repoId })

      expect(getAgentsSpawned(db, run.id)).toBe(0)

      incrementAgentsSpawned(db, run.id)
      expect(getAgentsSpawned(db, run.id)).toBe(1)

      incrementAgentsSpawned(db, run.id)
      expect(getAgentsSpawned(db, run.id)).toBe(2)
    })

    it('getAgentsSpawned returns current count', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'OLH-1-get', repoId })

      incrementAgentsSpawned(db, run.id)
      incrementAgentsSpawned(db, run.id)
      incrementAgentsSpawned(db, run.id)

      expect(getAgentsSpawned(db, run.id)).toBe(3)
    })

    it('getAgentsSpawned is isolated per run', () => {
      const repoId = seedRepo()
      const run1 = insertRun(db, { sprintName: 'OLH-1-iso-A', repoId })
      const run2 = insertRun(db, { sprintName: 'OLH-1-iso-B', repoId })

      incrementAgentsSpawned(db, run1.id)
      incrementAgentsSpawned(db, run1.id)

      expect(getAgentsSpawned(db, run1.id)).toBe(2)
      expect(getAgentsSpawned(db, run2.id)).toBe(0)
    })
  })

  describe('getActiveTaskLogs', () => {
    it('returns only active logs for a run', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId1 = seedTask(repoId)
      const taskId2 = insertTask(db, { repoId, title: 'Task 2' }).id

      const log1 = insertTaskLog(db, { runId: run.id, taskId: taskId1, phase: 'dev' })
      const log2 = insertTaskLog(db, { runId: run.id, taskId: taskId2, phase: 'dev' })
      insertTaskLog(db, { runId: run.id, taskId: taskId1, phase: 'review' })

      updateTaskLogStatus(db, log1.id, 'active', 'agent-001')
      updateTaskLogStatus(db, log2.id, 'active', 'agent-002')

      const activeLogs = getActiveTaskLogs(db, run.id)
      expect(activeLogs).toHaveLength(2)
      expect(activeLogs.every((l) => l.status === 'active')).toBe(true)
    })

    it('returns empty array when no active logs', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)
      insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })

      expect(getActiveTaskLogs(db, run.id)).toEqual([])
    })

    it('excludes done and failed logs', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R7-A', repoId })
      const taskId = seedTask(repoId)

      const log1 = insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })
      const log2 = insertTaskLog(db, { runId: run.id, taskId, phase: 'review' })
      const log3 = insertTaskLog(db, { runId: run.id, taskId, phase: 'security' })

      updateTaskLogStatus(db, log1.id, 'active')
      updateTaskLogStatus(db, log1.id, 'done')
      updateTaskLogStatus(db, log2.id, 'active')
      updateTaskLogStatus(db, log2.id, 'failed')
      updateTaskLogStatus(db, log3.id, 'active')

      const activeLogs = getActiveTaskLogs(db, run.id)
      expect(activeLogs).toHaveLength(1)
      expect(activeLogs[0].id).toBe(log3.id)
    })
  })

  describe('orchestrator approvals', () => {
    function seedApproval(windowMinutes = 30): { runId: string; taskId: string; approval: ReturnType<typeof insertApproval> } {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'APS-1', repoId })
      const taskId = seedTask(repoId)
      const approval = insertApproval(db, { runId: run.id, taskId, windowMinutes })
      return { runId: run.id, taskId, approval }
    }

    it('insertApproval creates a pending approval with the requested window', () => {
      const { approval, runId, taskId } = seedApproval(30)

      expect(approval.id).toBeDefined()
      expect(approval.runId).toBe(runId)
      expect(approval.taskId).toBe(taskId)
      expect(approval.status).toBe('pending')
      expect(approval.requestedAt).toBeDefined()
      expect(approval.expiresAt).toBeDefined()
      expect(approval.respondedAt).toBeNull()
      expect(approval.reminderCount).toBe(0)
    })

    it('insertApproval respects UNIQUE(run_id, task_id) and returns the existing row', () => {
      const { runId, taskId, approval: first } = seedApproval(30)

      const second = insertApproval(db, { runId, taskId, windowMinutes: 60 })

      expect(second.id).toBe(first.id)
      expect(second.expiresAt).toBe(first.expiresAt)
      expect(second.reminderCount).toBe(first.reminderCount)
    })

    it('getApproval returns null when absent', () => {
      expect(getApproval(db, 'no-run', 'no-task')).toBeNull()
    })

    it('getApproval returns the persisted row', () => {
      const { runId, taskId, approval } = seedApproval()

      const found = getApproval(db, runId, taskId)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(approval.id)
    })

    it('getExpiredPendingApprovals returns only pending rows past expiry', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'APS-1', repoId })
      const expired = insertApproval(db, { runId: run.id, taskId: seedTask(repoId), windowMinutes: 30 })
      // Force this approval into the past to simulate an elapsed window.
      db.prepare(
        "UPDATE orchestrator_approvals SET expires_at = datetime('now', '-1 minute') WHERE id = ?"
      ).run(expired.id)

      const fresh = insertApproval(db, { runId: run.id, taskId: seedTask(repoId), windowMinutes: 30 })

      const result = getExpiredPendingApprovals(db)
      const ids = result.map((r) => r.id)
      expect(ids).toContain(expired.id)
      expect(ids).not.toContain(fresh.id)
    })

    it('getExpiredPendingApprovals excludes non-pending rows even when expired', () => {
      const { approval } = seedApproval(30)
      db.prepare(
        "UPDATE orchestrator_approvals SET expires_at = datetime('now', '-1 minute') WHERE id = ?"
      ).run(approval.id)
      updateApprovalStatus(db, approval.runId, approval.taskId, 'approved')

      expect(getExpiredPendingApprovals(db)).toEqual([])
    })

    it('getPendingApprovalsForRun returns only pending approvals for the run', () => {
      const { runId, approval } = seedApproval()

      const result = getPendingApprovalsForRun(db, runId)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(approval.id)
    })

    it('updateApprovalStatus sets status and responded_at', () => {
      const { runId, taskId, approval } = seedApproval()
      expect(approval.respondedAt).toBeNull()

      updateApprovalStatus(db, runId, taskId, 'approved')

      const updated = getApproval(db, runId, taskId)!
      expect(updated.status).toBe('approved')
      expect(updated.respondedAt).not.toBeNull()
    })

    it('extendApproval increments reminder_count', () => {
      const { runId, taskId, approval } = seedApproval()
      expect(approval.reminderCount).toBe(0)

      extendApproval(db, approval.id, 30)

      const updated = getApproval(db, runId, taskId)!
      expect(updated.reminderCount).toBe(1)

      extendApproval(db, approval.id, 30)
      expect(getApproval(db, runId, taskId)!.reminderCount).toBe(2)
    })

    it('markApprovalExpired sets status to expired with responded_at', () => {
      const { runId, taskId, approval } = seedApproval()

      markApprovalExpired(db, approval.id)

      const updated = getApproval(db, runId, taskId)!
      expect(updated.status).toBe('expired')
      expect(updated.respondedAt).not.toBeNull()
    })

    it('deleteApprovalsForRun removes all approval rows for a run and returns the count', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'APS-cleanup', repoId })
      const taskId1 = seedTask(repoId)
      const taskId2 = seedTask(repoId)
      insertApproval(db, { runId: run.id, taskId: taskId1, windowMinutes: 30 })
      insertApproval(db, { runId: run.id, taskId: taskId2, windowMinutes: 30 })

      const deleted = deleteApprovalsForRun(db, run.id)

      expect(deleted).toBe(2)
      expect(getApproval(db, run.id, taskId1)).toBeNull()
      expect(getApproval(db, run.id, taskId2)).toBeNull()
    })

    it('deleteApprovalsForRun leaves approvals for other runs untouched', () => {
      const repoId = seedRepo()
      const run1 = insertRun(db, { sprintName: 'APS-cleanup-A', repoId })
      const run2 = insertRun(db, { sprintName: 'APS-cleanup-B', repoId })
      const taskId = seedTask(repoId)
      const approval1 = insertApproval(db, { runId: run1.id, taskId, windowMinutes: 30 })
      const approval2 = insertApproval(db, { runId: run2.id, taskId, windowMinutes: 30 })

      deleteApprovalsForRun(db, run1.id)

      expect(getApproval(db, run1.id, taskId)).toBeNull()
      expect(getApproval(db, run2.id, taskId)!.id).toBe(approval2.id)
      expect(getApproval(db, run2.id, taskId)!.id).not.toBe(approval1.id)
    })

    it('deleteApprovalsForRun returns 0 when the run has no approval rows', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'APS-cleanup-empty', repoId })

      expect(deleteApprovalsForRun(db, run.id)).toBe(0)
    })
  })

  describe('R-006: agentLifetimeCap in OrchestratorStartInput', () => {
    it('insertRun accepts and persists agentLifetimeCap from OrchestratorStartInput', () => {
      const repoId = seedRepo()
      const input: OrchestratorStartInput = {
        sprintName: 'alc-test',
        repoId,
        agentLifetimeCap: 12
      }
      const run = insertRun(db, input)
      expect(run.agentLifetimeCap).toBe(12)
      const found = getRun(db, run.id)
      expect(found!.agentLifetimeCap).toBe(12)
    })

    it('insertRun defaults agentLifetimeCap to 50 when omitted from OrchestratorStartInput', () => {
      const repoId = seedRepo()
      const input: OrchestratorStartInput = { sprintName: 'alc-default', repoId }
      const run = insertRun(db, input)
      expect(run.agentLifetimeCap).toBe(50)
    })
  })

  describe('R-003: getFilesChangedForTask / wasFilesChangedReported scoped by run_id', () => {
    it('getFilesChangedForTask returns files only for the specific run', () => {
      const repoId = seedRepo()
      const run1 = insertRun(db, { sprintName: 'R-003-A', repoId })
      const run2 = insertRun(db, { sprintName: 'R-003-B', repoId })
      const taskId = seedTask(repoId)

      const log1 = insertTaskLog(db, { runId: run1.id, taskId, phase: 'dev' })
      db.prepare('UPDATE orchestrator_task_log SET files_changed_json = ? WHERE id = ?').run(
        JSON.stringify(['src/a.ts']), log1.id
      )
      const log2 = insertTaskLog(db, { runId: run2.id, taskId, phase: 'dev' })
      db.prepare('UPDATE orchestrator_task_log SET files_changed_json = ? WHERE id = ?').run(
        JSON.stringify(['src/b.ts']), log2.id
      )

      expect(getFilesChangedForTask(db, run1.id, taskId)).toEqual(['src/a.ts'])
      expect(getFilesChangedForTask(db, run2.id, taskId)).toEqual(['src/b.ts'])
    })

    it('getFilesChangedForTask returns empty array when no dev log exists for that run', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R-003-empty', repoId })
      const taskId = seedTask(repoId)

      expect(getFilesChangedForTask(db, run.id, taskId)).toEqual([])
    })

    it('wasFilesChangedReported returns true only for the run that reported', () => {
      const repoId = seedRepo()
      const run1 = insertRun(db, { sprintName: 'R-003-C', repoId })
      const run2 = insertRun(db, { sprintName: 'R-003-D', repoId })
      const taskId = seedTask(repoId)

      const log1 = insertTaskLog(db, { runId: run1.id, taskId, phase: 'dev' })
      db.prepare('UPDATE orchestrator_task_log SET files_changed_json = ? WHERE id = ?').run(
        JSON.stringify([]), log1.id
      )

      expect(wasFilesChangedReported(db, run1.id, taskId)).toBe(true)
      expect(wasFilesChangedReported(db, run2.id, taskId)).toBe(false)
    })
  })

  describe('R-008: updateRunTelegramNotify', () => {
    it('sets telegram_notify to true in the database', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R-008-A', repoId, telegramNotify: false })
      expect(getRun(db, run.id)!.telegramNotify).toBe(false)

      updateRunTelegramNotify(db, run.id, true)

      expect(getRun(db, run.id)!.telegramNotify).toBe(true)
    })

    it('sets telegram_notify to false in the database', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'R-008-B', repoId, telegramNotify: true })
      expect(getRun(db, run.id)!.telegramNotify).toBe(true)

      updateRunTelegramNotify(db, run.id, false)

      expect(getRun(db, run.id)!.telegramNotify).toBe(false)
    })
  })

  describe('R-007: RetryFailure is the canonical type for retry failure rows', () => {
    it('getUnacknowledgedRetryFailures returns RetryFailure[] with correct shape', () => {
      const repoId = seedRepo()
      const taskId = seedTask(repoId)

      insertRetryFailure(db, {
        taskId,
        provider: 'anthropic',
        attempts: 3,
        lastError: 'Connection timeout',
        diagnostics: '{"code":"ECONNREFUSED"}'
      })

      const failures: RetryFailure[] = getUnacknowledgedRetryFailures(db)
      expect(failures).toHaveLength(1)
      expect(failures[0].taskId).toBe(taskId)
      expect(failures[0].provider).toBe('anthropic')
      expect(failures[0].attempts).toBe(3)
      expect(failures[0].lastError).toBe('Connection timeout')
      expect(failures[0].diagnostics).toBe('{"code":"ECONNREFUSED"}')
      expect(failures[0].createdAt).toBeDefined()
    })

    it('getUnacknowledgedRetryFailures excludes acknowledged failures', () => {
      const repoId = seedRepo()
      const taskId = seedTask(repoId)

      insertRetryFailure(db, { taskId, provider: 'anthropic', attempts: 1 })
      acknowledgeRetryFailures(db)

      const failures: RetryFailure[] = getUnacknowledgedRetryFailures(db)
      expect(failures).toHaveLength(0)
    })
  })

  describe('L-1: getActiveTaskLogByAgentIdAnyRun', () => {
    it('returns the most recently started active log for an agent', () => {
      const repoId = seedRepo()
      const run = insertRun(db, { sprintName: 'L-1-A', repoId })
      const taskId1 = seedTask(repoId)
      const taskId2 = seedTask(repoId)

      const log1 = insertTaskLog(db, { runId: run.id, taskId: taskId1, phase: 'dev' })
      const log2 = insertTaskLog(db, { runId: run.id, taskId: taskId2, phase: 'dev' })

      updateTaskLogStatus(db, log1.id, 'active', 'agent-001')
      updateTaskLogStatus(db, log2.id, 'active', 'agent-001')

      // Force distinct started_at so the latest-started log is unambiguous.
      db.prepare('UPDATE orchestrator_task_log SET started_at = ? WHERE id = ?').run('2026-01-01T00:00:00.000Z', log1.id)
      db.prepare('UPDATE orchestrator_task_log SET started_at = ? WHERE id = ?').run('2026-01-02T00:00:00.000Z', log2.id)

      const result = getActiveTaskLogByAgentIdAnyRun(db, 'agent-001')

      expect(result?.id).toBe(log2.id)
    })
  })
})
