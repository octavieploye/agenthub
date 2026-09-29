export type ModelCategory = 'thinking' | 'coding' | 'mixed'

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type ModelProvider = 'anthropic' | 'ollama-local' | 'ollama-cloud' | 'openai-codex'

export type CapabilityTier = 'frontier' | 'expert' | 'capable' | 'efficient'

export type SpeedProfile = 'fast' | 'balanced' | 'slow'

export interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

export interface ModelCatalogEntry {
  id: string
  name: string
  provider: ModelProvider
  category: ModelCategory
  family?: string
  contextWindow: number
  maxOutput?: number
  available: boolean
  unavailableReason?: string
  supportsEffort?: boolean
  capabilityTier?: CapabilityTier
  description?: string
  strengths?: string[]
  speedProfile?: SpeedProfile
  claudeComparison?: string
  pricing?: ModelPricing
  thinkingDefault?: EffortLevel
  thinkingAlwaysOn?: boolean
}
