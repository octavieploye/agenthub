import log from 'electron-log/main'
import type { ModelProvider } from '@shared/types/agent.types'

export type TaskComplexity = 'simple' | 'moderate' | 'complex'
export type QuotaZone = 'healthy' | 'moderate' | 'hot'

export interface ProviderQuotaState {
  provider: ModelProvider
  zone: QuotaZone
  quotaPercent: number
  available: boolean
  lastUpdated: string | null
}

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

export interface RecommendOptions {
  ollamaAvailable?: boolean
  codexAvailable?: boolean
  codexQuotaPercent?: number
}

const CODEX_DEFAULT = 'o3-mini'

export function recommend(
  quotaPercent: number,
  taskDescription: string,
  ollamaAvailableOrOpts?: boolean | RecommendOptions
): ModelRecommendation {
  // Backward-compatible: accept boolean or options object
  let ollamaAvailable = false
  let codexAvailable = false
  let codexQuotaPercent = 0
  if (typeof ollamaAvailableOrOpts === 'boolean') {
    ollamaAvailable = ollamaAvailableOrOpts
  } else if (ollamaAvailableOrOpts) {
    ollamaAvailable = ollamaAvailableOrOpts.ollamaAvailable ?? false
    codexAvailable = ollamaAvailableOrOpts.codexAvailable ?? false
    codexQuotaPercent = ollamaAvailableOrOpts.codexQuotaPercent ?? 0
  }

  const zone = getQuotaZone(quotaPercent)
  const codexZone = getQuotaZone(codexQuotaPercent)
  const complexity = assessComplexity(taskDescription)

  log.debug(`Model dispatch: zone=${zone}, complexity=${complexity}, ollama=${ollamaAvailable}, codex=${codexAvailable}`)

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
    const alternatives: string[] = []
    if (codexAvailable && codexZone !== 'hot') alternatives.push(CODEX_DEFAULT)
    if (ollamaAvailable) alternatives.push(OLLAMA_DEFAULT)
    return {
      model: complexity === 'complex' ? CLAUDE_OPUS : CLAUDE_SONNET,
      provider: 'anthropic',
      rationale: 'Claude recommended — consider alternatives for simpler follow-up tasks',
      alternatives,
      warnings: []
    }
  }

  // Hot zone — cascade: try Codex first, then Ollama, then Claude
  if (codexAvailable && codexZone !== 'hot') {
    return {
      model: CODEX_DEFAULT,
      provider: 'openai-codex',
      rationale: 'Claude quota is hot — using Codex CLI as fallback',
      alternatives: ollamaAvailable ? [OLLAMA_DEFAULT, CLAUDE_SONNET] : [CLAUDE_SONNET],
      warnings: []
    }
  }

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
        : 'No fallback providers available — using Claude',
    alternatives: ollamaAvailable ? [OLLAMA_DEFAULT] : [],
    warnings
  }
}

/**
 * Builds unified quota state across all providers.
 * Merges Layer 1 (parser events), Layer 2 (session files), Layer 3 (dashboard scrapes).
 */
export function getUnifiedQuota(sources: {
  claude?: { quotaPercent: number; lastUpdated?: string }
  codex?: { quotaPercent: number; available: boolean; lastUpdated?: string }
  ollamaCloud?: { quotaPercent: number; available: boolean; lastUpdated?: string }
  ollamaLocal?: { available: boolean }
}): ProviderQuotaState[] {
  const states: ProviderQuotaState[] = []

  const claudePercent = sources.claude?.quotaPercent ?? 0
  states.push({
    provider: 'anthropic',
    zone: getQuotaZone(claudePercent),
    quotaPercent: claudePercent,
    available: true,
    lastUpdated: sources.claude?.lastUpdated ?? null
  })

  if (sources.codex) {
    states.push({
      provider: 'openai-codex',
      zone: getQuotaZone(sources.codex.quotaPercent),
      quotaPercent: sources.codex.quotaPercent,
      available: sources.codex.available,
      lastUpdated: sources.codex.lastUpdated ?? null
    })
  }

  if (sources.ollamaCloud) {
    states.push({
      provider: 'ollama-cloud',
      zone: getQuotaZone(sources.ollamaCloud.quotaPercent),
      quotaPercent: sources.ollamaCloud.quotaPercent,
      available: sources.ollamaCloud.available,
      lastUpdated: sources.ollamaCloud.lastUpdated ?? null
    })
  }

  if (sources.ollamaLocal) {
    states.push({
      provider: 'ollama-local',
      zone: 'healthy' as QuotaZone,
      quotaPercent: 0,
      available: sources.ollamaLocal.available,
      lastUpdated: null
    })
  }

  return states
}

