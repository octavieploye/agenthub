import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { getDb, closeDb, resetDb } from '../connection'
import { insertRepo } from './repos.queries'
import { insertAgent } from './agents.queries'
import {
  insertBug,
  getAllBugs,
  getBugsByRepo,
  getBugsBySeverity,
  resolveBug,
  deleteBug,
  getUnresolvedBugs
} from './bugs.queries'
import type Database from 'better-sqlite3'
import type { BugSeverity } from '@shared/types/bug-radar.types'

describe('Bugs Queries', () => {
  let db: Database.Database
  let repoId: string
  let repoName: string
  let agentId: string
  let agentName: string
  let secondRepoId: string
  let secondRepoName: string
  let secondAgentId: string
  let secondAgentName: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')

    // Create the bugs table (not yet in migrations)
    db.exec(`
      CREATE TABLE IF NOT EXISTS bugs (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        agent_name TEXT NOT NULL,
        repo_id TEXT NOT NULL REFERENCES repos(id),
        repo_name TEXT NOT NULL,
        error_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_bugs_repo_id ON bugs(repo_id);
      CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
      CREATE INDEX IF NOT EXISTS idx_bugs_agent_id ON bugs(agent_id);
    `)

    // Seed test data: two repos, two agents
    const repo1 = insertRepo(db, { name: 'frontend-app', path: '/tmp/frontend-app' })
    repoId = repo1.id
    repoName = repo1.name

    const repo2 = insertRepo(db, { name: 'backend-api', path: '/tmp/backend-api' })
    secondRepoId = repo2.id
    secondRepoName = repo2.name

    const agent1 = insertAgent(db, {
      repoId,
      name: 'agent-alpha',
      cwd: '/tmp/frontend-app',
      taskDescription: 'Fix UI bugs'
    })
    agentId = agent1.id
    agentName = agent1.name

    const agent2 = insertAgent(db, {
      repoId: secondRepoId,
      name: 'agent-beta',
      cwd: '/tmp/backend-api',
      taskDescription: 'Fix API bugs'
    })
    secondAgentId = agent2.id
    secondAgentName = agent2.name
  })

  afterEach(() => {
    closeDb()
  })

  // ─── insertBug ────────────────────────────────────────────────────

  it('insertBug returns a BugEntry with generated id', () => {
    const bug = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/components/Button.test.tsx',
      message: 'Expected true to be false',
      severity: 'medium' as BugSeverity
    })

    expect(bug.id).toBeDefined()
    expect(typeof bug.id).toBe('string')
    expect(bug.id.length).toBeGreaterThan(0)
    expect(bug.agentId).toBe(agentId)
    expect(bug.agentName).toBe(agentName)
    expect(bug.repoId).toBe(repoId)
    expect(bug.repoName).toBe(repoName)
    expect(bug.errorType).toBe('test_failure')
    expect(bug.filePath).toBe('src/components/Button.test.tsx')
    expect(bug.message).toBe('Expected true to be false')
    expect(bug.severity).toBe('medium')
    expect(bug.resolvedAt).toBeNull()
    expect(bug.createdAt).toBeDefined()
  })

  it('insertBug stores the bug in the database', () => {
    insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'compile_error',
      filePath: 'src/utils/parser.ts',
      message: 'TS2304: Cannot find name "foo"',
      severity: 'high' as BugSeverity
    })

    const allBugs = getAllBugs(db)
    expect(allBugs).toHaveLength(1)
    expect(allBugs[0].errorType).toBe('compile_error')
    expect(allBugs[0].filePath).toBe('src/utils/parser.ts')
  })

  it('insertBug correctly maps snake_case DB columns to camelCase TS properties', () => {
    const bug = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'runtime_error',
      filePath: 'src/main/index.ts',
      message: 'Uncaught ReferenceError',
      severity: 'critical' as BugSeverity
    })

    // Verify camelCase properties exist (not snake_case)
    expect(bug).toHaveProperty('agentId')
    expect(bug).toHaveProperty('agentName')
    expect(bug).toHaveProperty('repoId')
    expect(bug).toHaveProperty('repoName')
    expect(bug).toHaveProperty('errorType')
    expect(bug).toHaveProperty('filePath')
    expect(bug).toHaveProperty('resolvedAt')
    expect(bug).toHaveProperty('createdAt')

    // Verify snake_case properties do NOT exist
    expect(bug).not.toHaveProperty('agent_id')
    expect(bug).not.toHaveProperty('agent_name')
    expect(bug).not.toHaveProperty('repo_id')
    expect(bug).not.toHaveProperty('repo_name')
    expect(bug).not.toHaveProperty('error_type')
    expect(bug).not.toHaveProperty('file_path')
    expect(bug).not.toHaveProperty('resolved_at')
    expect(bug).not.toHaveProperty('created_at')
  })

  // ─── getAllBugs ───────────────────────────────────────────────────

  it('getAllBugs returns all inserted bugs', () => {
    insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/a.test.ts',
      message: 'Assertion failed',
      severity: 'low' as BugSeverity
    })
    insertBug(db, {
      agentId: secondAgentId,
      agentName: secondAgentName,
      repoId: secondRepoId,
      repoName: secondRepoName,
      errorType: 'lint_error',
      filePath: 'src/b.ts',
      message: 'Unexpected any',
      severity: 'medium' as BugSeverity
    })

    const allBugs = getAllBugs(db)
    expect(allBugs).toHaveLength(2)
    const types = allBugs.map((b) => b.errorType)
    expect(types).toContain('test_failure')
    expect(types).toContain('lint_error')
  })

  it('getAllBugs returns empty array when no bugs', () => {
    const allBugs = getAllBugs(db)
    expect(allBugs).toEqual([])
  })

  // ─── getBugsByRepo ────────────────────────────────────────────────

  it('getBugsByRepo returns only bugs for specific repo', () => {
    insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/component.test.tsx',
      message: 'Test failed',
      severity: 'medium' as BugSeverity
    })
    insertBug(db, {
      agentId: secondAgentId,
      agentName: secondAgentName,
      repoId: secondRepoId,
      repoName: secondRepoName,
      errorType: 'runtime_error',
      filePath: 'src/api/handler.ts',
      message: 'Null reference',
      severity: 'high' as BugSeverity
    })

    const repo1Bugs = getBugsByRepo(db, repoId)
    expect(repo1Bugs).toHaveLength(1)
    expect(repo1Bugs[0].repoId).toBe(repoId)
    expect(repo1Bugs[0].errorType).toBe('test_failure')

    const repo2Bugs = getBugsByRepo(db, secondRepoId)
    expect(repo2Bugs).toHaveLength(1)
    expect(repo2Bugs[0].repoId).toBe(secondRepoId)
    expect(repo2Bugs[0].errorType).toBe('runtime_error')
  })

  it('getBugsByRepo returns empty array for unknown repo', () => {
    insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'compile_error',
      filePath: 'src/index.ts',
      message: 'Syntax error',
      severity: 'high' as BugSeverity
    })

    const result = getBugsByRepo(db, 'non-existent-repo-id')
    expect(result).toEqual([])
  })

  // ─── getBugsBySeverity ────────────────────────────────────────────

  it('getBugsBySeverity returns bugs matching severity', () => {
    insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/a.test.ts',
      message: 'Minor issue',
      severity: 'low' as BugSeverity
    })
    insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'compile_error',
      filePath: 'src/b.ts',
      message: 'Critical crash',
      severity: 'critical' as BugSeverity
    })
    insertBug(db, {
      agentId: secondAgentId,
      agentName: secondAgentName,
      repoId: secondRepoId,
      repoName: secondRepoName,
      errorType: 'lint_error',
      filePath: 'src/c.ts',
      message: 'Another low issue',
      severity: 'low' as BugSeverity
    })

    const lowBugs = getBugsBySeverity(db, 'low')
    expect(lowBugs).toHaveLength(2)
    lowBugs.forEach((b) => expect(b.severity).toBe('low'))

    const criticalBugs = getBugsBySeverity(db, 'critical')
    expect(criticalBugs).toHaveLength(1)
    expect(criticalBugs[0].severity).toBe('critical')
  })

  // ─── resolveBug ───────────────────────────────────────────────────

  it('resolveBug sets resolvedAt to a timestamp', () => {
    const bug = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/fix.test.ts',
      message: 'Was broken, now fixed',
      severity: 'medium' as BugSeverity
    })
    expect(bug.resolvedAt).toBeNull()

    resolveBug(db, bug.id)

    const allBugs = getAllBugs(db)
    const resolved = allBugs.find((b) => b.id === bug.id)
    expect(resolved).toBeDefined()
    expect(resolved!.resolvedAt).not.toBeNull()
    expect(typeof resolved!.resolvedAt).toBe('string')
  })

  it('resolveBug does not affect other bugs', () => {
    const bug1 = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/a.test.ts',
      message: 'Bug one',
      severity: 'low' as BugSeverity
    })
    const bug2 = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'compile_error',
      filePath: 'src/b.ts',
      message: 'Bug two',
      severity: 'high' as BugSeverity
    })

    resolveBug(db, bug1.id)

    const allBugs = getAllBugs(db)
    const resolvedBug = allBugs.find((b) => b.id === bug1.id)
    const untouchedBug = allBugs.find((b) => b.id === bug2.id)

    expect(resolvedBug!.resolvedAt).not.toBeNull()
    expect(untouchedBug!.resolvedAt).toBeNull()
  })

  // ─── deleteBug ────────────────────────────────────────────────────

  it('deleteBug removes the bug entry', () => {
    const bug = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'runtime_error',
      filePath: 'src/crash.ts',
      message: 'Stack overflow',
      severity: 'critical' as BugSeverity
    })

    deleteBug(db, bug.id)

    const allBugs = getAllBugs(db)
    expect(allBugs).toHaveLength(0)
  })

  it('deleteBug does not affect other bugs', () => {
    const bug1 = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/a.test.ts',
      message: 'Delete me',
      severity: 'low' as BugSeverity
    })
    const bug2 = insertBug(db, {
      agentId: secondAgentId,
      agentName: secondAgentName,
      repoId: secondRepoId,
      repoName: secondRepoName,
      errorType: 'lint_error',
      filePath: 'src/b.ts',
      message: 'Keep me',
      severity: 'medium' as BugSeverity
    })

    deleteBug(db, bug1.id)

    const allBugs = getAllBugs(db)
    expect(allBugs).toHaveLength(1)
    expect(allBugs[0].id).toBe(bug2.id)
    expect(allBugs[0].message).toBe('Keep me')
  })

  // ─── getUnresolvedBugs ───────────────────────────────────────────

  it('getUnresolvedBugs returns only bugs where resolvedAt is null', () => {
    insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/open.test.ts',
      message: 'Still open',
      severity: 'medium' as BugSeverity
    })
    insertBug(db, {
      agentId: secondAgentId,
      agentName: secondAgentName,
      repoId: secondRepoId,
      repoName: secondRepoName,
      errorType: 'compile_error',
      filePath: 'src/another-open.ts',
      message: 'Also open',
      severity: 'high' as BugSeverity
    })

    const unresolved = getUnresolvedBugs(db)
    expect(unresolved).toHaveLength(2)
    unresolved.forEach((b) => expect(b.resolvedAt).toBeNull())
  })

  it('getUnresolvedBugs excludes resolved bugs', () => {
    const bug1 = insertBug(db, {
      agentId,
      agentName,
      repoId,
      repoName,
      errorType: 'test_failure',
      filePath: 'src/resolved.test.ts',
      message: 'This was fixed',
      severity: 'low' as BugSeverity
    })
    insertBug(db, {
      agentId: secondAgentId,
      agentName: secondAgentName,
      repoId: secondRepoId,
      repoName: secondRepoName,
      errorType: 'runtime_error',
      filePath: 'src/still-broken.ts',
      message: 'Still broken',
      severity: 'critical' as BugSeverity
    })

    resolveBug(db, bug1.id)

    const unresolved = getUnresolvedBugs(db)
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].message).toBe('Still broken')
    expect(unresolved[0].resolvedAt).toBeNull()
  })
})
