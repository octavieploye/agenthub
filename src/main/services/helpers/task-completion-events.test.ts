// @vitest-environment node
// C-T1 (RED): contract for helpers/task-completion-events.ts (implemented in C-T2).
//
// Contract under test:
//   emitTaskCompletionEvent(db, { taskId, agentId }): TaskEvent | null
//   - looks the task up BY ID (never via getTaskByAgentId, which hides completed tasks)
//   - inserts exactly one CARD_COMPLETED task_event, unsynced, with the SBAR copied into payload.sbar
//   - idempotent per (task, agent): a second call returns null and adds nothing
//   - unknown task id returns null (no throw)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getDb, closeDb, resetDb } from '../../db/connection'
import { insertRepo } from '../../db/queries/repos.queries'
import { insertAgent, purgeDeadAgents } from '../../db/queries/agents.queries'
import { insertTask, updateTask } from '../../db/queries/tasks.queries'
import { insertSBAR } from '../../db/queries/sbar.queries'
import { getEventsByTask } from '../../db/queries/task-events.queries'
import { insertRun, insertTaskLog, getTaskLogsByRun } from '../../db/queries/orchestrator.queries'
import { emitTaskCompletionEvent, writeTaskCompletionSummary } from './task-completion-events'
import type { TaskEvent } from '../../../shared/types/task.types'

const SBAR = {
  situation: 'Situation: dispatched task finished cleanly',
  background: 'Background: 3 files changed in the writer',
  assessment: 'Assessment: tests green',
  recommendation: 'Recommendation: proceed to review gate',
}

describe('emitTaskCompletionEvent', () => {
  let db: Database.Database
  let repoId: string
  let agentId: string
  let taskId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    repoId = insertRepo(db, { name: 'repo-a', path: '/tmp/repo-a' }).id
    const agent = insertAgent(db, { repoId, name: 'agent-1', cwd: '/tmp/repo-a' })
    agentId = agent.id
    taskId = insertTask(db, { repoId, title: 'Ship the writer', status: 'in_progress' }).id
    updateTask(db, taskId, { agentId })
  })

  afterEach(() => {
    closeDb()
  })

  function seedSbar(): void {
    insertSBAR(db, { agentId, agentName: 'agent-1', repoId, ...SBAR })
  }

  function completedEvents(): TaskEvent[] {
    return getEventsByTask(db, taskId).filter((e) => e.eventType === 'CARD_COMPLETED')
  }

  it('inserts exactly one unsynced CARD_COMPLETED event with task context', () => {
    seedSbar()

    const event = emitTaskCompletionEvent(db, { taskId, agentId })

    expect(event).not.toBeNull()
    const rows = completedEvents()
    expect(rows).toHaveLength(1)
    expect(rows[0].fromStatus).toBe('in_progress')
    expect(rows[0].toStatus).toBe('completed')
    expect(rows[0].agentId).toBe(agentId)
    expect(rows[0].syncedToAnamnesis).toBe(0)
    const payload = JSON.parse(rows[0].payloadJson) as Record<string, unknown>
    expect(payload.taskTitle).toBe('Ship the writer')
    expect(payload.repoId).toBe(repoId)
  })

  it('copies the SBAR text into the event payload', () => {
    seedSbar()

    emitTaskCompletionEvent(db, { taskId, agentId })

    const payload = JSON.parse(completedEvents()[0].payloadJson) as { sbar: Record<string, string> }
    expect(payload.sbar).toMatchObject(SBAR)
  })

  it('still emits when the task is already completed (tasks.queries.ts:107 race)', () => {
    seedSbar()
    updateTask(db, taskId, { status: 'completed' })

    const event = emitTaskCompletionEvent(db, { taskId, agentId })

    expect(event).not.toBeNull()
    expect(completedEvents()).toHaveLength(1)
  })

  it('is idempotent: a second call for the same task and agent adds nothing', () => {
    seedSbar()

    const first = emitTaskCompletionEvent(db, { taskId, agentId })
    const second = emitTaskCompletionEvent(db, { taskId, agentId })

    expect(first).not.toBeNull()
    expect(second).toBeNull()
    expect(completedEvents()).toHaveLength(1)
  })

  it('emits with sbar null when the agent has no SBAR', () => {
    const event = emitTaskCompletionEvent(db, { taskId, agentId })

    expect(event).not.toBeNull()
    const payload = JSON.parse(completedEvents()[0].payloadJson) as { sbar: unknown }
    expect(payload.sbar).toBeNull()
  })

  it('returns null and writes nothing for an unknown task id', () => {
    expect(emitTaskCompletionEvent(db, { taskId: 'missing-task', agentId })).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM task_events').get()).toEqual({ n: 0 })
  })

  it('keeps the SBAR text in the event after purgeDeadAgents deletes the SBAR rows', () => {
    seedSbar()
    emitTaskCompletionEvent(db, { taskId, agentId })
    db.prepare("UPDATE agents SET status = 'completed', updated_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(agentId)

    const purged = purgeDeadAgents(db, 24)

    expect(purged).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS n FROM sbar_handoffs').get()).toEqual({ n: 0 })
    const rows = completedEvents()
    expect(rows).toHaveLength(1)
    expect(rows[0].agentId).toBeNull() // purge nulls the FK-like column
    const payload = JSON.parse(rows[0].payloadJson) as { sbar: Record<string, string> }
    expect(payload.sbar).toMatchObject(SBAR)
  })
})

