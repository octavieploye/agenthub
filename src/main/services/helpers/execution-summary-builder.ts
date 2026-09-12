import type {
  OrchestratorTaskLog,
  OrchestratorIssue,
  OrchestratorDebtFlag,
  ExecutionSummary,
  DebtTimeframe
} from '../../../shared/types/orchestrator.types'

const SHORT_KEYWORDS = ['missing test', 'hardcoded', 'todo', 'temporary', 'quick fix']
const LONG_KEYWORDS = ['architecture', 'migration', 'breaking change', 'sovereignty']
const MEDIUM_KEYWORDS = ['performance', 'scalability', 'refactor', 'coupling']

function classifyDebtTimeframe(description: string): DebtTimeframe {
  const lower = description.toLowerCase()

  for (const keyword of SHORT_KEYWORDS) {
    if (lower.includes(keyword)) return 'short'
  }

  for (const keyword of LONG_KEYWORDS) {
    if (lower.includes(keyword)) return 'long'
  }

  for (const keyword of MEDIUM_KEYWORDS) {
    if (lower.includes(keyword)) return 'medium'
  }

  return 'medium'
}

function isValidIssue(item: unknown): item is OrchestratorIssue {
  return typeof item === 'object' && item !== null
    && typeof (item as Record<string, unknown>).description === 'string'
    && typeof (item as Record<string, unknown>).category === 'string'
}

function parseIssues(issuesJson: string | null): OrchestratorIssue[] {
  if (!issuesJson) return []

  try {
    const parsed = JSON.parse(issuesJson)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidIssue)
  } catch {
    return []
  }
}

function computeDurationMs(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null
  const result = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  return Number.isNaN(result) ? null : result
}

export function buildExecutionSummary(
  taskId: string,
  taskTitle: string,
  logs: OrchestratorTaskLog[]
): ExecutionSummary {
  const allIssues: OrchestratorIssue[] = []
  const debtFlags: OrchestratorDebtFlag[] = []

  const phases = logs.map((log) => {
    const issues = parseIssues(log.issuesJson)
    allIssues.push(...issues)
    const durationMs = computeDurationMs(log.startedAt, log.completedAt)

    return {
      phase: log.phase,
      status: log.status,
      modelUsed: log.modelUsed,
      providerUsed: log.providerUsed,
      durationMs,
      issueCount: issues.length
    }
  })

  for (const issue of allIssues) {
    debtFlags.push({
      timeframe: classifyDebtTimeframe(issue.description),
      category: issue.category,
      description: issue.description,
      estimatedEffort: undefined
    })
  }

  const durations = phases.map((p) => p.durationMs)
  const hasAnyNull = durations.some((d) => d === null)
  const totalDurationMs = hasAnyNull
    ? null
    : durations.reduce((sum, d) => (sum as number) + (d as number), 0)

  return {
    taskId,
    taskTitle,
    phases,
    issues: allIssues,
    debtFlags,
    totalDurationMs
  }
}
