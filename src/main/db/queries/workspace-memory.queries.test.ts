import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import { insertProject } from './projects.queries'
import { insertRepo } from './repos.queries'
import { insertTask, updateTask, linkSBARToTask } from './tasks.queries'
import { insertTaskEvent } from './task-events.queries'
import { insertSBAR } from './sbar.queries'
import {
  insertLearning,
  getLearningsByProject,
  deleteLearning,
  getRecentCompletedSBARs
} from './workspace-memory.queries'

let db: Database.Database

// Shared agent row needed because sbar_handoffs.agent_id REFERENCES agents(id)
// and better-sqlite3 enforces FK constraints by default.
const AGENT_ID = 'test-agent-1'

function seedAgent(repoId: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO agents (id, repo_id, name, cwd) VALUES (?, ?, 'test-agent', ?)`
  ).run(AGENT_ID, repoId, '/tmp/test')
}

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, __dirname + '/../migrations')
})

afterEach(() => {
  db.close()
})

describe('insertLearning', () => {
  it('stores a learning and returns typed entry', () => {
    const p = insertProject(db, { name: 'P' })
    const entry = insertLearning(db, {
      projectId: p.id,
      content: 'Always use transactions for bulk inserts.'
    })
    expect(entry.id).toBeTruthy()
    expect(entry.projectId).toBe(p.id)
    expect(entry.content).toBe('Always use transactions for bulk inserts.')
    expect(entry.createdAt).toBeTruthy()
  })
})

describe('getLearningsByProject', () => {
  it('returns empty array for unknown project', () => {
    expect(getLearningsByProject(db, 'no-such-id')).toEqual([])
  })

  it('returns entries ordered by pinned_at DESC', () => {
    const p = insertProject(db, { name: 'P' })
    const first = insertLearning(db, { projectId: p.id, content: 'First' })
    // Force first entry to an earlier pinned_at so ordering is deterministic
    db.prepare('UPDATE workspace_memory SET pinned_at = ? WHERE id = ?').run(
      '2000-01-01T00:00:00.000Z',
      first.id
    )
    insertLearning(db, { projectId: p.id, content: 'Second' })
    const entries = getLearningsByProject(db, p.id)
    expect(entries).toHaveLength(2)
    // Second was inserted later, so pinned_at is newer — it comes first
    expect(entries[0].content).toBe('Second')
  })
})

describe('deleteLearning', () => {
  it('removes the entry', () => {
    const p = insertProject(db, { name: 'P' })
    const entry = insertLearning(db, { projectId: p.id, content: 'Temporary note' })
    deleteLearning(db, entry.id)
    expect(getLearningsByProject(db, p.id)).toHaveLength(0)
  })
})

describe('getRecentCompletedSBARs', () => {
  function randomSuffix(): string {
    return Math.random().toString(36).slice(2, 8)
  }

  function seedCompletedTask(projectId: string): void {
    const repo = insertRepo(db, { name: `r-${randomSuffix()}`, path: `/r/${randomSuffix()}` })
    seedAgent(repo.id)
    const task = insertTask(db, {
      repoId: repo.id,
      title: 'Fix login bug',
      status: 'backlog',
      projectId
    })
    updateTask(db, task.id, { status: 'completed' })
    insertTaskEvent(db, {
      taskId: task.id,
      eventType: 'CARD_COMPLETED',
      fromStatus: 'in_progress',
      toStatus: 'completed',
      agentId: AGENT_ID,
      payload: { taskTitle: task.title, repoId: repo.id }
    })
  }

  it('returns empty array when no CARD_COMPLETED events exist', () => {
    const p = insertProject(db, { name: 'P' })
    expect(getRecentCompletedSBARs(db, p.id, 5)).toEqual([])
  })

  it('returns at most the requested limit', () => {
    const p = insertProject(db, { name: 'P' })
    for (let i = 0; i < 8; i++) seedCompletedTask(p.id)
    const results = getRecentCompletedSBARs(db, p.id, 5)
    expect(results).toHaveLength(5)
  })

  it('includes task title even when sbar_id is null', () => {
    const p = insertProject(db, { name: 'P' })
    seedCompletedTask(p.id)
    const results = getRecentCompletedSBARs(db, p.id, 5)
    expect(results[0].taskTitle).toBe('Fix login bug')
    expect(results[0].situation).toBeNull()
  })

  it('includes SBAR fields when sbar_id is linked', () => {
    const p = insertProject(db, { name: 'P' })
    const repo = insertRepo(db, { name: 'r2', path: '/r2' })
    seedAgent(repo.id)
    const task = insertTask(db, {
      repoId: repo.id,
      title: 'Add auth',
      status: 'backlog',
      projectId: p.id
    })
    const sbar = insertSBAR(db, {
      agentId: AGENT_ID,
      agentName: 'dev',
      repoId: repo.id,
      situation: 'Auth needed',
      background: 'Background',
      assessment: 'Done',
      recommendation: 'Deploy'
    })
    linkSBARToTask(db, task.id, sbar.id)
    insertTaskEvent(db, {
      taskId: task.id,
      eventType: 'CARD_COMPLETED',
      fromStatus: 'in_progress',
      toStatus: 'completed',
      agentId: AGENT_ID,
      payload: { taskTitle: task.title, repoId: repo.id }
    })
    const results = getRecentCompletedSBARs(db, p.id, 5)
    expect(results[0].situation).toBe('Auth needed')
    expect(results[0].recommendation).toBe('Deploy')
  })

  it('filters by project_id — does not include other projects', () => {
    const p1 = insertProject(db, { name: 'P1' })
    const p2 = insertProject(db, { name: 'P2' })
    seedCompletedTask(p1.id)
    expect(getRecentCompletedSBARs(db, p2.id, 5)).toHaveLength(0)
  })
})
