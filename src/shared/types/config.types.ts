export interface RepoConfig {
  id: string
  name: string
  path: string
  glowColor?: string
  createdAt: string
  lastUsedAt?: string
}

export interface GuardrailConfig {
  maxDurationMinutes: number
  maxFilesChanged: number
  maxConsecutiveErrors: number
  maxTokensPerSession: number
  protectedPaths: string[]
  /** Override stuck-agent threshold in ms (default: 60 min). Used by orchestrator tick timer. */
  stuckThresholdMs?: number
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxDurationMinutes: 30,
  maxFilesChanged: 20,
  maxConsecutiveErrors: 5,
  maxTokensPerSession: 100000,
  protectedPaths: []
}
