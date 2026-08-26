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

const CLAUDE_SONNET = 'claude-sonnet-4-6'
const CLAUDE_OPUS = 'claude-opus-4-6'
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
  // ANTHROPIC_AUTH_TOKEN is the auth token for the Ollama proxy.
  // ANTHROPIC_API_KEY must be set to empty string to prevent the SDK from using the real key.
  return {
    ANTHROPIC_BASE_URL: OLLAMA_LOCAL_URL,
    ANTHROPIC_AUTH_TOKEN: 'ollama',
    ANTHROPIC_API_KEY: '',
    modelFlag: model
  }
}

// ─── Cloud Model Catalog ──────────────────────────────────────────────────────

export const CLOUD_MODEL_CATALOG = [
  { id: 'qwen3:32b-cloud', name: 'Qwen 3 32B', provider: 'ollama-cloud' as ModelProvider },
  { id: 'ministral:24b-cloud', name: 'Ministral 24B', provider: 'ollama-cloud' as ModelProvider },
  { id: 'devstral:cloud', name: 'Devstral', provider: 'ollama-cloud' as ModelProvider },
  { id: 'glm-5.2:cloud', name: 'GLM 5.2', provider: 'ollama-cloud' as ModelProvider },
  { id: 'gemma4:12b-cloud', name: 'Gemma 4 12B', provider: 'ollama-cloud' as ModelProvider },
] as const

// ─── Orchestrator Phase Support ───────────────────────────────────────────────

import type { OrchestratorPhase } from '../../shared/types/orchestrator.types'

export function recommendForPhase(
  phase: OrchestratorPhase,
  taskDescription: string,
  ollamaCloudAvailable: boolean
): ModelRecommendation {
  // dev phase — always Anthropic (Opus for complex, Sonnet otherwise)
  if (phase === 'dev') {
    const complexity = assessComplexity(taskDescription)
    return {
      model: complexity === 'complex' ? CLAUDE_OPUS : CLAUDE_SONNET,
      provider: 'anthropic',
      rationale: `Dev phase: ${complexity === 'complex' ? 'Opus for complex task' : 'Sonnet for standard task'}`,
      alternatives: ollamaCloudAvailable ? [CLOUD_MODEL_CATALOG[0].id] : [],
      warnings: []
    }
  }

  // commit/push phases — no model needed (uses GitService directly)
  if (phase === 'commit' || phase === 'push') {
    return {
      model: '',
      provider: 'anthropic',
      rationale: `${phase} phase uses GitService directly — no LLM needed`,
      alternatives: [],
      warnings: []
    }
  }

  // review/security — prefer Ollama cloud if available, else Anthropic Sonnet
  if (ollamaCloudAvailable) {
    const preferred = phase === 'security' ? CLOUD_MODEL_CATALOG[2] : CLOUD_MODEL_CATALOG[0]
    return {
      model: preferred.id,
      provider: preferred.provider,
      rationale: `${phase} phase: using Ollama cloud (${preferred.name}) to conserve Anthropic quota`,
      alternatives: [CLAUDE_SONNET],
      warnings: []
    }
  }

  return {
    model: CLAUDE_SONNET,
    provider: 'anthropic',
    rationale: `${phase} phase: Ollama cloud unavailable, falling back to Sonnet`,
    alternatives: [],
    warnings: ['Ollama cloud not available — using Anthropic quota for review/security']
  }
}

// ─── Ollama Cloud Health Check ────────────────────────────────────────────────

export async function checkOllamaCloudHealth(model: string): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_LOCAL_URL}/api/tags`)
    if (!response.ok) return false
    const data = await response.json() as { models?: Array<{ name: string }> }
    return data.models?.some(m => m.name === model || m.name.startsWith(model.split(':')[0])) ?? false
  } catch {
    return false
  }
}
