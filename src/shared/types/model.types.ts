export type ModelCategory = 'thinking' | 'coding' | 'mixed'

export type EffortLevel = 'high' | 'medium' | 'low'

export type ModelProvider = 'anthropic' | 'ollama-local' | 'ollama-cloud'

export type CapabilityTier = 'frontier' | 'expert' | 'capable' | 'efficient'

export type SpeedProfile = 'fast' | 'balanced' | 'slow'

export interface ModelCatalogEntry {
  id: string
  name: string
  provider: ModelProvider
  category: ModelCategory
  family?: string
  contextWindow: number
  available: boolean
  unavailableReason?: string
  supportsEffort?: boolean
  capabilityTier?: CapabilityTier
  description?: string
  strengths?: string[]
  speedProfile?: SpeedProfile
  claudeComparison?: string
}
