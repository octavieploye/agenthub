export interface RepoConfig {
  id: string
  name: string
  path: string
  glowColor?: string
  createdAt: string
  lastUsedAt?: string
}

export type RepoStack = 'rust' | 'typescript' | 'python' | 'generic'

export interface GuardrailConfig {
  maxDurationMinutes: number
  maxFilesChanged: number
  maxConsecutiveErrors: number
  maxTokensPerSession: number
  protectedPaths: string[]
  /** Override stuck-agent threshold in ms (default: 60 min). Used by orchestrator tick timer. */
  stuckThresholdMs?: number
  /** Stack hint for stack-aware model selection. rust → Sonnet (borrow checker strength). */
  stack?: RepoStack
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxDurationMinutes: 30,
  maxFilesChanged: 20,
  maxConsecutiveErrors: 5,
  maxTokensPerSession: 100000,
  protectedPaths: []
}
