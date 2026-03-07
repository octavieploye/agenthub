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
