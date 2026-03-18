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
  { id: 'kimi-k2-thinking:cloud',     name: 'Kimi K2 Thinking',      provider: 'ollama-cloud', category: 'thinking', contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Extended thinking with strong reasoning chains.', strengths: ['logical reasoning', 'math', 'planning'], speedProfile: 'slow', claudeComparison: 'Comparable to Sonnet for reasoning' },
  { id: 'kimi-k2.5:cloud',            name: 'Kimi K2.5',             provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Balanced reasoning and coding.', strengths: ['reasoning', 'code', 'general'], speedProfile: 'balanced', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'kimi-k2:1t-cloud',           name: 'Kimi K2 1T',            provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'frontier', description: 'Massive 1T parameter model. Deep reasoning.', strengths: ['deep reasoning', 'complex tasks', 'analysis'], speedProfile: 'slow', claudeComparison: 'Approaches Opus for complex tasks' },
  { id: 'mistral-large-3:675b-cloud', name: 'Mistral Large 3 675B',  provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Strong multilingual reasoning and coding.', strengths: ['multilingual', 'reasoning', 'code'], speedProfile: 'balanced', claudeComparison: 'Between Sonnet and Opus' },
  { id: 'devstral-2:123b-cloud',      name: 'Devstral 2 123B',       provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Specialized code generation and debugging.', strengths: ['code generation', 'debugging', 'refactoring'], speedProfile: 'balanced', claudeComparison: 'Comparable to Sonnet for coding' },
  { id: 'devstral-small-2:24b-cloud', name: 'Devstral Small 2 24B',  provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Lightweight code assistant.', strengths: ['code generation', 'quick fixes'], speedProfile: 'fast', claudeComparison: 'Between Haiku and Sonnet for coding' },
  { id: 'qwen3-coder:480b-cloud',     name: 'Qwen3 Coder 480B',      provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'frontier', description: 'Top-tier code specialist. Multi-language mastery.', strengths: ['code generation', 'multi-language', 'architecture'], speedProfile: 'slow', claudeComparison: 'Matches Opus for pure coding' },
  { id: 'qwen3.5:397b-cloud',         name: 'Qwen3.5 397B',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Strong general-purpose with coding focus.', strengths: ['reasoning', 'code', 'analysis'], speedProfile: 'balanced', claudeComparison: 'Between Sonnet and Opus' },
  { id: 'qwen3-coder-next:q8_0',      name: 'Qwen3 Coder Next Q8',   provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Next-gen code model with improved reasoning.', strengths: ['code generation', 'reasoning', 'debugging'], speedProfile: 'balanced', claudeComparison: 'Comparable to Sonnet for coding' },
  { id: 'qwen3-vl:235b-instruct-cloud', name: 'Qwen3 VL 235B',      provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Vision-language model. Understands images and code.', strengths: ['vision', 'multimodal', 'code'], speedProfile: 'balanced', claudeComparison: 'Sonnet-level with vision capability' },
  { id: 'qwen3-next:80b-cloud',       name: 'Qwen3 Next 80B',        provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Efficient general-purpose model.', strengths: ['general tasks', 'code', 'reasoning'], speedProfile: 'fast', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'gpt-oss:120b-cloud',         name: 'GPT OSS 120B',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Open-source GPT variant. Strong reasoning.', strengths: ['reasoning', 'general tasks', 'code'], speedProfile: 'balanced', claudeComparison: 'Comparable to Sonnet' },
  { id: 'gpt-oss:20b-cloud',          name: 'GPT OSS 20B',           provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'efficient', description: 'Lightweight GPT variant. Fast inference.', strengths: ['quick tasks', 'simple code'], speedProfile: 'fast', claudeComparison: 'Below Haiku, very fast' },
  { id: 'gemma3:27b-cloud',           name: 'Gemma3 27B',            provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: "Google's efficient model. Good code understanding.", strengths: ['code understanding', 'general tasks'], speedProfile: 'fast', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'gemini-3-flash-preview:cloud', name: 'Gemini 3 Flash Preview', provider: 'ollama-cloud', category: 'mixed', contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: "Google's fast inference model.", strengths: ['fast responses', 'general tasks', 'code'], speedProfile: 'fast', claudeComparison: 'Comparable to Haiku' },
  { id: 'cogito-2.1:671b-cloud',      name: 'Cogito 2.1 671B',       provider: 'ollama-cloud', category: 'thinking', contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'frontier', description: 'Deep thinking specialist. Extended reasoning.', strengths: ['deep reasoning', 'math', 'complex analysis'], speedProfile: 'slow', claudeComparison: 'Approaches Opus for reasoning' },
  { id: 'minimax-m2.5:cloud',         name: 'MiniMax M2.5',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Balanced general-purpose model.', strengths: ['general tasks', 'conversation'], speedProfile: 'balanced', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'minimax-m2:cloud',           name: 'MiniMax M2',            provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Efficient general-purpose.', strengths: ['general tasks', 'quick responses'], speedProfile: 'fast', claudeComparison: 'Comparable to Haiku' },
  { id: 'minimax-m2.1:cloud',         name: 'MiniMax M2.1',          provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Improved general-purpose model.', strengths: ['general tasks', 'reasoning'], speedProfile: 'balanced', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'glm-5:cloud',                name: 'GLM-5',                 provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Strong Chinese-English bilingual model.', strengths: ['bilingual', 'reasoning', 'code'], speedProfile: 'balanced', claudeComparison: 'Between Sonnet and Opus' },
  { id: 'glm-4.7:cloud',              name: 'GLM-4.7',               provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'capable', description: 'Efficient bilingual model.', strengths: ['bilingual', 'general tasks'], speedProfile: 'fast', claudeComparison: 'Between Haiku and Sonnet' },
  { id: 'nemotron-3-nano:30b-cloud',  name: 'Nemotron 3 Nano 30B',   provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'efficient', description: "NVIDIA's efficient model. Good for simple tasks.", strengths: ['simple tasks', 'fast inference'], speedProfile: 'fast', claudeComparison: 'Below Haiku, optimized for speed' },
  { id: 'deepseek-v3.2:cloud',        name: 'DeepSeek V3.2',         provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, supportsEffort: false, capabilityTier: 'expert', description: 'Strong coding and reasoning model.', strengths: ['code generation', 'reasoning', 'debugging'], speedProfile: 'balanced', claudeComparison: 'Comparable to Sonnet' },
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
