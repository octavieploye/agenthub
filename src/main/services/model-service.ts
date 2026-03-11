import log from 'electron-log/main'
import { CLAUDE_MODELS } from '../../shared/constants/model-catalog'
import type { ModelCatalogEntry, ModelCategory } from '../../shared/types/model.types'

const OLLAMA_LOCAL_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
const OLLAMA_CLOUD_HOST = process.env.OLLAMA_CLOUD_HOST ?? 'https://ollama.com'
const OLLAMA_CLOUD_KEY = process.env.OLLAMA_CLOUD_KEY ?? ''

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
  { pattern: 'nous', family: 'Nous' },
  { pattern: 'cogito', family: 'Cogito' },
  { pattern: 'nemotron', family: 'Nemotron' },
  { pattern: 'gpt-oss', family: 'GPT-OSS' },
  { pattern: 'kimi', family: 'Kimi' },
  { pattern: 'rnj', family: 'RNJ' }
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

interface OllamaApiModel {
  name: string
  size?: number
  remote_model?: string
  remote_host?: string
  details?: { parameter_size?: string }
}

/**
 * Fetches models from the local Ollama instance and splits them into
 * local (pulled) and cloud (proxied) based on the `remote_model` field.
 */
export async function fetchOllamaModels(): Promise<{
  local: ModelCatalogEntry[]
  cloud: ModelCatalogEntry[]
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`${OLLAMA_LOCAL_HOST}/api/tags`, {
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) return { local: [], cloud: [] }
    const data: { models?: OllamaApiModel[] } = await response.json()
    if (!data.models || !Array.isArray(data.models)) return { local: [], cloud: [] }

    const local: ModelCatalogEntry[] = []
    const cloud: ModelCatalogEntry[] = []

    for (const m of data.models) {
      const name = m.name ?? 'unknown'
      const isCloud = !!m.remote_model
      const provider = isCloud ? 'ollama-cloud' : 'ollama-local'

      const entry: ModelCatalogEntry = {
        id: `${provider}:${name}`,
        name,
        provider,
        category: categorizeOllamaModel(name),
        family: detectOllamaFamily(name),
        contextWindow: 128000,
        available: true
      }

      if (isCloud) {
        cloud.push(entry)
      } else {
        local.push(entry)
      }
    }

    log.debug('Ollama models discovered', { local: local.length, cloud: cloud.length })
    return { local, cloud }
  } catch (err) {
    log.debug('Ollama not available', { error: err instanceof Error ? err.message : String(err) })
    return { local: [], cloud: [] }
  }
}

/**
 * Fetches the full cloud model catalog from ollama.com.
 * These are all cloud models available to the user's subscription.
 * Models already registered locally are deduplicated in listAllModels().
 */
export async function fetchOllamaCloudCatalog(): Promise<ModelCatalogEntry[]> {
  if (!OLLAMA_CLOUD_KEY) {
    log.debug('No OLLAMA_CLOUD_KEY set, skipping cloud catalog')
    return []
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(`${OLLAMA_CLOUD_HOST}/api/tags`, {
      headers: {
        Authorization: `Bearer ${OLLAMA_CLOUD_KEY}`
      },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      log.warn('Ollama cloud catalog returned', response.status)
      return []
    }
    const data: { models?: OllamaApiModel[] } = await response.json()
    if (!data.models || !Array.isArray(data.models)) return []

    return data.models.map((m) => {
      const name = m.name ?? 'unknown'
      return {
        id: `ollama-cloud:${name}`,
        name,
        provider: 'ollama-cloud' as const,
        category: categorizeOllamaModel(name),
        family: detectOllamaFamily(name),
        contextWindow: 128000,
        available: true
      }
    })
  } catch (err) {
    log.debug('Ollama cloud catalog not available', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

export async function listAllModels(): Promise<ModelCatalogEntry[]> {
  const [ollamaResult, cloudCatalog] = await Promise.all([
    fetchOllamaModels(),
    fetchOllamaCloudCatalog()
  ])

  const { local, cloud: registeredCloud } = ollamaResult

  // Merge cloud catalog with registered cloud models — registered ones take priority
  const registeredNames = new Set(registeredCloud.map((m) => m.name))
  const unregisteredCloud = cloudCatalog.filter((m) => !registeredNames.has(m.name))

  log.debug('Model list built', {
    claude: CLAUDE_MODELS.length,
    ollamaLocal: local.length,
    ollamaCloudRegistered: registeredCloud.length,
    ollamaCloudCatalog: unregisteredCloud.length
  })

  return [...CLAUDE_MODELS, ...local, ...registeredCloud, ...unregisteredCloud]
}
