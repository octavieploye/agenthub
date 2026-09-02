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
  { id: 'deepseek-v4-pro:0813:cloud', name: 'DeepSeek V4 Pro', provider: 'ollama-cloud' },
  { id: 'deepseek-v4-flash:0731:cloud', name: 'DeepSeek V4 Flash', provider: 'ollama-cloud' },
  { id: 'qwen3.5:397b-cloud', name: 'Qwen3.5 397B', provider: 'ollama-cloud' },
  { id: 'mistral-large-3:675b-cloud', name: 'Mistral Large 3 675B', provider: 'ollama-cloud' },
  { id: 'glm-5.3:cloud', name: 'GLM-5.3', provider: 'ollama-cloud' },
  { id: 'glm-5.2:cloud', name: 'GLM-5.2', provider: 'ollama-cloud' },
  { id: 'glm-5.1:cloud', name: 'GLM-5.1', provider: 'ollama-cloud' },
  { id: 'glm-5.3-flash:cloud', name: 'GLM-5.3 Flash', provider: 'ollama-cloud' },
  { id: 'kimi-k3:cloud', name: 'Kimi K3', provider: 'ollama-cloud' },
  { id: 'kimi-k2.6:cloud', name: 'Kimi K2.6', provider: 'ollama-cloud' },
  { id: 'kimi-k2.7-code:cloud', name: 'Kimi K2.7 Code', provider: 'ollama-cloud' },
  { id: 'minimax-m3:cloud', name: 'MiniMax M3', provider: 'ollama-cloud' },
  { id: 'minimax-m2.7:cloud', name: 'MiniMax M2.7', provider: 'ollama-cloud' },
  { id: 'gemma4:31b-cloud', name: 'Gemma 4 31B', provider: 'ollama-cloud' },
  { id: 'nemotron-3-ultra:cloud', name: 'Nemotron 3 Ultra', provider: 'ollama-cloud' },
  { id: 'nemotron-3-super:cloud', name: 'Nemotron 3 Super', provider: 'ollama-cloud' },
  { id: 'nemotron-3-nano:30b-cloud', name: 'Nemotron 3 Nano 30B', provider: 'ollama-cloud' },
  { id: 'gpt-oss:120b-cloud', name: 'GPT OSS 120B', provider: 'ollama-cloud' },
  { id: 'gpt-oss:20b-cloud', name: 'GPT OSS 20B', provider: 'ollama-cloud' },
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
