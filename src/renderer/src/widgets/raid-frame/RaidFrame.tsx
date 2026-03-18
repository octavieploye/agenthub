import type { AgentState } from '@shared/types/agent.types'
import HeartbeatWaveform from '@renderer/widgets/heartbeat-waveform/HeartbeatWaveform'
import CooldownTimer from '@renderer/widgets/cooldown-timer/CooldownTimer'
import { useNow } from '@renderer/hooks/useNow'

const DEFAULT_MAX_DURATION_MS = 30 * 60 * 1000

interface RaidFrameProps {
  agent: AgentState
  onSelect: (agentId: string) => void
  onContextMenu: (agentId: string, position: { x: number; y: number }) => void
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  spawning: 'bg-info animate-pulse',
  busy: 'bg-success',
  idle: 'bg-base-content/60',
  locked: 'bg-warning animate-breathe',
  completed: 'bg-info',
  looping: 'bg-error animate-urgency-pulse',
  paused: 'bg-amber-400',
  interrupted: 'bg-error',
  tray_running: 'bg-success/50'
}

function RaidFrame({ agent, onSelect, onContextMenu }: RaidFrameProps): React.JSX.Element {
  const repoLabel = agent.cwd.split('/').pop() ?? 'unknown'
  const isTicking = agent.status === 'busy' || agent.status === 'locked'
  const now = useNow(isTicking ? 1000 : 0)
  const elapsed = now - new Date(agent.createdAt).getTime()
  const remaining = Math.max(0, DEFAULT_MAX_DURATION_MS - elapsed)

  return (
    <div
      data-testid="raid-frame"
      className="panel-glass p-2 w-[160px] h-[96px] flex flex-col gap-1 cursor-pointer hover:bg-base-content/5 transition-colors overflow-hidden border-l-[3px]"
      style={{ borderLeftColor: agent.color, boxShadow: `0 0 12px ${agent.color}20` }}
      onClick={() => onSelect(agent.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(agent.id, { x: e.clientX, y: e.clientY })
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          data-testid="status-dot"
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            STATUS_DOT_CLASSES[agent.status] ?? 'bg-base-content/30'
          }`}
        />
        <span
          data-testid="confidence-indicator"
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
            agent.confidence === 'inferred'
              ? 'bg-current animate-pulse'
              : agent.confidence === 'unknown'
                ? 'bg-base-content/20'
                : 'bg-current'
          }`}
        />
        <span className="text-xs font-medium truncate flex-1">{agent.name}</span>
      </div>

      <div className="flex items-center gap-1">
        <span
          data-testid="model-badge"
          className="text-[11px] px-1 py-0.5 rounded bg-base-content/15 text-base-content/60 truncate"
        >
          {agent.model}
        </span>
        <span
          data-testid="repo-label"
          className="text-[11px] text-base-content/60 truncate"
        >
          {repoLabel}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <HeartbeatWaveform status={agent.status} height={24} />
        </div>
        {isTicking && (
          <CooldownTimer
            remainingMs={remaining}
            totalMs={DEFAULT_MAX_DURATION_MS}
            size="sm"
            label="Guardrail timer"
          />
        )}
      </div>

      <p
        data-testid="task-description"
        className="text-[11px] text-base-content/60 truncate"
      >
        {agent.taskDescription}
      </p>
    </div>
  )
}

export default RaidFrame
