export type BugSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface BugEntry {
  id: string
  agentId: string
  agentName: string
  repoId: string
  repoName: string
  errorType: string // e.g., 'test_failure', 'compile_error', 'runtime_error', 'lint_error'
  filePath: string
  message: string
  severity: BugSeverity
  resolvedAt: string | null
  projectId: string | null
  createdAt: string
}
