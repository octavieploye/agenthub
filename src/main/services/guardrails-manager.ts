import YAML from 'yaml'
import type { GuardrailConfig } from '@shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '@shared/types/config.types'

export interface GuardrailsManagerDeps {
  readFile: (path: string) => string | null
  writeFile: (path: string, content: string) => void
  logInfo: (message: string, meta?: Record<string, unknown>) => void
}

const MAX_CLAMPS: Partial<Record<keyof GuardrailConfig, number>> = {
  maxDurationMinutes: 480,
  maxFilesChanged: 200,
  maxConsecutiveErrors: 50,
  maxTokensPerSession: 10000000
}

function sanitizeConfig(raw: Record<string, unknown>): GuardrailConfig {
  const config = { ...DEFAULT_GUARDRAILS }

  for (const key of ['maxDurationMinutes', 'maxFilesChanged', 'maxConsecutiveErrors', 'maxTokensPerSession'] as const) {
    const val = raw[key]
    if (typeof val === 'number' && val > 0) {
      const clamp = MAX_CLAMPS[key]
      config[key] = clamp ? Math.min(val, clamp) : val
    }
  }

  if (Array.isArray(raw['protectedPaths'])) {
    config.protectedPaths = raw['protectedPaths'].filter((p): p is string => typeof p === 'string')
  }

  return config
}

export class GuardrailsManager {
  private cache = new Map<string, GuardrailConfig>()
  private deps: GuardrailsManagerDeps

  constructor(deps: GuardrailsManagerDeps) {
    this.deps = deps
  }

  loadGuardrails(repoPath: string): GuardrailConfig {
    const filePath = `${repoPath}/.agenthub.yaml`
    const content = this.deps.readFile(filePath)

    if (!content) {
      this.deps.logInfo('No .agenthub.yaml found, using defaults', { repoPath })
      return { ...DEFAULT_GUARDRAILS }
    }

    try {
      const parsed = YAML.parse(content)
      if (!parsed || typeof parsed !== 'object') {
        return { ...DEFAULT_GUARDRAILS }
      }
      return sanitizeConfig(parsed as Record<string, unknown>)
    } catch {
      this.deps.logInfo('Invalid .agenthub.yaml, using defaults', { repoPath })
      return { ...DEFAULT_GUARDRAILS }
    }
  }

  saveGuardrails(repoPath: string, config: GuardrailConfig): void {
    const filePath = `${repoPath}/.agenthub.yaml`
    const content = YAML.stringify(config)
    this.deps.writeFile(filePath, content)
    this.cache.set(repoPath, { ...config })
    this.deps.logInfo('Guardrails saved', { repoPath })
  }

  getGuardrails(repoPath: string): GuardrailConfig {
    const cached = this.cache.get(repoPath)
    if (cached) return cached

    const config = this.loadGuardrails(repoPath)
    this.cache.set(repoPath, config)
    return config
  }

  updateGuardrail(repoPath: string, key: keyof GuardrailConfig, value: unknown): GuardrailConfig {
    const current = this.getGuardrails(repoPath)
    const updated = { ...current, [key]: value } as GuardrailConfig
    this.saveGuardrails(repoPath, updated)
    return updated
  }

  resetGuardrails(repoPath: string): GuardrailConfig {
    const defaults = { ...DEFAULT_GUARDRAILS }
    this.saveGuardrails(repoPath, defaults)
    this.cache.delete(repoPath)
    return defaults
  }
}
