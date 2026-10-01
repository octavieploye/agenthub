// @vitest-environment node
// Incident 85a885df: a task archived after its run was cancelled kept agent_id; when the still-alive
// agent went busy, syncKanbanCard flipped the archived card back to in_progress and logged a
// CARD_TRANSITION. Contract for helpers/task-card-sync.ts:
//   isTaskStatusSealed(status)  — archived | completed | tested never change from an agent signal
//   syncAgentStatusToTask(db, agentId, newStatus) — moves the linked live task + logs its event;
//     returns { task, eventType } or null when there is nothing to move
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { getDb, closeDb, resetDb } from '../../db/connection'
import { insertRepo } from '../../db/queries/repos.queries'
import { insertAgent } from '../../db/queries/agents.queries'
import { insertTask, updateTask, getTaskById } from '../../db/queries/tasks.queries'
import { getEventsByTask } from '../../db/queries/task-events.queries'
import { isTaskStatusSealed, syncAgentStatusToTask } from './task-card-sync'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

describe('isTaskStatusSealed', () => {
  it.each(['archived', 'completed', 'tested'])('%s is sealed', (status) => {
    expect(isTaskStatusSealed(status)).toBe(true)
  })

  it.each(['backlog', 'today', 'in_progress', 'interrupted'])('%s is not sealed', (status) => {
    expect(isTaskStatusSealed(status)).toBe(false)
  })
})

describe('syncAgentStatusToTask', () => {
  let db: Database.Database
  let repoId: string
  let agentId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    repoId = insertRepo(db, { name: 'repo-a', path: '/tmp/repo-a' }).id
    agentId = insertAgent(db, { repoId, name: 'Agent', cwd: '/tmp/repo-a' }).id
  })

  afterEach(() => {
    closeDb()
  })

  it('INCIDENT: archived task with agent_id set stays archived when the agent goes busy, no event logged', () => {
    const task = insertTask(db, { repoId, title: 'Archived card' })
    updateTask(db, task.id, { agentId, status: 'archived' })

    const result = syncAgentStatusToTask(db, agentId, 'busy')

    expect(result).toBeNull()
    expect(getTaskById(db, task.id)?.status).toBe('archived')
    expect(getEventsByTask(db, task.id)).toHaveLength(0)
  })

  it('moves a live linked task to in_progress and logs a CARD_TRANSITION', () => {
    const task = insertTask(db, { repoId, title: 'Live card' })
    updateTask(db, task.id, { agentId, status: 'today' })

    const result = syncAgentStatusToTask(db, agentId, 'busy')

    expect(result?.task.id).toBe(task.id)
    expect(result?.eventType).toBe('CARD_TRANSITION')
    expect(getTaskById(db, task.id)?.status).toBe('in_progress')
    const events = getEventsByTask(db, task.id)
    expect(events).toHaveLength(1)
    expect(events[0].fromStatus).toBe('today')
    expect(events[0].toStatus).toBe('in_progress')
    expect(JSON.parse(events[0].payloadJson)).toMatchObject({ taskTitle: 'Live card', repoId })
  })

  it('returns CARD_COMPLETED without logging the event itself (caller emits it after the SBAR)', () => {
    const task = insertTask(db, { repoId, title: 'Finishing card' })
    updateTask(db, task.id, { agentId, status: 'in_progress' })

    const result = syncAgentStatusToTask(db, agentId, 'completed')

    expect(result?.eventType).toBe('CARD_COMPLETED')
    expect(getTaskById(db, task.id)?.status).toBe('completed')
    expect(getEventsByTask(db, task.id)).toHaveLength(0)
  })

  it('returns null for an agent status that has no kanban mapping', () => {
    const task = insertTask(db, { repoId, title: 'Card' })
    updateTask(db, task.id, { agentId, status: 'in_progress' })
    expect(syncAgentStatusToTask(db, agentId, 'idle')).toBeNull()
    expect(getTaskById(db, task.id)?.status).toBe('in_progress')
  })
})
