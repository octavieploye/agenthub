/**
 * Cloud model catalog and provider labels — shared between main and renderer.
 * Source of truth for ollama-cloud model IDs lives in model-dispatcher.ts (main process).
 * This file exports a renderer-safe subset for dropdown population.
 */

export interface CloudModelEntry {
  id: string
  name: string
  provider: 'ollama-cloud' | 'ollama-local' | 'anthropic'
}

export const CLOUD_MODEL_OPTIONS: CloudModelEntry[] = [
  { id: 'qwen3:32b-cloud', name: 'Qwen 3 32B', provider: 'ollama-cloud' },
  { id: 'ministral:24b-cloud', name: 'Ministral 24B', provider: 'ollama-cloud' },
  { id: 'devstral:cloud', name: 'Devstral', provider: 'ollama-cloud' },
  { id: 'glm-5.2:cloud', name: 'GLM 5.2', provider: 'ollama-cloud' },
  { id: 'gemma4:12b-cloud', name: 'Gemma 4 12B', provider: 'ollama-cloud' },
]

export const ANTHROPIC_MODEL_OPTIONS: CloudModelEntry[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet', provider: 'anthropic' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus', provider: 'anthropic' },
]

export const PROVIDER_BADGE_LABEL: Record<string, string> = {
  'ollama-cloud': 'OC',
  'ollama-local': 'OL',
  'anthropic': 'AN',
}

export const VALID_PROVIDERS = ['anthropic', 'ollama-local', 'ollama-cloud'] as const
export type ValidProvider = typeof VALID_PROVIDERS[number]