export function buildSpawnEnv(
  model: string,
  provider: ModelProvider
): SpawnEnv {
  if (provider === 'anthropic') {
    return { modelFlag: model }
  }

  // Codex CLI reads auth from macOS Keychain — no ANTHROPIC_* env vars needed.
  if (provider === 'openai-codex') {
    return { modelFlag: model || '' }
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

// ─── Skill-Aware Model Recommendation ────────────────────────────────────────

import type { SkillManifest } from '../../shared/types/skills.types'

export interface SkillModelRecommendation extends ModelRecommendation {
  downgraded: boolean
}

// Minimum context windows per model (tokens).
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  [CLAUDE_SONNET]: 200_000,
  [CLAUDE_OPUS]: 200_000,
  [OLLAMA_DEFAULT]: 8_000,
}

// Tier → ordered candidate list (first entry is preferred).
const TIER_MODELS: Record<string, Array<{ model: string; provider: ModelProvider }>> = {
  frontier: [
    { model: CLAUDE_OPUS, provider: 'anthropic' },
    { model: CLAUDE_SONNET, provider: 'anthropic' },
  ],
  expert: [
    { model: CLAUDE_SONNET, provider: 'anthropic' },
  ],
  capable: [
    { model: CLAUDE_SONNET, provider: 'anthropic' },
    { model: OLLAMA_DEFAULT, provider: 'ollama-local' },
  ],
  efficient: [
    { model: OLLAMA_DEFAULT, provider: 'ollama-local' },
    { model: CLAUDE_SONNET, provider: 'anthropic' },
  ],
}

// Down-tier mapping: frontier → expert → capable → efficient.
const DOWNGRADE_MAP: Record<string, string> = {
  frontier: 'expert',
  expert: 'capable',
  capable: 'efficient',
  efficient: 'efficient',
}

function pickFromTier(
  tier: string,
  minContext: number,
  availability: Record<string, boolean>
): { model: string; provider: ModelProvider } | null {
  const candidates = TIER_MODELS[tier] ?? TIER_MODELS['capable']
  for (const candidate of candidates) {
    const contextOk = (MODEL_CONTEXT_WINDOWS[candidate.model] ?? 0) >= minContext
    const providerAvail = availability[candidate.provider] !== false
    if (contextOk && providerAvail) return candidate
  }
  return null
}

export function recommendForSkill(
  manifest: SkillManifest,
  budgetState: { warningLevel: string },
  availability: Record<string, boolean>
): SkillModelRecommendation {
  if (budgetState.warningLevel === 'blocked') {
    return {
      model: '',
      provider: 'anthropic',
      rationale: 'Daily token budget exhausted — no model can be dispatched',
      alternatives: [],
      warnings: ['Token budget blocked: usage has reached 100% of daily limit'],
      downgraded: false,
    }
  }

  const requestedTier = manifest.resources.preferredTier
  const minContext = manifest.resources.minContextWindow

  // Downgrade one tier when budget is critical.
  const effectiveTier =
    budgetState.warningLevel === 'critical'
      ? DOWNGRADE_MAP[requestedTier] ?? requestedTier
      : requestedTier
  const downgraded = effectiveTier !== requestedTier

  const chosen = pickFromTier(effectiveTier, minContext, availability)
  if (chosen) {
    const warnings: string[] = []
    if (downgraded) {
      warnings.push(
        `Budget critical: downgraded from ${requestedTier} to ${effectiveTier} tier`
      )
    }
    if (budgetState.warningLevel === 'warn') {
      warnings.push('Token budget at 70%+ — consider lighter tasks')
    }
    return {
      model: chosen.model,
      provider: chosen.provider,
      rationale: downgraded
        ? `Tier downgraded (${requestedTier} → ${effectiveTier}) to conserve token budget`
        : `Skill prefers ${requestedTier} tier; context ≥${minContext} satisfied`,
      alternatives: [],
      warnings,
      downgraded,
    }
  }

  // No model in effective tier satisfies constraints — fall back to Sonnet.
  return {
    model: CLAUDE_SONNET,
    provider: 'anthropic',
    rationale: `No model in ${effectiveTier} tier satisfies minContextWindow=${minContext}; falling back to Sonnet`,
    alternatives: [],
    warnings: [`Fallback: no suitable model found in ${effectiveTier} tier`],
    downgraded,
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
