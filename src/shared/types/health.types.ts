import type { GuardrailConfig } from './config.types'

export type EscalationTier = 'yellow' | 'orange' | 'red'

export type AnomalyType = 'loop' | 'overtime' | 'error_spiral' | 'scope_creep'

export interface HealthAnomaly {
  id: string
  agentId: string
  type: AnomalyType
  tier: EscalationTier
  message: string
  details: Record<string, unknown>
  detectedAt: number
}

export interface AgentHealthSnapshot {
  agentId: string
  filesModified: Map<string, number> // filename -> modification count
  totalFilesChanged: number
  consecutiveErrors: number
  startedAt: number
  lastActivityAt: number
  anomalies: HealthAnomaly[]
}

export interface HealthMonitorCallbacks {
  onAnomaly: (anomaly: HealthAnomaly) => void
  getGuardrails: (agentId: string) => GuardrailConfig
  logWarning: (message: string, meta?: Record<string, unknown>) => void
}
