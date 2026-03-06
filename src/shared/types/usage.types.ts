export type SubscriptionPlan = 'pro' | 'max5' | 'max20' | 'custom'

export interface PlanLimits {
  name: SubscriptionPlan
  label: string
  tokenLimit: number
  messageLimit: number
}

export interface ModelUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  messageCount: number
}

export interface UsageSnapshot {
  plan: SubscriptionPlan
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  totalMessages: number
  byModel: Map<string, ModelUsage>
  burnRate: number
  lastUpdated: string
  resetDate: string
}

export interface SessionEntry {
  type: 'user' | 'assistant'
  timestamp: string
  sessionId: string
  message: {
    role: string
    model?: string
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}
