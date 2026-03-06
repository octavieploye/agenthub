import type {
  HealthAnomaly,
  AgentHealthSnapshot,
  HealthMonitorCallbacks,
  AnomalyType,
  EscalationTier
} from '@shared/types/health.types'

let idCounter = 0
function generateId(): string {
  idCounter += 1
  return `anomaly-${Date.now()}-${idCounter}`
}

const LOOP_THRESHOLDS: { min: number; tier: EscalationTier }[] = [
  { min: 8, tier: 'red' },
  { min: 5, tier: 'orange' },
  { min: 3, tier: 'yellow' }
]

const OVERTIME_THRESHOLDS: { multiplier: number; tier: EscalationTier }[] = [
  { multiplier: 2.0, tier: 'red' },
  { multiplier: 1.5, tier: 'orange' },
  { multiplier: 1.0, tier: 'yellow' }
]

const ERROR_MULTIPLIERS: { multiplier: number; tier: EscalationTier }[] = [
  { multiplier: 3, tier: 'red' },
  { multiplier: 2, tier: 'orange' },
  { multiplier: 1, tier: 'yellow' }
]

const SCOPE_MULTIPLIERS: { multiplier: number; tier: EscalationTier }[] = [
  { multiplier: 2.0, tier: 'red' },
  { multiplier: 1.5, tier: 'orange' },
  { multiplier: 1.0, tier: 'yellow' }
]

export class HealthMonitor {
  private snapshots = new Map<string, AgentHealthSnapshot>()
  private reportedAnomalies = new Map<string, Set<string>>() // agentId -> Set<"type:tier">
  private callbacks: HealthMonitorCallbacks
  private watchdogInterval: ReturnType<typeof setInterval> | null = null

  constructor(callbacks: HealthMonitorCallbacks) {
    this.callbacks = callbacks
  }

  registerAgent(agentId: string): void {
    const now = Date.now()
    this.snapshots.set(agentId, {
      agentId,
      filesModified: new Map(),
      totalFilesChanged: 0,
      consecutiveErrors: 0,
      startedAt: now,
      lastActivityAt: now,
      anomalies: []
    })
    this.reportedAnomalies.set(agentId, new Set())
  }

  unregisterAgent(agentId: string): void {
    this.snapshots.delete(agentId)
    this.reportedAnomalies.delete(agentId)
  }

  getSnapshot(agentId: string): AgentHealthSnapshot | null {
    return this.snapshots.get(agentId) ?? null
  }

  recordFileModification(agentId: string, filePath: string): void {
    const snapshot = this.snapshots.get(agentId)
    if (!snapshot) return

    const current = snapshot.filesModified.get(filePath) ?? 0
    snapshot.filesModified.set(filePath, current + 1)
    snapshot.totalFilesChanged = snapshot.filesModified.size
    snapshot.lastActivityAt = Date.now()
  }

  recordError(agentId: string, _errorMessage: string): void {
    const snapshot = this.snapshots.get(agentId)
    if (!snapshot) return

    snapshot.consecutiveErrors += 1
    snapshot.lastActivityAt = Date.now()
  }

  clearError(agentId: string): void {
    const snapshot = this.snapshots.get(agentId)
    if (!snapshot) return

    snapshot.consecutiveErrors = 0
  }

  checkAgent(agentId: string): HealthAnomaly[] {
    const snapshot = this.snapshots.get(agentId)
    if (!snapshot) return []

    const guardrails = this.callbacks.getGuardrails(agentId)
    const anomalies: HealthAnomaly[] = []

    // Loop detection
    for (const [filePath, count] of snapshot.filesModified) {
      for (const threshold of LOOP_THRESHOLDS) {
        if (count >= threshold.min) {
          anomalies.push(this.createAnomaly(agentId, 'loop', threshold.tier,
            `File ${filePath} modified ${count} times`,
            { filePath, modificationCount: count }
          ))
          break
        }
      }
    }

    // Overtime detection
    const elapsedMs = Date.now() - snapshot.startedAt
    const maxMs = guardrails.maxDurationMinutes * 60 * 1000
    if (maxMs > 0) {
      const ratio = elapsedMs / maxMs
      for (const threshold of OVERTIME_THRESHOLDS) {
        if (ratio >= threshold.multiplier) {
          const elapsedMin = Math.round(elapsedMs / 60000)
          anomalies.push(this.createAnomaly(agentId, 'overtime', threshold.tier,
            `Agent running for ${elapsedMin}min (limit: ${guardrails.maxDurationMinutes}min)`,
            { elapsedMinutes: elapsedMin, maxMinutes: guardrails.maxDurationMinutes, ratio }
          ))
          break
        }
      }
    }

    // Error spiral detection
    const maxErrors = guardrails.maxConsecutiveErrors
    if (snapshot.consecutiveErrors >= maxErrors) {
      for (const threshold of ERROR_MULTIPLIERS) {
        if (snapshot.consecutiveErrors >= maxErrors * threshold.multiplier) {
          anomalies.push(this.createAnomaly(agentId, 'error_spiral', threshold.tier,
            `${snapshot.consecutiveErrors} consecutive errors (limit: ${maxErrors})`,
            { consecutiveErrors: snapshot.consecutiveErrors, maxConsecutiveErrors: maxErrors }
          ))
          break
        }
      }
    }

    // Scope creep detection
    const maxFiles = guardrails.maxFilesChanged
    if (snapshot.totalFilesChanged >= maxFiles) {
      for (const threshold of SCOPE_MULTIPLIERS) {
        if (snapshot.totalFilesChanged >= maxFiles * threshold.multiplier) {
          anomalies.push(this.createAnomaly(agentId, 'scope_creep', threshold.tier,
            `${snapshot.totalFilesChanged} files changed (limit: ${maxFiles})`,
            { totalFilesChanged: snapshot.totalFilesChanged, maxFilesChanged: maxFiles }
          ))
          break
        }
      }
    }

    // Fire callbacks for new anomalies only
    const reported = this.reportedAnomalies.get(agentId) ?? new Set()
    for (const anomaly of anomalies) {
      const key = `${anomaly.type}:${anomaly.tier}`
      if (!reported.has(key)) {
        reported.add(key)
        this.callbacks.onAnomaly(anomaly)
        this.callbacks.logWarning(anomaly.message, { agentId, type: anomaly.type, tier: anomaly.tier })
      }
    }
    this.reportedAnomalies.set(agentId, reported)

    snapshot.anomalies = anomalies
    return anomalies
  }

  startWatchdog(intervalMs = 10000): void {
    this.stopWatchdog()
    this.watchdogInterval = setInterval(() => {
      for (const agentId of this.snapshots.keys()) {
        this.checkAgent(agentId)
      }
    }, intervalMs)
  }

  stopWatchdog(): void {
    if (this.watchdogInterval !== null) {
      clearInterval(this.watchdogInterval)
      this.watchdogInterval = null
    }
  }

  private createAnomaly(
    agentId: string,
    type: AnomalyType,
    tier: EscalationTier,
    message: string,
    details: Record<string, unknown>
  ): HealthAnomaly {
    return {
      id: generateId(),
      agentId,
      type,
      tier,
      message,
      details,
      detectedAt: Date.now()
    }
  }
}
