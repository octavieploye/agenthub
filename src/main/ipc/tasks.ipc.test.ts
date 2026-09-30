// @vitest-environment node
// C-T1 (RED): manual kanban moves through tasks:update must record a task event with from/to (C-T3 wires ipc/tasks.ipc.ts:157).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'

// Electron boundary — the only mock (ipcMain needs a running Electron process).
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { getDb, closeDb, resetDb } from '../db/connection'
import { insertRepo } from '../db/queries/repos.queries'
import { insertTask } from '../db/queries/tasks.queries'
import { getEventsByTask } from '../db/queries/task-events.queries'
import { registerTasksHandlers } from './tasks.ipc'

function getHandler(channel: string): (...args: unknown[]) => Promise<{ success: boolean }> {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([registered]) => registered === channel)
  if (!call) throw new Error(`No handler registered for ${channel}`)
  return call[1] as (...args: unknown[]) => Promise<{ success: boolean }>
}

describe('tasks.ipc — manual status moves record events', () => {
  let db: Database.Database
  let repoId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    repoId = insertRepo(db, { name: 'repo-a', path: '/tmp/repo-a' }).id
    vi.mocked(ipcMain.handle).mockClear()
    registerTasksHandlers()
  })

  afterEach(() => {
    closeDb()
  })

  async function update(taskId: string, input: Record<string, unknown>): Promise<void> {
    const result = await getHandler(IPC_CHANNELS.TASKS.UPDATE)(undefined, taskId, input)
    expect(result.success).toBe(true)
  }

  it('records from/to when a card is moved today → in_progress', async () => {
    const task = insertTask(db, { repoId, title: 'Move me', status: 'today' })

    await update(task.id, { status: 'in_progress' })

    const events = getEventsByTask(db, task.id)
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('CARD_TRANSITION')
    expect(events[0].fromStatus).toBe('today')
    expect(events[0].toStatus).toBe('in_progress')
    expect(events[0].syncedToAnamnesis).toBe(0)
    expect(JSON.parse(events[0].payloadJson)).toMatchObject({ taskTitle: 'Move me', repoId })
  })

  it('records the previous status, not a hardcoded one, for a second move', async () => {
    const task = insertTask(db, { repoId, title: 'Two moves', status: 'backlog' })

    await update(task.id, { status: 'today' })
    await update(task.id, { status: 'completed' })

    const pairs = getEventsByTask(db, task.id).map((e) => [e.fromStatus, e.toStatus])
    expect(pairs).toEqual([
      ['backlog', 'today'],
      ['today', 'completed'],
    ])
  })

  it('records no event when the update does not change status', async () => {
    const task = insertTask(db, { repoId, title: 'Rename me', status: 'today' })

    await update(task.id, { title: 'Renamed' })

    expect(getEventsByTask(db, task.id)).toHaveLength(0)
  })

  it('records no event when the status is set to its current value', async () => {
    const task = insertTask(db, { repoId, title: 'Same status', status: 'today' })

    await update(task.id, { status: 'today' })

    expect(getEventsByTask(db, task.id)).toHaveLength(0)
  })

  it('records no event when validation rejects the update', async () => {
    const task = insertTask(db, { repoId, title: 'Bad move', status: 'today' })

    const result = await getHandler(IPC_CHANNELS.TASKS.UPDATE)(undefined, task.id, { status: 'not-a-status' })

    expect(result.success).toBe(false)
    expect(getEventsByTask(db, task.id)).toHaveLength(0)
  })
})
