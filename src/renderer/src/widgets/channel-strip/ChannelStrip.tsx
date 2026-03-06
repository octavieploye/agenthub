import type { AgentState } from '@shared/types/agent.types'
import HeartbeatWaveform from '@renderer/widgets/heartbeat-waveform/HeartbeatWaveform'
import CooldownTimer from '@renderer/widgets/cooldown-timer/CooldownTimer'
import { useNow } from '@renderer/hooks/useNow'

const DEFAULT_MAX_DURATION_MS = 30 * 60 * 1000

const STATUS_DOT_CLASSES: Record<string, string> = {
  spawning: 'bg-info animate-pulse',
  busy: 'bg-success',
  idle: 'bg-base-content/40',
  locked: 'bg-warning animate-breathe',
  completed: 'bg-info',
  looping: 'bg-error animate-urgency-pulse',
  paused: 'bg-amber-400',
  interrupted: 'bg-error',
  tray_running: 'bg-success/50'
}

interface ChannelStripProps {
  agent: AgentState
  onSelect: (agentId: string) => void
  onSolo: (agentId: string) => void
  onMute: (agentId: string) => void
  onKill: (agentId: string) => void
  isSoloed?: boolean
  isMuted?: boolean
  isDimmed?: boolean
}

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}h ${remainMinutes}m`
}

function ChannelStrip({
  agent,
  onSelect,
  onSolo,
  onMute,
  onKill,
  isSoloed = false,
  isMuted = false,
  isDimmed = false
}: ChannelStripProps): React.JSX.Element {
  const repoLabel = agent.cwd.split('/').pop() ?? 'unknown'
  const isTicking = agent.status === 'busy' || agent.status === 'locked'
  const now = useNow(isTicking ? 1000 : 0)
  const elapsed = now - new Date(agent.createdAt).getTime()
  const remaining = Math.max(0, DEFAULT_MAX_DURATION_MS - elapsed)

  return (
    <div
      data-testid="channel-strip"
      className={`panel-glass w-[120px] h-full shrink-0 flex flex-col gap-1 p-2 cursor-pointer transition-all overflow-hidden ${
        isDimmed ? 'opacity-40 dimmed' : ''
      }`}
      onClick={() => onSelect(agent.id)}
    >
      {/* Drag handle header */}
      <div
        data-testid="strip-drag-handle"
        draggable="true"
        className="flex items-center gap-1 cursor-grab"
      >
        <span
          data-testid="strip-status-indicator"
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            STATUS_DOT_CLASSES[agent.status] ?? 'bg-base-content/30'
          }`}
        />
        <span
          data-testid="strip-agent-name"
          className="text-xs font-medium truncate flex-1"
        >
          {agent.name}
        </span>
      </div>

      {/* Solo / Mute / Kill controls */}
      <div className="flex items-center gap-1">
        <button
          data-testid="solo-button"
          className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors ${
            isSoloed ? 'bg-primary text-primary-content' : 'bg-base-content/10 text-base-content/50 hover:bg-base-content/20'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onSolo(agent.id)
          }}
        >
          S
        </button>
        <button
          data-testid="mute-button"
          className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors ${
            isMuted ? 'bg-warning text-warning-content' : 'bg-base-content/10 text-base-content/50 hover:bg-base-content/20'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onMute(agent.id)
          }}
        >
          M
        </button>
        <div className="flex-1" />
        <button
          data-testid="strip-kill-button"
          className="text-[9px] px-1 py-0.5 rounded text-error hover:bg-error/20 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onKill(agent.id)
          }}
        >
          X
        </button>
      </div>

      {/* Model + Repo */}
      <div className="flex items-center gap-1">
        <span
          data-testid="strip-model-badge"
          className="text-[8px] px-1 py-0.5 rounded bg-base-content/10 text-base-content/50 truncate"
        >
          {agent.model}
        </span>
        <span
          data-testid="strip-repo-label"
          className="text-[8px] text-base-content/40 truncate"
        >
          {repoLabel}
        </span>
      </div>

      {/* Activity meter (waveform) */}
      <div data-testid="activity-meter" className="flex-1 min-h-0">
        <HeartbeatWaveform status={agent.status} height={28} />
      </div>

      {/* Progress bar */}
      <div data-testid="strip-progress-bar" className="w-full h-1 rounded-full bg-base-content/10">
        <div
          data-testid="strip-progress-fill"
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round(agent.progress * 100)}%` }}
        />
      </div>

      {/* Cooldown timer for active agents */}
      {isTicking && (
        <div className="flex justify-center">
          <CooldownTimer
            remainingMs={remaining}
            totalMs={DEFAULT_MAX_DURATION_MS}
            size="sm"
            label="Guardrail timer"
          />
        </div>
      )}

      {/* Task + Elapsed */}
      <p
        data-testid="strip-task-description"
        className="text-[8px] text-base-content/40 truncate"
      >
        {agent.taskDescription}
      </p>
      <span
        data-testid="strip-elapsed-time"
        className="text-[8px] text-base-content/30"
      >
        {formatElapsed(agent.createdAt)}
      </span>
    </div>
  )
}

export default ChannelStrip
