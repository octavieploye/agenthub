export type ModelCategory = 'thinking' | 'coding' | 'mixed'

export type EffortLevel = 'high' | 'medium' | 'low'

export type ModelProvider = 'anthropic' | 'ollama-local' | 'ollama-cloud'

export interface ModelCatalogEntry {
  id: string
  name: string
  provider: ModelProvider
  category: ModelCategory
  contextWindow: number
  available: boolean
  unavailableReason?: string
  supportsEffort?: boolean
}
