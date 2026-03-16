import type { ModelCatalogEntry } from '../types/model.types'

export const CLAUDE_MODELS: ModelCatalogEntry[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    category: 'mixed',
    contextWindow: 200000,
    available: true,
    supportsEffort: true
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    category: 'thinking',
    contextWindow: 200000,
    available: true,
    supportsEffort: true
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    category: 'coding',
    contextWindow: 200000,
    available: true,
    supportsEffort: true
  }
]

export const OLLAMA_CLOUD_MODELS: ModelCatalogEntry[] = [
  { id: 'kimi-k2-thinking:cloud',     name: 'Kimi K2 Thinking',      provider: 'ollama-cloud', category: 'thinking', contextWindow: 128000, available: true, supportsEffort: false },
  { id: 'kimi-k2.5:cloud',            name: 'Kimi K2.5',             provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false },
  { id: 'kimi-k2:1t-cloud',           name: 'Kimi K2 1T',            provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false },
  { id: 'mistral-large-3:675b-cloud', name: 'Mistral Large 3 675B',  provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false },
  { id: 'minimax-m2.5:cloud',         name: 'MiniMax M2.5',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false },
  { id: 'glm-5:cloud',                name: 'GLM-5',                 provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false },
  { id: 'glm-4.7:cloud',              name: 'GLM-4.7',               provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false },
  { id: 'deepseek-v3.2:cloud',        name: 'DeepSeek V3.2',         provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false },
]

export const OLLAMA_LOCAL_MODELS: ModelCatalogEntry[] = [
  { id: 'devstral-2',       name: 'Devstral 2',       provider: 'ollama-local', category: 'coding', contextWindow: 64000, available: true, supportsEffort: false },
  { id: 'ministral-3',      name: 'Ministral 3',      provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, supportsEffort: false },
  { id: 'gpt-oss',          name: 'GPT OSS',          provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, supportsEffort: false },
  { id: 'qwen3-coder',      name: 'Qwen3 Coder',      provider: 'ollama-local', category: 'coding', contextWindow: 64000, available: true, supportsEffort: false },
  { id: 'qwen3-coder-next', name: 'Qwen3 Coder Next', provider: 'ollama-local', category: 'coding', contextWindow: 64000, available: true, supportsEffort: false },
  { id: 'qwen3-vl',         name: 'Qwen3 VL',         provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, supportsEffort: false },
  { id: 'qwen3.5',          name: 'Qwen3.5',          provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, supportsEffort: false },
  { id: 'nemotron-3-super', name: 'Nemotron 3 Super',  provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, supportsEffort: false },
]

export const ALL_OLLAMA_MODELS: ModelCatalogEntry[] = [
  ...OLLAMA_CLOUD_MODELS,
  ...OLLAMA_LOCAL_MODELS,
]

export const EFFORT_LEVELS = ['high', 'medium', 'low'] as const

export const EFFORT_LABELS: Record<string, string> = {
  high: 'High — deep reasoning, slower',
  medium: 'Medium — balanced',
  low: 'Low — fast, lighter reasoning'
}

export const CATEGORY_LABELS: Record<string, string> = {
  thinking: 'Thinking',
  coding: 'Coding',
  mixed: 'Mixed'
}

export const CATEGORY_COLORS: Record<string, string> = {
  thinking: 'text-purple-400',
  coding: 'text-emerald-400',
  mixed: 'text-blue-400'
}
