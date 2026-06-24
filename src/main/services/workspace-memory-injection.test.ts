import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { runMigrations } from '../db/migration-runner'
import { insertProject } from '../db/queries/projects.queries'
import { writeWorkspaceMemory } from './workspace-memory-writer'

// We test the injection logic directly (not via spawnAgent which requires Electron)
let db: Database.Database
let tmpDir: string

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  tmpDir = join(tmpdir(), `wm-inject-${randomUUID()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

it('writeWorkspaceMemory creates file when project has a valid path', () => {
  const p = insertProject(db, { name: 'Inject Test', path: tmpDir })
  writeWorkspaceMemory(db, p.id, tmpDir)
  expect(existsSync(join(tmpDir, '.claude', 'workspace_memory.md'))).toBe(true)
})

it('writeWorkspaceMemory does not throw when project path does not exist on disk', () => {
  const p = insertProject(db, { name: 'Ghost', path: '/nonexistent/xyz' })
  expect(() => writeWorkspaceMemory(db, p.id, '/nonexistent/xyz')).not.toThrow()
})

it('writeWorkspaceMemory is a no-op when project path is null', () => {
  const p = insertProject(db, { name: 'NoPath' })
  expect(() => writeWorkspaceMemory(db, p.id, '')).not.toThrow()
})
