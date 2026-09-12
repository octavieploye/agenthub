import type { OrchestratorIssue } from '../../../shared/types/orchestrator.types'
import { detectCycles, type DependencyTask } from './dependency-solver'

export interface PreFlightResult {
  canDispatch: boolean
  warnings: OrchestratorIssue[]
  blockers: OrchestratorIssue[]
}

export interface PreFlightTask {
  id: string
  title: string
  description: string
  category: string | null
  priority: number
  blockedBy: string[]
  status: string
  updatedAt: string
}

const FILE_PATH_REGEX = /(?:src\/|lib\/|test\/)[^\s,)]+/g
const STALE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

function extractFilePaths(text: string): string[] {
  return text.match(FILE_PATH_REGEX) ?? []
}

function toDependencyTasks(tasks: PreFlightTask[]): DependencyTask[] {
  return tasks.map(t => ({
    id: t.id,
    priority: t.priority,
    blockedBy: t.blockedBy
  }))
}

function checkCircularDependencies(allTasks: PreFlightTask[]): OrchestratorIssue | null {
  const depTasks = toDependencyTasks(allTasks)
  const cycle = detectCycles(depTasks)

  if (cycle) {
    return {
      severity: 'critical',
      category: 'dependency',
      description: `Circular dependency detected: ${cycle.join(' -> ')}`
    }
  }

  return null
}

function checkFileConflicts(
  task: PreFlightTask,
  activeTasks: PreFlightTask[]
): OrchestratorIssue[] {
  const issues: OrchestratorIssue[] = []
  const taskFiles = extractFilePaths(task.description)

  if (taskFiles.length === 0) return issues

  for (const active of activeTasks) {
    const activeFiles = extractFilePaths(active.description)
    const overlapping = taskFiles.filter(f => activeFiles.includes(f))

    if (overlapping.length > 0) {
      issues.push({
        severity: 'medium',
        category: 'file-conflict',
        description: `Potential file conflict with active task "${active.id}": ${overlapping.join(', ')}`,
        file: overlapping[0]
      })
    }
  }

  return issues
}

function checkStaleBlockers(
  task: PreFlightTask,
  activeTasks: PreFlightTask[]
): OrchestratorIssue[] {
  const issues: OrchestratorIssue[] = []
  const activeMap = new Map(activeTasks.map(t => [t.id, t]))

  for (const blockerId of task.blockedBy) {
    const blocker = activeMap.get(blockerId)
    if (!blocker) continue

    const updatedAt = new Date(blocker.updatedAt).getTime()
    const elapsed = Date.now() - updatedAt

    if (elapsed > STALE_THRESHOLD_MS) {
      const minutes = Math.round(elapsed / 60000)
      issues.push({
        severity: 'high',
        category: 'stale-blocker',
        description: `Stale blocker: task "${blockerId}" has been in_progress for ${minutes} minutes without update`
      })
    }
  }

  return issues
}

function checkMissingDescription(task: PreFlightTask): OrchestratorIssue | null {
  if (!task.description || task.description.trim().length === 0) {
    return {
      severity: 'medium',
      category: 'quality',
      description: 'Task has empty description — agents may lack context for execution'
    }
  }

  return null
}

function checkMissingCategory(task: PreFlightTask): OrchestratorIssue | null {
  if (task.category === null) {
    return {
      severity: 'low',
      category: 'quality',
      description: 'Task has no category assigned — routing may be suboptimal'
    }
  }

  return null
}

export function preFlightCheck(
  task: PreFlightTask,
  activeTasks: PreFlightTask[],
  allTasks: PreFlightTask[]
): PreFlightResult {
  const warnings: OrchestratorIssue[] = []
  const blockers: OrchestratorIssue[] = []

  // 1. Circular dependency check (blocker)
  const cycleIssue = checkCircularDependencies(allTasks)
  if (cycleIssue) {
    blockers.push(cycleIssue)
  }

  // 2. File conflict check (warning)
  const fileConflicts = checkFileConflicts(task, activeTasks)
  warnings.push(...fileConflicts)

  // 3. Stale blocker check (warning)
  const staleBlockers = checkStaleBlockers(task, activeTasks)
  warnings.push(...staleBlockers)

  // 4. Missing description (warning)
  const descIssue = checkMissingDescription(task)
  if (descIssue) {
    warnings.push(descIssue)
  }

  // 5. Missing category (warning)
  const catIssue = checkMissingCategory(task)
  if (catIssue) {
    warnings.push(catIssue)
  }

  return {
    canDispatch: blockers.length === 0,
    warnings,
    blockers
  }
}
