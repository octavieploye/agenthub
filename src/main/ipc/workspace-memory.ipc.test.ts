import { describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

import Database from 'better-sqlite3'
import { runMigrations } from '../db/migration-runner'
import { insertProject, getProjectById } from '../db/queries/projects.queries'
import {
  handleWorkspaceMemoryList,
  handleWorkspaceMemoryPin,
  handleWorkspaceMemoryUnpin,
  handleWorkspaceMemorySetContextDoc
} from './workspace-memory.ipc'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  db.pragma('foreign_keys = ON')
})

afterEach(() => { db.close() })

it('handleWorkspaceMemoryList returns empty array for new project', () => {
  const p = insertProject(db, { name: 'P' })
  const res = handleWorkspaceMemoryList(db, p.id)
  expect(res).toEqual({ success: true, data: [] })
})

it('handleWorkspaceMemoryPin adds a learning and list returns it', () => {
  const p = insertProject(db, { name: 'P' })
  const pin = handleWorkspaceMemoryPin(db, p.id, 'Always use transactions.')
  expect(pin.success).toBe(true)
  const list = handleWorkspaceMemoryList(db, p.id)
  expect(list.success && list.data).toHaveLength(1)
})

it('handleWorkspaceMemoryUnpin removes the learning', () => {
  const p = insertProject(db, { name: 'P' })
  const pin = handleWorkspaceMemoryPin(db, p.id, 'Temp note') as { success: true; data: { id: string } }
  handleWorkspaceMemoryUnpin(db, pin.data.id)
  const list = handleWorkspaceMemoryList(db, p.id)
  expect(list.success && list.data).toHaveLength(0)
})

it('handleWorkspaceMemorySetContextDoc persists to projects.context_doc', () => {
  const p = insertProject(db, { name: 'P' })
  handleWorkspaceMemorySetContextDoc(db, p.id, 'Auth service context.')
  const updated = getProjectById(db, p.id)
  expect(updated?.contextDoc).toBe('Auth service context.')
})
