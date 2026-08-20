import { describe, it, expect } from 'vitest'
import { preFlightCheck, type PreFlightTask } from './conflict-checker'

function makeTask(
  overrides: Partial<PreFlightTask> & { id: string }
): PreFlightTask {
  return {
    title: `Task ${overrides.id}`,
    description: 'Implement feature',
    category: 'dev',
    priority: 1,
    blockedBy: [],
    status: 'queued',
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

describe('preFlightCheck', () => {
  it('returns canDispatch=true for clean task with no conflicts', () => {
    const task = makeTask({ id: 'task-1', description: 'Build the login page' })
    const result = preFlightCheck(task, [], [task])

    expect(result.canDispatch).toBe(true)
    expect(result.blockers).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns blocker when circular dependency detected', () => {
    const taskA = makeTask({ id: 'a', blockedBy: ['b'] })
    const taskB = makeTask({ id: 'b', blockedBy: ['a'] })
    const allTasks = [taskA, taskB]

    const result = preFlightCheck(taskA, [], allTasks)

    expect(result.canDispatch).toBe(false)
    expect(result.blockers.length).toBeGreaterThanOrEqual(1)

    const cycleBlocker = result.blockers.find(b => b.description.toLowerCase().includes('circular'))
    expect(cycleBlocker).toBeDefined()
    expect(cycleBlocker!.severity).toBe('critical')
  })

  it('returns warning for potential file conflict with active task', () => {
    const task = makeTask({
      id: 'task-1',
      description: 'Refactor src/main/services/agent-manager.ts for new API'
    })
    const activeTask = makeTask({
      id: 'task-2',
      status: 'in_progress',
      description: 'Fix bug in src/main/services/agent-manager.ts error handler'
    })

    const result = preFlightCheck(task, [activeTask], [task, activeTask])

    expect(result.canDispatch).toBe(true)
    const fileWarning = result.warnings.find(w => w.description.toLowerCase().includes('file conflict'))
    expect(fileWarning).toBeDefined()
    expect(fileWarning!.severity).toBe('medium')
  })

  it('returns warning for stale blocker', () => {
    const staleTime = new Date(Date.now() - 35 * 60 * 1000).toISOString() // 35 minutes ago
    const blockerTask = makeTask({
      id: 'blocker-1',
      status: 'in_progress',
      updatedAt: staleTime
    })
    const task = makeTask({
      id: 'task-1',
      blockedBy: ['blocker-1']
    })

    const result = preFlightCheck(task, [blockerTask], [task, blockerTask])

    expect(result.canDispatch).toBe(true)
    const staleWarning = result.warnings.find(w => w.description.toLowerCase().includes('stale'))
    expect(staleWarning).toBeDefined()
    expect(staleWarning!.severity).toBe('high')
  })

  it('returns warning for empty description', () => {
    const task = makeTask({ id: 'task-1', description: '   ' })

    const result = preFlightCheck(task, [], [task])

    expect(result.canDispatch).toBe(true)
    const descWarning = result.warnings.find(w => w.description.toLowerCase().includes('description'))
    expect(descWarning).toBeDefined()
    expect(descWarning!.severity).toBe('medium')
  })

  it('returns warning for missing category', () => {
    const task = makeTask({ id: 'task-1', category: null })

    const result = preFlightCheck(task, [], [task])

    expect(result.canDispatch).toBe(true)
    const catWarning = result.warnings.find(w => w.description.toLowerCase().includes('category'))
    expect(catWarning).toBeDefined()
    expect(catWarning!.severity).toBe('low')
  })

  it('returns canDispatch=true with empty warnings when no issues', () => {
    const taskA = makeTask({
      id: 'task-a',
      description: 'Update src/renderer/src/App.tsx layout',
      category: 'frontend'
    })
    const taskB = makeTask({
      id: 'task-b',
      description: 'Refactor src/main/services/settings-service.ts',
      category: 'backend',
      status: 'in_progress',
      updatedAt: new Date().toISOString()
    })

    const result = preFlightCheck(taskA, [taskB], [taskA, taskB])

    expect(result.canDispatch).toBe(true)
    expect(result.warnings).toHaveLength(0)
    expect(result.blockers).toHaveLength(0)
  })
})
