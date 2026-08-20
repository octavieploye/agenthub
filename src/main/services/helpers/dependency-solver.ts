export interface DependencyTask {
  id: string
  priority: number
  blockedBy: string[]
}

/**
 * Topological sort using Kahn's algorithm with priority-based tie-breaking.
 * Throws if circular dependencies are detected.
 */
export function topologicalSort<T extends DependencyTask>(tasks: T[]): T[] {
  const taskMap = new Map<string, T>()
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const task of tasks) {
    taskMap.set(task.id, task)
    inDegree.set(task.id, 0)
    adjacency.set(task.id, [])
  }

  for (const task of tasks) {
    for (const dep of task.blockedBy) {
      if (!taskMap.has(dep)) continue
      adjacency.get(dep)!.push(task.id)
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
    }
  }

  // Collect nodes with in-degree 0, sorted by priority (lower = higher priority)
  const queue: T[] = tasks
    .filter(t => (inDegree.get(t.id) ?? 0) === 0)
    .sort((a, b) => a.priority - b.priority)

  const result: T[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    const neighbors = adjacency.get(current.id) ?? []
    const newlyReady: T[] = []

    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        newlyReady.push(taskMap.get(neighbor)!)
      }
    }

    // Insert newly ready tasks in priority order
    newlyReady.sort((a, b) => a.priority - b.priority)
    for (const task of newlyReady) {
      // Binary insert to maintain priority order
      let insertIdx = queue.length
      for (let i = 0; i < queue.length; i++) {
        if (task.priority < queue[i].priority) {
          insertIdx = i
          break
        }
      }
      queue.splice(insertIdx, 0, task)
    }
  }

  if (result.length !== tasks.length) {
    throw new Error('Circular dependency detected in task graph')
  }

  return result
}

/**
 * Returns tasks that are ready to be dispatched:
 * - Not already active (in activeLogs)
 * - Not already completed (in completedTasks)
 * - All blockedBy dependencies are in completedTasks
 * - Up to concurrency cap
 * Sorted by priority (lower number = higher priority).
 */
export function getDispatchableTasks<T extends DependencyTask>(
  tasks: T[],
  activeLogs: Set<string>,
  completedTasks: Set<string>,
  cap: number
): T[] {
  const ready = tasks
    .filter(t => {
      if (activeLogs.has(t.id)) return false
      if (completedTasks.has(t.id)) return false
      return t.blockedBy.every(dep => completedTasks.has(dep))
    })
    .sort((a, b) => a.priority - b.priority)

  const remainingSlots = Math.max(0, cap - activeLogs.size)
  return ready.slice(0, remainingSlots)
}

/**
 * Detect cycles in the dependency graph.
 * Returns the cycle path (array of task IDs) if found, null otherwise.
 */
export function detectCycles<T extends DependencyTask>(tasks: T[]): string[] | null {
  if (tasks.length === 0) return null

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const parent = new Map<string, string | null>()
  const taskIds = new Set(tasks.map(t => t.id))

  for (const task of tasks) {
    color.set(task.id, WHITE)
    parent.set(task.id, null)
  }

  // Build forward adjacency: task → tasks it blocks
  const blocksMap = new Map<string, string[]>()
  for (const task of tasks) {
    blocksMap.set(task.id, [])
  }
  for (const task of tasks) {
    for (const dep of task.blockedBy) {
      if (taskIds.has(dep)) {
        blocksMap.get(dep)!.push(task.id)
      }
    }
  }

  function dfs(node: string): string[] | null {
    color.set(node, GRAY)
    for (const neighbor of blocksMap.get(node) ?? []) {
      if (color.get(neighbor) === GRAY) {
        // Found cycle — reconstruct path
        const cycle = [neighbor, node]
        let current = node
        while (parent.get(current) !== null && parent.get(current) !== neighbor) {
          current = parent.get(current)!
          cycle.push(current)
        }
        return cycle.reverse()
      }
      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, node)
        const result = dfs(neighbor)
        if (result) return result
      }
    }
    color.set(node, BLACK)
    return null
  }

  for (const task of tasks) {
    if (color.get(task.id) === WHITE) {
      const cycle = dfs(task.id)
      if (cycle) return cycle
    }
  }

  return null
}
