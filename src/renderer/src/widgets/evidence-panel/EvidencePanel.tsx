import { useState } from 'react'
import type { HealthAnomaly, EscalationTier } from '@shared/types/health.types'

interface EvidencePanelProps {
  agentId: string
  agentName: string
  anomalies: HealthAnomaly[]
  pausedAt: number
  onResume: () => void
  onKill: () => void
  onRestart: (modifiedPrompt: string) => void
  onDismiss: (anomalyId: string) => void
}

const TIER_COLORS: Record<EscalationTier, string> = {
  yellow: 'badge-warning',
  orange: 'badge-accent',
  red: 'badge-error'
}

const ANOMALY_LABELS: Record<string, string> = {
  loop: 'Loop Detected',
  overtime: 'Overtime',
  error_spiral: 'Error Spiral',
  scope_creep: 'Scope Creep'
}

function formatElapsed(pausedAt: number): string {
  const elapsedMs = Date.now() - pausedAt
  const seconds = Math.floor(elapsedMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export default function EvidencePanel({
  agentName,
  anomalies,
  pausedAt,
  onResume,
  onKill,
  onRestart,
  onDismiss
}: EvidencePanelProps): React.JSX.Element {
  const [restartPrompt, setRestartPrompt] = useState('')
  const hasRedTier = anomalies.some((a) => a.tier === 'red')

  return (
    <section
      role="region"
      aria-label="Evidence Panel"
      className="panel-glass p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{agentName}</h3>
        <span className="text-xs opacity-60">Paused {formatElapsed(pausedAt)} ago</span>
      </div>

      <div className="space-y-2">
        {anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            data-testid={`evidence-entry-${anomaly.id}`}
            className="border border-base-300 rounded-lg p-2 space-y-1"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {ANOMALY_LABELS[anomaly.type] ?? anomaly.type}
                </span>
                <span
                  data-testid={`tier-badge-${anomaly.id}`}
                  className={`badge badge-xs ${TIER_COLORS[anomaly.tier]}`}
                >
                  {anomaly.tier}
                </span>
              </div>
              <button
                data-testid={`evidence-dismiss-${anomaly.id}`}
                onClick={() => onDismiss(anomaly.id)}
                className="btn btn-ghost btn-xs"
                aria-label={`Dismiss ${anomaly.type} anomaly`}
              >
                ✕
              </button>
            </div>
            <p className="text-sm opacity-80">{anomaly.message}</p>
            {Object.keys(anomaly.details).length > 0 && (
              <div className="text-xs opacity-60 font-mono">
                {Object.entries(anomaly.details).map(([key, val]) => (
                  <span key={key} className="mr-2">
                    {key}: {String(val)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          data-testid="evidence-restart-input"
          type="text"
          value={restartPrompt}
          onChange={(e) => setRestartPrompt(e.target.value)}
          placeholder="Modified prompt for restart..."
          className="input input-bordered input-sm flex-1"
        />
      </div>

      <div className="flex gap-2">
        <button
          data-testid="evidence-btn-resume"
          onClick={onResume}
          disabled={hasRedTier}
          className="btn btn-success btn-sm"
        >
          Resume
        </button>
        <button
          data-testid="evidence-btn-kill"
          onClick={onKill}
          className="btn btn-error btn-sm"
        >
          Kill
        </button>
        <button
          data-testid="evidence-btn-restart"
          onClick={() => onRestart(restartPrompt)}
          className="btn btn-warning btn-sm"
        >
          Restart
        </button>
      </div>
    </section>
  )
}
