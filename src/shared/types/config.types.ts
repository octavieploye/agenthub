export interface RepoConfig {
  id: string
  name: string
  path: string
  glowColor?: string
  createdAt: string
}

export interface GuardrailConfig {
  maxDurationMinutes: number
  maxFilesChanged: number
  maxConsecutiveErrors: number
  maxTokensPerSession: number
  protectedPaths: string[]
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxDurationMinutes: 30,
  maxFilesChanged: 20,
  maxConsecutiveErrors: 5,
  maxTokensPerSession: 100000,
  protectedPaths: []
}
