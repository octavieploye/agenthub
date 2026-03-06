import type { HealthAnomaly } from '@shared/types/health.types'

export interface AutoPauseDeps {
  pauseAgent: (agentId: string) => void
  sendNotification: (title: string, body: string) => void
  emitToRenderer: (channel: string, ...args: unknown[]) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
}

export interface PausedAgentInfo {
  agentId: string
  anomalies: HealthAnomaly[]
  pausedAt: number
  reminderSentAt: number | null
}

export class AutoPauseService {
  private paused = new Map<string, PausedAgentInfo>()
  private deps: AutoPauseDeps
  private reminderInterval: ReturnType<typeof setInterval> | null = null

  constructor(deps: AutoPauseDeps) {
    this.deps = deps
  }

  handleAnomaly(anomaly: HealthAnomaly): void {
    const existing = this.paused.get(anomaly.agentId)

    if (existing) {
      existing.anomalies.push(anomaly)
    } else {
      this.deps.pauseAgent(anomaly.agentId)
      this.paused.set(anomaly.agentId, {
        agentId: anomaly.agentId,
        anomalies: [anomaly],
        pausedAt: Date.now(),
        reminderSentAt: null
      })
    }

    this.deps.emitToRenderer('on-agents:paused-by-guardrail', anomaly)
    this.deps.sendNotification(
      `Agent paused - ${anomaly.agentId}`,
      anomaly.message
    )
    this.deps.logWarning(
      `Auto-paused agent ${anomaly.agentId}: ${anomaly.message}`,
      { anomalyId: anomaly.id, type: anomaly.type, tier: anomaly.tier }
    )
  }

  getPausedAgents(): Map<string, PausedAgentInfo> {
    return this.paused
  }

  getPausedAgent(agentId: string): PausedAgentInfo | null {
    return this.paused.get(agentId) ?? null
  }

  resumeAgent(agentId: string): void {
    this.paused.delete(agentId)
  }

  dismissAnomaly(agentId: string, anomalyId: string): void {
    const info = this.paused.get(agentId)
    if (!info) return

    info.anomalies = info.anomalies.filter((a) => a.id !== anomalyId)
    if (info.anomalies.length === 0) {
      this.paused.delete(agentId)
    }
  }

  startReminderTimer(intervalMs = 5 * 60 * 1000): void {
    this.stopReminderTimer()
    this.reminderInterval = setInterval(() => {
      for (const [, info] of this.paused) {
        if (info.reminderSentAt !== null) continue

        this.deps.sendNotification(
          `Reminder: Agent ${info.agentId} still paused`,
          `Agent ${info.agentId} is still paused and awaiting your action.`
        )
        info.reminderSentAt = Date.now()
      }
    }, intervalMs)
  }

  stopReminderTimer(): void {
    if (this.reminderInterval !== null) {
      clearInterval(this.reminderInterval)
      this.reminderInterval = null
    }
  }
}
