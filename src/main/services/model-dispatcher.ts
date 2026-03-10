import log from 'electron-log/main'
import type { ModelProvider } from '@shared/types/agent.types'

export type TaskComplexity = 'simple' | 'moderate' | 'complex'
export type QuotaZone = 'healthy' | 'moderate' | 'hot'

export interface ModelRecommendation {
  model: string
  provider: ModelProvider
  rationale: string
  alternatives: string[]
  warnings: string[]
}

export interface SpawnEnv {
  ANTHROPIC_BASE_URL?: string
  ANTHROPIC_AUTH_TOKEN?: string
  ANTHROPIC_API_KEY?: string
  modelFlag: string
}

const COMPLEX_KEYWORDS = ['refactor', 'architecture', 'migrate', 'redesign']
const SIMPLE_KEYWORDS = ['fix', 'bug', 'typo', 'update', 'lint']

const CLAUDE_SONNET = 'claude-sonnet-4-20250514'
const CLAUDE_OPUS = 'claude-opus-4-20250514'
const OLLAMA_DEFAULT = 'llama3'
const OLLAMA_LOCAL_URL = 'http://localhost:11434'

export function getQuotaZone(quotaPercent: number): QuotaZone {
  if (quotaPercent >= 80) return 'hot'
  if (quotaPercent >= 60) return 'moderate'
  return 'healthy'
}

export function assessComplexity(taskDescription: string): TaskComplexity {
  const lower = taskDescription.toLowerCase()

  for (const keyword of COMPLEX_KEYWORDS) {
    if (lower.includes(keyword)) return 'complex'
  }

  for (const keyword of SIMPLE_KEYWORDS) {
    if (lower.includes(keyword)) return 'simple'
  }

  return 'moderate'
}

export function recommend(
  quotaPercent: number,
  taskDescription: string,
  ollamaAvailable?: boolean
): ModelRecommendation {
  const zone = getQuotaZone(quotaPercent)
  const complexity = assessComplexity(taskDescription)

  log.debug(`Model dispatch: zone=${zone}, complexity=${complexity}, ollama=${ollamaAvailable}`)

  if (zone === 'healthy') {
    return {
      model: complexity === 'complex' ? CLAUDE_OPUS : CLAUDE_SONNET,
      provider: 'anthropic',
      rationale:
        complexity === 'complex'
          ? 'Complex task benefits from Opus capabilities'
          : 'Sonnet handles this efficiently with quota to spare',
      alternatives: [],
      warnings: []
    }
  }

  if (zone === 'moderate') {
    const alternatives = ollamaAvailable ? [OLLAMA_DEFAULT] : []
    return {
      model: complexity === 'complex' ? CLAUDE_OPUS : CLAUDE_SONNET,
      provider: 'anthropic',
      rationale: 'Claude recommended — consider Ollama for simpler follow-up tasks',
      alternatives,
      warnings: []
    }
  }

  // Hot zone
  if (complexity !== 'complex' && ollamaAvailable) {
    return {
      model: OLLAMA_DEFAULT,
      provider: 'ollama-local',
      rationale: 'Quota is high — Ollama handles simple tasks without using quota',
      alternatives: [CLAUDE_SONNET],
      warnings: ['Ollama models typically have <64k context window']
    }
  }

  const warnings: string[] = []
  if (zone === 'hot') {
    warnings.push('Quota usage is above 80% — this task will consume remaining quota')
  }

  return {
    model: complexity === 'complex' ? CLAUDE_OPUS : CLAUDE_SONNET,
    provider: 'anthropic',
    rationale:
      complexity === 'complex'
        ? 'Complex task requires Claude despite high quota'
        : 'Ollama unavailable — using Claude',
    alternatives: ollamaAvailable ? [OLLAMA_DEFAULT] : [],
    warnings
  }
}

export function buildSpawnEnv(
  model: string,
  provider: ModelProvider
): SpawnEnv {
  if (provider === 'anthropic') {
    return { modelFlag: model }
  }

  // Both ollama-local and ollama-cloud route through the local Ollama instance.
  // Cloud models are proxied by the local Ollama server — Claude CLI always talks to localhost.
  return {
    ANTHROPIC_BASE_URL: OLLAMA_LOCAL_URL,
    ANTHROPIC_AUTH_TOKEN: 'ollama',
    ANTHROPIC_API_KEY: '',
    modelFlag: model
  }
}
