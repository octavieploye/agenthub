import type { ModelCatalogEntry } from '../types/model.types'

export const CLAUDE_MODELS: ModelCatalogEntry[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    category: 'mixed',
    contextWindow: 200000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'expert',
    description: 'Balanced speed & capability. Strong all-rounder for coding and reasoning.',
    strengths: ['code generation', 'refactoring', 'reasoning'],
    speedProfile: 'balanced',
    claudeComparison: 'Best balance of speed and capability'
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    category: 'thinking',
    contextWindow: 200000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'frontier',
    description: 'Maximum reasoning & problem-solving. Best for complex architecture and deep debugging.',
    strengths: ['deep reasoning', 'planning', 'debugging', 'architecture'],
    speedProfile: 'slow',
    claudeComparison: 'Most capable Claude model'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    category: 'coding',
    contextWindow: 200000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'capable',
    description: 'Fast and efficient. Good for routine tasks and quick iterations.',
    strengths: ['fast responses', 'simple tasks', 'iteration'],
    speedProfile: 'fast',
    claudeComparison: 'Fastest Claude model'
  }
]

export const OLLAMA_CLOUD_MODELS: ModelCatalogEntry[] = [
  { id: 'deepseek-v4-pro:0813:cloud', name: 'DeepSeek V4 Pro',       provider: 'ollama-cloud', category: 'thinking', contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'frontier', description: 'Top-tier reasoning and coding. Equal to or better than Opus for high reasoning + context + coding.', strengths: ['deep reasoning', 'code generation', 'long context'], speedProfile: 'slow', claudeComparison: 'Equal to or better than Opus' },
  { id: 'deepseek-v4-flash:0731:cloud', name: 'DeepSeek V4 Flash',   provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Fast DeepSeek variant for coding and quick iteration.', strengths: ['code generation', 'fast responses'], speedProfile: 'fast', claudeComparison: 'Comparable to Sonnet, faster' },
  { id: 'qwen3.5:397b-cloud',         name: 'Qwen3.5 397B',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Strong general-purpose with coding focus.', strengths: ['reasoning', 'code', 'analysis'], speedProfile: 'balanced', claudeComparison: 'Between Sonnet and Opus' },
  { id: 'mistral-large-3:675b-cloud', name: 'Mistral Large 3 675B',  provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Strong multilingual reasoning and coding.', strengths: ['multilingual', 'reasoning', 'code'], speedProfile: 'balanced', claudeComparison: 'Between Sonnet and Opus' },
  { id: 'glm-5.3:cloud',              name: 'GLM-5.3',               provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Strong bilingual reasoning and coding.', strengths: ['bilingual', 'reasoning', 'code'], speedProfile: 'balanced', claudeComparison: 'Between Sonnet and Opus' },
  { id: 'glm-5.2:cloud',              name: 'GLM-5.2',               provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Bilingual model. Tool-calling difficulty noted.', strengths: ['bilingual', 'reasoning'], speedProfile: 'balanced', claudeComparison: 'Tool-calling difficulty noted' },
  { id: 'glm-5.1:cloud',              name: 'GLM-5.1',               provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Efficient bilingual model.', strengths: ['bilingual', 'general tasks'], speedProfile: 'balanced', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'glm-5.3-flash:cloud',        name: 'GLM-5.3 Flash',         provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Fast bilingual model for quick tasks.', strengths: ['fast responses', 'general tasks'], speedProfile: 'fast', claudeComparison: 'Comparable to Haiku' },
  { id: 'kimi-k3:cloud',              name: 'Kimi K3',               provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'frontier', description: 'Frontier model for deep reasoning and complex tasks.', strengths: ['deep reasoning', 'complex tasks'], speedProfile: 'slow', claudeComparison: 'Approaches Opus for complex tasks' },
  { id: 'kimi-k2.6:cloud',            name: 'Kimi K2.6',             provider: 'ollama-cloud', category: 'thinking', contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Extended thinking with strong reasoning chains.', strengths: ['logical reasoning', 'math', 'planning'], speedProfile: 'slow', claudeComparison: 'Comparable to Sonnet for reasoning' },
  { id: 'kimi-k2.7-code:cloud',       name: 'Kimi K2.7 Code',        provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Code-specialized Kimi variant.', strengths: ['code generation', 'debugging'], speedProfile: 'balanced', claudeComparison: 'Comparable to Sonnet for coding' },
  { id: 'minimax-m3:cloud',           name: 'MiniMax M3',            provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Balanced general-purpose model.', strengths: ['general tasks', 'conversation'], speedProfile: 'balanced', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'minimax-m2.7:cloud',         name: 'MiniMax M2.7',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Efficient general-purpose model.', strengths: ['general tasks', 'quick responses'], speedProfile: 'fast', claudeComparison: 'Comparable to Haiku' },
  { id: 'gemma4:31b-cloud',           name: 'Gemma 4 31B',           provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: "Google's efficient model. Good code understanding.", strengths: ['code understanding', 'general tasks'], speedProfile: 'fast', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'nemotron-3-ultra:cloud',     name: 'Nemotron 3 Ultra',      provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'frontier', description: "NVIDIA's frontier model for deep reasoning.", strengths: ['deep reasoning', 'complex tasks'], speedProfile: 'slow', claudeComparison: 'Approaches Opus' },
  { id: 'nemotron-3-super:cloud',     name: 'Nemotron 3 Super',      provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: "NVIDIA's strong general-purpose model.", strengths: ['reasoning', 'general tasks'], speedProfile: 'balanced', claudeComparison: 'Between Sonnet and Opus' },
  { id: 'nemotron-3-nano:30b-cloud',  name: 'Nemotron 3 Nano 30B',   provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'efficient', description: "NVIDIA's efficient model. Good for simple tasks.", strengths: ['simple tasks', 'fast inference'], speedProfile: 'fast', claudeComparison: 'Below Haiku, optimized for speed' },
  { id: 'gpt-oss:120b-cloud',         name: 'GPT OSS 120B',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Open-source GPT variant. Strong reasoning.', strengths: ['reasoning', 'general tasks', 'code'], speedProfile: 'balanced', claudeComparison: 'Comparable to Sonnet' },
  { id: 'gpt-oss:20b-cloud',          name: 'GPT OSS 20B',           provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'efficient', description: 'Lightweight GPT variant. Fast inference.', strengths: ['quick tasks', 'simple code'], speedProfile: 'fast', claudeComparison: 'Below Haiku, very fast' },
]

export const CODEX_MODELS: ModelCatalogEntry[] = [
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    provider: 'openai-codex',
    category: 'coding',
    family: 'OpenAI Codex',
    contextWindow: 192000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'frontier',
    description: 'Latest frontier agentic coding model.',
    speedProfile: 'balanced',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    provider: 'openai-codex',
    category: 'coding',
    family: 'OpenAI Codex',
    contextWindow: 192000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'expert',
    description: 'Balanced agentic coding model for everyday work.',
    speedProfile: 'balanced',
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    provider: 'openai-codex',
    category: 'coding',
    family: 'OpenAI Codex',
    contextWindow: 192000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'capable',
    description: 'Fast and affordable agentic coding model.',
    speedProfile: 'fast',
  },
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    provider: 'openai-codex',
    category: 'coding',
    family: 'OpenAI Codex',
    contextWindow: 192000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'frontier',
    description: 'Frontier model for complex coding, research, and real-world work.',
    speedProfile: 'balanced',
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai-codex',
    category: 'coding',
    family: 'OpenAI Codex',
    contextWindow: 192000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'expert',
    description: 'Strong model for everyday coding.',
    speedProfile: 'balanced',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openai-codex',
    category: 'coding',
    family: 'OpenAI Codex',
    contextWindow: 192000,
    available: true,
    supportsEffort: true,
    capabilityTier: 'efficient',
    description: 'Small, fast, and cost-efficient model for simpler coding tasks.',
    speedProfile: 'fast',
  },
]

export const EFFORT_LEVELS = ['high', 'medium', 'low'] as const

export const EFFORT_LABELS: Record<string, string> = {
  high: 'High — deep reasoning, slower',
  medium: 'Medium — balanced',
  low: 'Low — fast, lighter reasoning'
}

export const TIER_LABELS: Record<string, string> = {
  frontier: 'Frontier',
  expert: 'Expert',
  capable: 'Capable',
  efficient: 'Efficient'
}

export const TIER_COLORS: Record<string, string> = {
  frontier: 'text-purple-400',
  expert: 'text-blue-400',
  capable: 'text-teal-400',
  efficient: 'text-gray-400'
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
