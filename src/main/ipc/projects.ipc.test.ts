import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { registerProjectsHandlers } from './projects.ipc'
import { ipcMain } from 'electron'

// Electron mock — only acceptable mock (Electron requires a running process)
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getVersion: () => '0.0.0' }
}))

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const calls = vi.mocked(ipcMain.handle).mock.calls
  const call = calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`No handler for ${channel}`)
  return call[1] as (...args: unknown[]) => unknown
}

function setupDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      path TEXT,
      context_doc TEXT,
      context_doc_updated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE project_repos (
      project_id TEXT NOT NULL,
      repo_id TEXT NOT NULL,
      PRIMARY KEY (project_id, repo_id)
    );
    CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT);
    CREATE TABLE bugs (id TEXT PRIMARY KEY, project_id TEXT);
    CREATE TABLE workspace_memory (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      pinned_at TEXT NOT NULL
    );
  `)
  return db
}

describe('projects.ipc — workspace_memory.md cleanup', () => {
  let db: Database.Database
  let tmpDir: string

  beforeEach(() => {
    db = setupDb()
    tmpDir = join(tmpdir(), 'test-proj-' + randomUUID())
    vi.mocked(ipcMain.handle).mockClear()
    registerProjectsHandlers(db)
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('deletes workspace_memory.md when project is deleted', async () => {
    // Create project path and file
    const claudeDir = join(tmpDir, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    writeFileSync(join(claudeDir, 'workspace_memory.md'), 'test content')

    // Insert project with path
    db.prepare(
      `INSERT INTO projects (id, name, path, created_at, updated_at)
       VALUES ('proj-1', 'Test Project', ?, datetime('now'), datetime('now'))`
    ).run(tmpDir)

    const handler = getHandler('projects:delete')
    await handler(null, 'proj-1')

    expect(existsSync(join(claudeDir, 'workspace_memory.md'))).toBe(false)
  })

  it('does not throw when workspace_memory.md does not exist on delete', async () => {
    mkdirSync(tmpDir, { recursive: true })
    db.prepare(
      `INSERT INTO projects (id, name, path, created_at, updated_at)
       VALUES ('proj-2', 'No File Project', ?, datetime('now'), datetime('now'))`
    ).run(tmpDir)

    const handler = getHandler('projects:delete')
    const result = handler(null, 'proj-2')
    expect(result).toMatchObject({ success: true })
  })

  it('deletes workspace_memory.md at OLD path when project path changes', async () => {
    const oldPath = join(tmpDir, 'old')
    const newPath = join(tmpDir, 'new')
    const claudeDir = join(oldPath, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    writeFileSync(join(claudeDir, 'workspace_memory.md'), 'old memory')

    db.prepare(
      `INSERT INTO projects (id, name, path, created_at, updated_at)
       VALUES ('proj-3', 'Path Change Project', ?, datetime('now'), datetime('now'))`
    ).run(oldPath)

    const handler = getHandler('projects:update')
    await handler(null, 'proj-3', { path: newPath })

    expect(existsSync(join(claudeDir, 'workspace_memory.md'))).toBe(false)
  })

  it('does not delete file when path is unchanged on update', async () => {
    const claudeDir = join(tmpDir, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    writeFileSync(join(claudeDir, 'workspace_memory.md'), 'keep me')

    db.prepare(
      `INSERT INTO projects (id, name, path, created_at, updated_at)
       VALUES ('proj-4', 'Same Path Project', ?, datetime('now'), datetime('now'))`
    ).run(tmpDir)

    const handler = getHandler('projects:update')
    await handler(null, 'proj-4', { name: 'Renamed' }) // no path change

    expect(existsSync(join(claudeDir, 'workspace_memory.md'))).toBe(true)
  })
})
