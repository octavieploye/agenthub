/**
 * Cloud model catalog and provider labels — shared between main and renderer.
 * Source of truth for ollama-cloud model IDs lives in model-dispatcher.ts (main process).
 * This file exports a renderer-safe subset for dropdown population.
 */

export interface CloudModelEntry {
  id: string
  name: string
  provider: 'ollama-cloud' | 'ollama-local' | 'anthropic' | 'openai-codex'
}

export const CLOUD_MODEL_OPTIONS: CloudModelEntry[] = [
  { id: 'qwen3:32b-cloud', name: 'Qwen 3 32B', provider: 'ollama-cloud' },
  { id: 'ministral:24b-cloud', name: 'Ministral 24B', provider: 'ollama-cloud' },
  { id: 'devstral:cloud', name: 'Devstral', provider: 'ollama-cloud' },
  { id: 'glm-5.2:cloud', name: 'GLM 5.2', provider: 'ollama-cloud' },
  { id: 'gemma4:12b-cloud', name: 'Gemma 4 12B', provider: 'ollama-cloud' },
]

export const ANTHROPIC_MODEL_OPTIONS: CloudModelEntry[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet', provider: 'anthropic' },
  { id: 'claude-opus-4-6', name: 'Claude Opus', provider: 'anthropic' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku', provider: 'anthropic' },
]

export const CODEX_MODEL_OPTIONS: CloudModelEntry[] = [
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'openai-codex' },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'openai-codex' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'openai-codex' },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai-codex' },
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai-codex' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai-codex' },
]

export const PROVIDER_BADGE_LABEL: Record<string, string> = {
  'ollama-cloud': 'OC',
  'ollama-local': 'OL',
  'anthropic': 'AN',
  'openai-codex': 'CX',
}

export const VALID_PROVIDERS = ['anthropic', 'ollama-local', 'ollama-cloud', 'openai-codex'] as const
export type ValidProvider = typeof VALID_PROVIDERS[number]
