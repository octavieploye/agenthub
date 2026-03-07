import { useState } from 'react'
import type { AgentState, AgentLifecycleStatus } from '@shared/types/agent.types'
import { useNow } from '@renderer/hooks/useNow'
import { AGENT_COLOR_PALETTE } from '@shared/constants/defaults'
import { useAgentStore } from '@renderer/stores/agent-store'

interface GeneralTabProps {
  agent: AgentState
  onPause: (agentId: string) => void
  onResume: (agentId: string) => void
  onKill: (agentId: string) => void
}

const STATUS_BADGE_CLASSES: Record<AgentLifecycleStatus, string> = {
  spawning: 'badge-info',
  busy: 'badge-warning',
  idle: 'badge-ghost',
  locked: 'badge-error',
  completed: 'badge-success',
  looping: 'badge-error',
  paused: 'badge-info',
  interrupted: 'badge-error',
  tray_running: 'badge-success'
}

const CONFIDENCE_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  inferred: 'Inferred',
  unknown: 'Unknown'
}

function formatRelativeTime(isoDate: string, now: number): string {
  const diff = now - new Date(isoDate).getTime()
  if (diff < 0) return 'just now'

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (hours < 24) {
    return remainMinutes > 0 ? `${hours}h ${remainMinutes}m ago` : `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function truncatePath(path: string, maxLen: number = 50): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  if (parts.length <= 3) return path
  return `.../${parts.slice(-3).join('/')}`
}

function GeneralTab({ agent, onPause, onResume, onKill }: GeneralTabProps): React.JSX.Element {
  const isTicking = agent.status === 'busy' || agent.status === 'spawning'
  const now = useNow(isTicking ? 1000 : 0)
  const [selectedColor, setSelectedColor] = useState(agent.color)
  const updateColor = useAgentStore((s) => s.updateColor)

  const handleColorChange = async (color: string): Promise<void> => {
    setSelectedColor(color)
    updateColor(agent.id, color)
    try {
      await window.agentHub.agents.updateColor(agent.id, color)
    } catch (err) {
      console.error('Update color failed:', err)
    }
  }

  const canPause = agent.status === 'busy' || agent.status === 'idle' || agent.status === 'locked'
  const canResume = agent.status === 'paused'
  const canKill =
    agent.status !== 'completed' && agent.status !== 'interrupted'

  return (
    <div data-testid="general-tab" className="h-full overflow-y-auto p-4 space-y-4">
      {/* Agent identity + status */}
      <div className="panel-glass rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 data-testid="general-agent-name" className="text-lg font-semibold text-base-content">
            {agent.name}
          </h2>
          <span
            data-testid="general-status-badge"
            className={`badge badge-sm ${STATUS_BADGE_CLASSES[agent.status] ?? 'badge-ghost'}`}
          >
            {agent.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-base-content/70">
          <div>
            <span className="text-base-content/40">Model:</span>{' '}
            <span data-testid="general-model">{agent.model}</span>
          </div>
          <div>
            <span className="text-base-content/40">Confidence:</span>{' '}
            <span data-testid="general-confidence">
              {CONFIDENCE_LABELS[agent.confidence] ?? agent.confidence}
            </span>
          </div>
          <div>
            <span className="text-base-content/40">Provider:</span>{' '}
            <span data-testid="general-provider">{agent.provider}</span>
          </div>
          <div>
            <span className="text-base-content/40">Created:</span>{' '}
            <span data-testid="general-created">{formatRelativeTime(agent.createdAt, now)}</span>
          </div>
        </div>

        <div className="text-xs text-base-content/70">
          <span className="text-base-content/40">Repo:</span>{' '}
          <span data-testid="general-cwd" title={agent.cwd}>
            {truncatePath(agent.cwd)}
          </span>
        </div>

        {agent.taskDescription && (
          <div className="text-xs text-base-content/70">
            <span className="text-base-content/40">Task:</span>{' '}
            <span data-testid="general-task">{agent.taskDescription}</span>
          </div>
        )}
      </div>

      {/* Color picker */}
      <div data-testid="color-picker-section" className="panel-glass rounded-lg p-4 space-y-2">
        <h3 className="text-xs font-medium text-base-content/50">Agent Color</h3>
        <div className="flex gap-2 flex-wrap">
          {AGENT_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              data-testid={`color-swatch-${color}`}
              className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                selectedColor === color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      {agent.progress > 0 && (
        <div className="panel-glass rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-base-content/60">
            <span>Progress</span>
            <span data-testid="general-progress-label">{Math.round(agent.progress * 100)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-base-content/10">
            <div
              data-testid="general-progress-fill"
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(agent.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="panel-glass rounded-lg p-4">
        <h3 className="text-xs font-medium text-base-content/50 mb-3">Actions</h3>
        <div className="flex gap-2">
          {canPause && (
            <button
              data-testid="general-pause-button"
              className="btn-lcars btn btn-sm btn-info"
              onClick={() => onPause(agent.id)}
            >
              Pause
            </button>
          )}
          {canResume && (
            <button
              data-testid="general-resume-button"
              className="btn-lcars btn btn-sm btn-success"
              onClick={() => onResume(agent.id)}
            >
              Resume
            </button>
          )}
          {canKill && (
            <button
              data-testid="general-kill-button"
              className="btn-lcars btn btn-sm btn-error"
              onClick={() => onKill(agent.id)}
            >
              Kill
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default GeneralTab
