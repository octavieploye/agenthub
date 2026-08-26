import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { insertRepo } from './repos.queries'
import { insertTask } from './tasks.queries'
import {
  insertRun,
  getRun,
  getActiveRun,
  updateRunStatus,
  updateRunTimestamp,
  insertTaskLog,
  updateTaskLogStatus,
  updateTaskLogSummary,
  getTaskLogsByRun,
  getTaskLogsByTask,
  getActiveTaskLogs
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
})
