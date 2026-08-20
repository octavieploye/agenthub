import { describe, it, expect } from 'vitest'
import { buildExecutionSummary } from './execution-summary-builder'
import type { OrchestratorTaskLog } from '../../../../shared/types/orchestrator.types'

function makeLog(overrides: Partial<OrchestratorTaskLog> & { id: string }): OrchestratorTaskLog {
  return {
    runId: 'run-1',
    taskId: 'task-1',
    phase: 'dev',
    status: 'done',
    agentId: null,
    modelUsed: null,
    providerUsed: null,
    summaryJson: null,
    issuesJson: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:05:00.000Z',
    startedAt: null,
    completedAt: null,
    ...overrides
  }
}

describe('buildExecutionSummary', () => {
  it('aggregates all phase data', () => {
    const logs: OrchestratorTaskLog[] = [
      makeLog({
        id: 'log-1',
        phase: 'dev',
        status: 'done',
        modelUsed: 'claude-opus-4',
        providerUsed: 'anthropic',
        startedAt: '2026-08-20T10:00:00.000Z',
        completedAt: '2026-08-20T10:02:00.000Z'
      }),
      makeLog({
        id: 'log-2',
        phase: 'review',
        status: 'done',
        modelUsed: 'mistral-large',
        providerUsed: 'mistral',
        startedAt: '2026-08-20T10:02:00.000Z',
        completedAt: '2026-08-20T10:03:00.000Z'
      }),
      makeLog({
        id: 'log-3',
        phase: 'security',
        status: 'skipped'
      })
    ]

    const result = buildExecutionSummary('task-1', 'Implement login', logs)

    expect(result.taskId).toBe('task-1')
    expect(result.taskTitle).toBe('Implement login')
    expect(result.phases).toHaveLength(3)
    expect(result.phases[0].phase).toBe('dev')
    expect(result.phases[0].status).toBe('done')
    expect(result.phases[0].modelUsed).toBe('claude-opus-4')
    expect(result.phases[0].providerUsed).toBe('anthropic')
    expect(result.phases[1].phase).toBe('review')
    expect(result.phases[1].modelUsed).toBe('mistral-large')
    expect(result.phases[2].phase).toBe('security')
    expect(result.phases[2].status).toBe('skipped')
  })

  it('calculates phase duration from startedAt/completedAt', () => {
    const logs: OrchestratorTaskLog[] = [
      makeLog({
        id: 'log-1',
        phase: 'dev',
        startedAt: '2026-08-20T10:00:00.000Z',
        completedAt: '2026-08-20T10:02:30.000Z'
      }),
      makeLog({
        id: 'log-2',
        phase: 'review',
        startedAt: '2026-08-20T10:03:00.000Z',
        completedAt: '2026-08-20T10:03:45.000Z'
      })
    ]

    const result = buildExecutionSummary('task-1', 'Duration test', logs)

    expect(result.phases[0].durationMs).toBe(150_000) // 2m30s
    expect(result.phases[1].durationMs).toBe(45_000) // 45s
    expect(result.totalDurationMs).toBe(195_000) // 2m30s + 45s
  })

  it('classifies debt as short for "missing test"', () => {
    const logs: OrchestratorTaskLog[] = [
      makeLog({
        id: 'log-1',
        phase: 'review',
        issuesJson: JSON.stringify([
          { severity: 'medium', category: 'coverage', description: 'missing test for edge case in parser' }
        ])
      })
    ]

    const result = buildExecutionSummary('task-1', 'Short debt test', logs)

    expect(result.debtFlags).toHaveLength(1)
    expect(result.debtFlags[0].timeframe).toBe('short')
    expect(result.debtFlags[0].category).toBe('coverage')
    expect(result.debtFlags[0].description).toContain('missing test')
  })

  it('classifies debt as long for "architecture"', () => {
    const logs: OrchestratorTaskLog[] = [
      makeLog({
        id: 'log-1',
        phase: 'security',
        issuesJson: JSON.stringify([
          { severity: 'high', category: 'design', description: 'architecture mismatch between service layers' }
        ])
      })
    ]

    const result = buildExecutionSummary('task-1', 'Long debt test', logs)

    expect(result.debtFlags).toHaveLength(1)
    expect(result.debtFlags[0].timeframe).toBe('long')
    expect(result.debtFlags[0].category).toBe('design')
    expect(result.debtFlags[0].description).toContain('architecture')
  })

  it('classifies debt as medium by default', () => {
    const logs: OrchestratorTaskLog[] = [
      makeLog({
        id: 'log-1',
        phase: 'dev',
        issuesJson: JSON.stringify([
          { severity: 'low', category: 'style', description: 'inconsistent naming convention in module' }
        ])
      })
    ]

    const result = buildExecutionSummary('task-1', 'Default debt test', logs)

    expect(result.debtFlags).toHaveLength(1)
    expect(result.debtFlags[0].timeframe).toBe('medium')
    expect(result.debtFlags[0].category).toBe('style')
  })

  it('returns empty issues when all phases clean', () => {
    const logs: OrchestratorTaskLog[] = [
      makeLog({
        id: 'log-1',
        phase: 'dev',
        status: 'done',
        issuesJson: JSON.stringify([]),
        startedAt: '2026-08-20T10:00:00.000Z',
        completedAt: '2026-08-20T10:01:00.000Z'
      }),
      makeLog({
        id: 'log-2',
        phase: 'review',
        status: 'done',
        issuesJson: JSON.stringify([]),
        startedAt: '2026-08-20T10:01:00.000Z',
        completedAt: '2026-08-20T10:02:00.000Z'
      })
    ]

    const result = buildExecutionSummary('task-1', 'Clean run', logs)

    expect(result.issues).toHaveLength(0)
    expect(result.debtFlags).toHaveLength(0)
    expect(result.phases[0].issueCount).toBe(0)
    expect(result.phases[1].issueCount).toBe(0)
    expect(result.totalDurationMs).toBe(120_000)
  })

  it('handles null issuesJson gracefully', () => {
    const logs: OrchestratorTaskLog[] = [
      makeLog({
        id: 'log-1',
        phase: 'dev',
        status: 'done',
        issuesJson: null,
        startedAt: '2026-08-20T10:00:00.000Z',
        completedAt: '2026-08-20T10:01:00.000Z'
      }),
      makeLog({
        id: 'log-2',
        phase: 'commit',
        status: 'done',
        issuesJson: null,
        startedAt: '2026-08-20T10:01:00.000Z',
        completedAt: '2026-08-20T10:01:30.000Z'
      })
    ]

    const result = buildExecutionSummary('task-1', 'Null issues test', logs)

    expect(result.issues).toHaveLength(0)
    expect(result.debtFlags).toHaveLength(0)
    expect(result.phases[0].issueCount).toBe(0)
    expect(result.phases[1].issueCount).toBe(0)
    expect(result.totalDurationMs).toBe(90_000)
  })
})
