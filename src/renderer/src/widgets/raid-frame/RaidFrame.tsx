import { useState, useEffect } from 'react'
import type { AgentState, VoiceMode } from '@shared/types/agent.types'
import HeartbeatWaveform from '@renderer/widgets/heartbeat-waveform/HeartbeatWaveform'
import CooldownTimer from '@renderer/widgets/cooldown-timer/CooldownTimer'
import { useNow } from '@renderer/hooks/useNow'
import { useSettledStatus } from '@renderer/hooks/use-settled-status'

const DEFAULT_MAX_DURATION_MS = 30 * 60 * 1000

const VOICE_MODE_CYCLE: VoiceMode[] = ['off', 'speak_up', 'always_on']
const VOICE_MODE_ICON: Record<VoiceMode, string> = {
  off: '🔇',
  speak_up: '🔈',
  always_on: '🔊',
}
const VOICE_MODE_LABEL: Record<VoiceMode, string> = {
  off: 'Voice off',
  speak_up: 'Speak up',
  always_on: 'Always on',
}

interface RaidFrameProps {
  agent: AgentState
  onSelect: (agentId: string) => void
  onContextMenu: (agentId: string, position: { x: number; y: number }) => void
  onToggleVoiceMode?: (agentId: string, mode: VoiceMode) => void
  onToggleTelegramNotify?: (agentId: string, enabled: boolean) => void
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  spawning: 'bg-amber-400',
  busy: 'bg-success',
  idle: 'bg-base-content/60',
  locked: 'bg-warning',
  completed: 'bg-success/50',
  awaiting_approval: 'bg-warning',
  looping: 'bg-error animate-urgency-pulse',
  paused: 'bg-amber-400',
  interrupted: 'bg-error',
  tray_running: 'bg-success/50'
}

function getRaidGlowClass(status: string): string {
  switch (status) {
    case 'locked':
      return 'glow-ring'
    case 'awaiting_approval':
    case 'error':
    case 'looping':
      return 'glow-blip-fast'
    default:
      return ''
  }
}

function getRaidGlowColor(status: string, agentColor: string): string {
  if (status === 'error' || status === 'looping') return 'oklch(0.62 0.16 15)'
  return agentColor
}

function RaidFrame({ agent, onSelect, onContextMenu, onToggleVoiceMode, onToggleTelegramNotify }: RaidFrameProps): React.JSX.Element {
  const repoLabel = agent.cwd.split('/').pop() ?? 'unknown'
  const isTicking = agent.status === 'busy' || agent.status === 'locked'
  const now = useNow(isTicking ? 1000 : 0)
  const elapsed = now - new Date(agent.createdAt).getTime()
  const remaining = Math.max(0, DEFAULT_MAX_DURATION_MS - elapsed)

  const [notifQueued, setNotifQueued] = useState(0)

  useEffect(() => {
    if (!agent.telegramNotify) return
    const check = (): void => {
      window.agentHub.telegram.getNotificationStats(agent.id).then(stats => {
        setNotifQueued(stats.queued)
      }).catch(() => {})
    }
    check()
    const interval = setInterval(check, 10_000)
    return () => clearInterval(interval)
  }, [agent.id, agent.telegramNotify])

  const settledStatus = useSettledStatus(agent.status)
  const glowClass = getRaidGlowClass(settledStatus)
  const glowColor = getRaidGlowColor(settledStatus, agent.color)

  return (
    <div
      data-testid="raid-frame"
      className={`panel-glass relative p-2 w-[160px] h-[96px] flex flex-col gap-1 cursor-pointer hover:bg-base-content/5 transition-colors overflow-hidden border-l-[3px] ${glowClass}`}
      style={{
        borderLeftColor: agent.color,
        // Static ambient shadow when idle/busy; keyframe animation owns box-shadow when glowing
        ...(glowClass ? { '--glow-color': glowColor } as React.CSSProperties : { boxShadow: `0 0 12px ${agent.color}20` }),
      }}
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
        {onToggleVoiceMode && (
          <button
            data-testid="voice-mode-toggle"
            title={VOICE_MODE_LABEL[agent.voiceMode ?? 'off']}
            className="text-[10px] opacity-50 hover:opacity-100 transition-opacity leading-none"
            onClick={(e) => {
              e.stopPropagation()
              const current: VoiceMode = agent.voiceMode ?? 'off'
              const idx = VOICE_MODE_CYCLE.indexOf(current)
              const next = VOICE_MODE_CYCLE[(idx + 1) % VOICE_MODE_CYCLE.length]
              onToggleVoiceMode(agent.id, next)
            }}
          >
            {VOICE_MODE_ICON[agent.voiceMode ?? 'off']}
          </button>
        )}
        {onToggleTelegramNotify && (
          <button
            data-testid="telegram-notify-toggle"
            title={agent.telegramNotify ? 'Telegram on' : 'Telegram off'}
            className={`text-[10px] ${agent.telegramNotify ? 'opacity-100 text-info' : 'opacity-50'} hover:opacity-100 transition-opacity leading-none`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleTelegramNotify(agent.id, !agent.telegramNotify)
            }}
          >
            ✈
          </button>
        )}
        {notifQueued > 0 && (
          <span
            data-testid="telegram-notif-badge"
            className="inline-block w-2 h-2 rounded-full bg-warning ml-1"
            title={`${notifQueued} notification${notifQueued > 1 ? 's' : ''} pending`}
          />
        )}
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
