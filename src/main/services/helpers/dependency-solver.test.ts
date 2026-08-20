import { describe, it, expect } from 'vitest'
import { topologicalSort, getDispatchableTasks, detectCycles } from './dependency-solver'

interface TestTask {
  id: string
  priority: number
  blockedBy: string[]
}

function makeTask(id: string, priority: number, blockedBy: string[] = []): TestTask {
  return { id, priority, blockedBy }
}

describe('topologicalSort', () => {
  it('returns tasks in correct order with no deps', () => {
    const tasks = [makeTask('a', 2), makeTask('b', 1), makeTask('c', 3)]
    const sorted = topologicalSort(tasks)
    expect(sorted.map(t => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('respects dependencies: a→b means b comes after a', () => {
    const tasks = [
      makeTask('b', 1, ['a']),
      makeTask('a', 2),
      makeTask('c', 3, ['b'])
    ]
    const sorted = topologicalSort(tasks)
    const ids = sorted.map(t => t.id)
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'))
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'))
  })

  it('throws on circular dependency', () => {
    const tasks = [
      makeTask('a', 1, ['b']),
      makeTask('b', 1, ['a'])
    ]
    expect(() => topologicalSort(tasks)).toThrow(/circular/i)
  })

  it('handles diamond dependency', () => {
    const tasks = [
      makeTask('d', 1, ['b', 'c']),
      makeTask('b', 1, ['a']),
      makeTask('c', 1, ['a']),
      makeTask('a', 1)
    ]
    const sorted = topologicalSort(tasks)
    const ids = sorted.map(t => t.id)
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'))
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'))
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'))
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'))
  })

  it('sorts by priority within same level', () => {
    const tasks = [
      makeTask('c', 3),
      makeTask('a', 1),
      makeTask('b', 2)
    ]
    const sorted = topologicalSort(tasks)
    expect(sorted.map(t => t.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('getDispatchableTasks', () => {
  it('returns unblocked tasks up to cap', () => {
    const tasks = [
      makeTask('a', 1),
      makeTask('b', 1),
      makeTask('c', 1, ['a'])
    ]
    const activeLogs = new Set<string>()
    const completedTasks = new Set<string>()
    const result = getDispatchableTasks(tasks, activeLogs, completedTasks, 2)
    expect(result.map(t => t.id)).toEqual(['a', 'b'])
  })

  it('respects concurrency cap', () => {
    const tasks = [makeTask('a', 1), makeTask('b', 1), makeTask('c', 1)]
    const result = getDispatchableTasks(tasks, new Set(), new Set(), 1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('excludes tasks with active logs', () => {
    const tasks = [makeTask('a', 1), makeTask('b', 1)]
    const activeLogs = new Set(['a'])
    const result = getDispatchableTasks(tasks, activeLogs, new Set(), 3)
    expect(result.map(t => t.id)).toEqual(['b'])
  })

  it('excludes tasks with incomplete dependencies', () => {
    const tasks = [
      makeTask('a', 1),
      makeTask('b', 1, ['a']),
      makeTask('c', 1, ['a'])
    ]
    // 'a' is not completed yet
    const result = getDispatchableTasks(tasks, new Set(), new Set(), 3)
    expect(result.map(t => t.id)).toEqual(['a'])
  })

  it('includes tasks whose deps are all completed', () => {
    const tasks = [
      makeTask('a', 1),
      makeTask('b', 1, ['a']),
      makeTask('c', 1)
    ]
    const completed = new Set(['a'])
    const result = getDispatchableTasks(tasks, new Set(), completed, 3)
    // 'a' is already completed — not dispatched again; 'b' unblocked; 'c' has no deps
    expect(result.map(t => t.id)).toEqual(['b', 'c'])
  })

  it('sorts by priority', () => {
    const tasks = [
      makeTask('c', 3),
      makeTask('a', 1),
      makeTask('b', 2)
    ]
    const result = getDispatchableTasks(tasks, new Set(), new Set(), 3)
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('subtracts active count from cap to prevent over-dispatch', () => {
    const tasks = [makeTask('a', 1), makeTask('b', 2), makeTask('c', 3)]
    // 'a' is already active — cap of 2 means only 1 remaining slot
    const activeLogs = new Set(['a'])
    const result = getDispatchableTasks(tasks, activeLogs, new Set(), 2)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('returns empty when active count meets or exceeds cap', () => {
    const tasks = [makeTask('a', 1), makeTask('b', 2), makeTask('c', 3)]
    const activeLogs = new Set(['a', 'b'])
    const result = getDispatchableTasks(tasks, activeLogs, new Set(), 2)
    expect(result).toHaveLength(0)
  })
})

describe('detectCycles', () => {
  it('returns null for acyclic graph', () => {
    const tasks = [
      makeTask('a', 1),
      makeTask('b', 1, ['a']),
      makeTask('c', 1, ['b'])
    ]
    expect(detectCycles(tasks)).toBeNull()
  })

  it('returns cycle path for direct cycle', () => {
    const tasks = [
      makeTask('a', 1, ['b']),
      makeTask('b', 1, ['a'])
    ]
    const cycle = detectCycles(tasks)
    expect(cycle).not.toBeNull()
    expect(cycle!.length).toBeGreaterThanOrEqual(2)
  })

  it('returns cycle path for indirect cycle', () => {
    const tasks = [
      makeTask('a', 1, ['c']),
      makeTask('b', 1, ['a']),
      makeTask('c', 1, ['b'])
    ]
    const cycle = detectCycles(tasks)
    expect(cycle).not.toBeNull()
    expect(cycle!.length).toBeGreaterThanOrEqual(3)
  })

  it('returns null for empty list', () => {
    expect(detectCycles([])).toBeNull()
  })
})
