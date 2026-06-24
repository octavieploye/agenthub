import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { runMigrations } from '../db/migration-runner'
import { insertProject, updateProject } from '../db/queries/projects.queries'
import { buildMarkdown, writeWorkspaceMemory } from './workspace-memory-writer'
import type { SBARSummary, WorkspaceMemoryEntry } from '../db/queries/workspace-memory.queries'
import type { Project } from '../../shared/types/project.types'

// electron-log/main is an Electron boundary — mock it so vitest (Node) can import it
vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), debug: vi.fn(), info: vi.fn() }
}))

let db: Database.Database
let tmpDir: string

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../db/migrations')
  tmpDir = join(tmpdir(), `wm-test-${randomUUID()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

const baseProject: Project = {
  id: 'proj-1',
  name: 'AuthService',
  description: null,
  path: null,
  contextDoc: null,
  contextDocUpdatedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('buildMarkdown', () => {
  it('includes project name in heading', () => {
    const md = buildMarkdown(baseProject, [], [])
    expect(md).toContain('# Workspace Memory — AuthService')
  })

  it('includes Project Context section when contextDoc is set', () => {
    const project = { ...baseProject, contextDoc: 'This is an auth service.' }
    const md = buildMarkdown(project, [], [])
    expect(md).toContain('## Project Context')
    expect(md).toContain('This is an auth service.')
  })

  it('omits Project Context section when contextDoc is null', () => {
    const md = buildMarkdown(baseProject, [], [])
    expect(md).not.toContain('## Project Context')
  })

  it('includes Recent Session History with SBAR data', () => {
    const sbars: SBARSummary[] = [{
      taskTitle: 'Add login flow',
      sprintName: 'Sprint 1',
      epicName: 'Auth',
      completedAt: '2026-06-20T10:00:00.000Z',
      situation: 'Login needed',
      background: null,
      assessment: null,
      recommendation: 'Deploy to staging'
    }]
    const md = buildMarkdown(baseProject, sbars, [])
    expect(md).toContain('## Recent Session History')
    expect(md).toContain('Add login flow')
    expect(md).toContain('Login needed')
    expect(md).toContain('Deploy to staging')
  })

  it('includes Pinned Learnings when entries exist', () => {
    const learnings: WorkspaceMemoryEntry[] = [{
      id: 'l1', projectId: 'proj-1',
      content: 'Always seed the DB in tests.',
      sourceId: null, createdAt: '2026-06-20T00:00:00.000Z',
      pinnedAt: '2026-06-20T00:00:00.000Z', anamnesisId: null, syncedToAnamnesis: 0
    }]
    const md = buildMarkdown(baseProject, [], learnings)
    expect(md).toContain('## Pinned Learnings')
    expect(md).toContain('Always seed the DB in tests.')
  })

  it('keeps output under 8192 bytes even with many sessions', () => {
    const sbars: SBARSummary[] = Array.from({ length: 20 }, (_, i) => ({
      taskTitle: `Task ${i}`,
      sprintName: null, epicName: null,
      completedAt: '2026-06-20T00:00:00.000Z',
      situation: 'A'.repeat(400),
      background: null, assessment: null,
      recommendation: 'B'.repeat(400)
    }))
    const md = buildMarkdown(baseProject, sbars, [])
    expect(Buffer.byteLength(md, 'utf8')).toBeLessThanOrEqual(8192)
  })
})

describe('writeWorkspaceMemory', () => {
  it('creates .claude directory and writes workspace_memory.md', () => {
    const p = insertProject(db, { name: 'Test', path: tmpDir })
    updateProject(db, p.id, { contextDoc: 'This is a test project.' })
    writeWorkspaceMemory(db, p.id, tmpDir)
    const filePath = join(tmpDir, '.claude', 'workspace_memory.md')
    expect(existsSync(filePath)).toBe(true)
    expect(readFileSync(filePath, 'utf8')).toContain('# Workspace Memory — Test')
  })

  it('does not throw when projectPath directory does not exist', () => {
    const p = insertProject(db, { name: 'Test' })
    expect(() => writeWorkspaceMemory(db, p.id, '/nonexistent/path/xyz')).not.toThrow()
  })

  it('overwrites existing workspace_memory.md cleanly', () => {
    const p = insertProject(db, { name: 'Test', path: tmpDir })
    writeWorkspaceMemory(db, p.id, tmpDir)
    writeWorkspaceMemory(db, p.id, tmpDir)
    const content = readFileSync(join(tmpDir, '.claude', 'workspace_memory.md'), 'utf8')
    expect(content.split('# Workspace Memory').length).toBe(2) // appears exactly once
  })
})