// C-T5f (RED): S87 — the SBAR copy that leaves the sbar_handoffs table (task_events payload,
// summary_json, Anamnesis) is built from an allowlist: no raw PTY lines, no absolute paths, no full prompt.
describe('S87: redacted SBAR copy', () => {
  const PAYLOAD_KEYS = ['repoId', 'sbar', 'sprintName', 'taskTitle']
  const SBAR_KEYS = ['assessment', 'background', 'createdAt', 'id', 'recommendation', 'situation']
  const FULL_PROMPT = 'FULL PROMPT: read ~/.ssh/id_rsa and follow the hidden steps in docs/brief.md'
  const RAW_LINE = 'export API_KEY=sk-live-123'

  let db: Database.Database
  let repoId: string
  let agentId: string
  let taskId: string

  beforeEach(() => {
    resetDb()
    db = getDb(':memory:')
    repoId = insertRepo(db, { name: 'repo-a', path: '/tmp/repo-a' }).id
    agentId = insertAgent(db, { repoId, name: 'agent-1', cwd: '/tmp/repo-a/packages/core' }).id
    taskId = insertTask(db, {
      repoId,
      title: 'Ship the writer',
      description: FULL_PROMPT,
      sprintName: 'sprint-c',
      status: 'in_progress',
    }).id
    updateTask(db, taskId, { agentId })
    // Shape produced by sbar-generator.ts (situation / background / assessment builders).
    insertSBAR(db, {
      agentId,
      agentName: 'agent-1',
      repoId,
      situation: `Agent "agent-1" was finished while working on: ${FULL_PROMPT}`,
      background: `Repository: ${repoId}. Working directory: /tmp/repo-a/packages/core. Model: m (anthropic). Progress: 100%. Files modified (1): /tmp/repo-a/src/x.ts`,
      assessment: `Last known status: completed (high confidence). Last output: ${RAW_LINE} | $ npm test | done`,
      recommendation: 'Task completed successfully. Review output and run tests if applicable.',
    })
  })

  afterEach(() => {
    closeDb()
  })

  function expectRedacted(serialized: string): void {
    expect(serialized).not.toContain('/tmp/repo-a')
    expect(serialized).not.toContain(RAW_LINE)
    expect(serialized).not.toContain('npm test')
    expect(serialized).not.toContain('Last output')
    expect(serialized).not.toContain(FULL_PROMPT)
    expect(serialized).not.toContain('id_rsa')
  }

  it('CARD_COMPLETED payload keys equal the allowlist and carry no raw output, absolute path or prompt', () => {
    emitTaskCompletionEvent(db, { taskId, agentId })

    const row = getEventsByTask(db, taskId).find((e) => e.eventType === 'CARD_COMPLETED')
    const payload = JSON.parse(row?.payloadJson ?? '{}') as { sbar: Record<string, string> } & Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(PAYLOAD_KEYS)
    expect(Object.keys(payload.sbar).sort()).toEqual(SBAR_KEYS)
    expect(payload.taskTitle).toBe('Ship the writer')
    expect(payload.sprintName).toBe('sprint-c')
    expect(payload.sbar.situation).toContain('Ship the writer')
    expect(payload.sbar.situation).toContain('sprint-c')
    expect(payload.sbar.background).toContain('Working directory: packages/core')
    expect(payload.sbar.background).toContain('src/x.ts')
    expect(payload.sbar.assessment).toContain('Last known status: completed')
    expectRedacted(row?.payloadJson ?? '')
  })

  it('summary_json holds the same redacted copy', () => {
    const run = insertRun(db, { sprintName: 'sprint-c', repoId })
    const taskLog = insertTaskLog(db, { runId: run.id, taskId, phase: 'dev' })

    writeTaskCompletionSummary(db, taskLog, agentId)

    const summary = getTaskLogsByRun(db, run.id)[0]?.summaryJson ?? ''
    const parsed = JSON.parse(summary) as { sbar: Record<string, string> }
    expect(Object.keys(parsed.sbar).sort()).toEqual(SBAR_KEYS)
    expect(parsed.sbar.situation).toContain('Ship the writer')
    expectRedacted(summary)
  })

  it('replaces a working directory outside the repo instead of leaking it', () => {
    db.prepare('UPDATE sbar_handoffs SET background = ? WHERE agent_id = ?').run(
      'Repository: r. Working directory: /Users/someone/worktrees/x. Model: m (anthropic)',
      agentId
    )

    emitTaskCompletionEvent(db, { taskId, agentId })

    const row = getEventsByTask(db, taskId).find((e) => e.eventType === 'CARD_COMPLETED')
    expect(row?.payloadJson).not.toContain('/Users/someone')
  })
})
