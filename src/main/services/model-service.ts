import log from 'electron-log/main'
import { CLAUDE_MODELS, CODEX_MODELS, OLLAMA_CLOUD_MODELS } from '../../shared/constants/model-catalog'
import type { CapabilityTier, ModelCatalogEntry, ModelCategory, SpeedProfile } from '../../shared/types/model.types'

const OLLAMA_CATEGORY_HINTS: Record<string, ModelCategory> = {
  'qwen3-coder': 'coding',
  'devstral': 'coding',
  'codellama': 'coding',
  'deepseek-coder': 'coding',
  'starcoder': 'coding',
  'codegemma': 'coding',
  'qwen2.5-coder': 'coding',
  'gemini': 'mixed',
  'llama': 'mixed',
  'mistral': 'mixed',
  'mixtral': 'mixed',
  'phi': 'mixed',
  'minimax': 'mixed',
  'glm': 'thinking',
  'deepseek-r1': 'thinking',
  'qwq': 'thinking',
  'marco-o1': 'thinking'
}

const OLLAMA_FAMILY_HINTS: Array<{ pattern: string; family: string }> = [
  { pattern: 'qwen', family: 'Qwen' },
  { pattern: 'mistral', family: 'Mistral' },
  { pattern: 'mixtral', family: 'Mistral' },
  { pattern: 'gemini', family: 'Gemini' },
  { pattern: 'gemma', family: 'Gemma' },
  { pattern: 'llama', family: 'Llama' },
  { pattern: 'deepseek', family: 'DeepSeek' },
  { pattern: 'phi', family: 'Phi' },
  { pattern: 'starcoder', family: 'StarCoder' },
  { pattern: 'codellama', family: 'Llama' },
  { pattern: 'devstral', family: 'Mistral' },
  { pattern: 'minimax', family: 'MiniMax' },
  { pattern: 'glm', family: 'GLM' },
  { pattern: 'marco', family: 'Marco' },
  { pattern: 'command-r', family: 'Command-R' },
  { pattern: 'yi', family: 'Yi' },
  { pattern: 'vicuna', family: 'Vicuna' },
  { pattern: 'falcon', family: 'Falcon' },
  { pattern: 'orca', family: 'Orca' },
  { pattern: 'nous', family: 'Nous' }
]

function categorizeOllamaModel(name: string): ModelCategory {
  const lower = name.toLowerCase()
  for (const [hint, category] of Object.entries(OLLAMA_CATEGORY_HINTS)) {
    if (lower.includes(hint)) return category
  }
  return 'mixed'
}

function detectOllamaFamily(name: string): string {
  const lower = name.toLowerCase()
  for (const { pattern, family } of OLLAMA_FAMILY_HINTS) {
    if (lower.includes(pattern)) return family
  }
  return 'Other'
}

function parseOllamaModels(
  data: { models?: Array<{ name: string; size?: number; details?: { parameter_size?: string } }> },
  provider: 'ollama-local' | 'ollama-cloud'
): ModelCatalogEntry[] {
  if (!data.models || !Array.isArray(data.models)) return []

  return data.models.map((m) => {
    const name = m.name ?? 'unknown'
    return {
      id: name,
      name,
      provider,
      category: categorizeOllamaModel(name),
      family: detectOllamaFamily(name),
      contextWindow: 128000,
      available: true,
      capabilityTier: 'capable' as const,
      description: 'Locally installed model.',
      speedProfile: 'balanced' as const
    }
  })
}

export async function fetchOllamaLocalModels(): Promise<ModelCatalogEntry[]> {
  const OLLAMA_LOCAL_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`${OLLAMA_LOCAL_HOST}/api/tags`, {
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) return []
    const data = await response.json()
    return parseOllamaModels(data, 'ollama-local')
  } catch (err) {
    log.debug('Ollama local not available', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

/** Build a lookup from hardcoded catalog entries keyed by model id */
const cloudCatalogIndex = new Map(OLLAMA_CLOUD_MODELS.map((m) => [m.id, m]))

/** Enrich a live-fetched entry with curated metadata from the hardcoded catalog when available */
function enrichCloudEntry(entry: ModelCatalogEntry): ModelCatalogEntry {
  const curated = cloudCatalogIndex.get(entry.id)
  if (!curated) return entry
  return {
    ...entry,
    category: curated.category,
    capabilityTier: curated.capabilityTier as CapabilityTier,
    description: curated.description,
    strengths: curated.strengths,
    speedProfile: curated.speedProfile as SpeedProfile,
    claudeComparison: curated.claudeComparison
  }
}

export async function fetchOllamaCloudModels(): Promise<ModelCatalogEntry[]> {
  const OLLAMA_CLOUD_HOST = process.env.OLLAMA_CLOUD_HOST ?? 'https://ollama.com'
  const apiKey = process.env.OLLAMA_API_KEY ?? process.env.OLLAMA_CLOUD_KEY ?? ''

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const headers: Record<string, string> = {}
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const response = await fetch(`${OLLAMA_CLOUD_HOST}/api/tags`, {
      headers,
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      log.warn('Ollama cloud API returned', response.status)
      return []
    }
    const data = await response.json()
    return parseOllamaModels(data, 'ollama-cloud').map(enrichCloudEntry)
  } catch (err) {
    log.debug('Ollama cloud not available', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

export async function listAllModels(): Promise<ModelCatalogEntry[]> {
  const [cloudModels, localModels] = await Promise.all([
    fetchOllamaCloudModels(),
    fetchOllamaLocalModels()
  ])

  // Fall back to hardcoded catalog if live fetch returned nothing
  const ollamaCloud = cloudModels.length > 0 ? cloudModels : OLLAMA_CLOUD_MODELS

  return [...ollamaCloud, ...localModels, ...CODEX_MODELS, ...CLAUDE_MODELS]
}
