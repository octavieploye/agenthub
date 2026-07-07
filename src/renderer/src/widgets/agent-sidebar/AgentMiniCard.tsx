import { useRef, useState, useEffect } from 'react'
import type { AgentState, AgentLifecycleStatus, VoiceMode } from '@shared/types/agent.types'
import { useSettledStatus } from '@renderer/hooks/use-settled-status'

const VOICE_MODE_CYCLE: VoiceMode[] = ['off', 'speak_up', 'always_on']
const VOICE_MODE_ICON: Record<VoiceMode, string> = { off: '🔇', speak_up: '🔈', always_on: '🔊' }
const VOICE_MODE_LABEL: Record<VoiceMode, string> = { off: 'Voice off', speak_up: 'Speak up', always_on: 'Always on' }

const STATUS_COLORS: Record<string, string> = {
  spawning: 'bg-amber-400 opacity-75',
  busy: 'bg-success',
  idle: 'bg-base-content/60',
  locked: 'bg-warning',
  completed: 'bg-info',
  awaiting_approval: 'bg-warning',
  looping: 'bg-error animate-urgency-pulse',
  paused: 'bg-amber-400',
  interrupted: 'bg-error',
  tray_running: 'bg-success/50',
  error: 'bg-error',
}

const STATUS_DISPLAY_LABELS: Partial<Record<AgentLifecycleStatus, string>> = {
  spawning: 'Starting...',
  busy: 'Working...',
  idle: 'Ready',
  locked: 'Your turn',
  completed: 'Done',
  awaiting_approval: 'Needs your OK',
  looping: 'Stuck — needs help',
  paused: 'Paused',
  interrupted: 'Stopped',
  error: 'Something went wrong',
  tray_running: 'Remote',
}

interface GlowResult {
  cssVar: string
  glowClass: string
}

function getGlowConfig(agent: AgentState, isEscalated: boolean, isRead: boolean): GlowResult | null {
  if (isRead) return null

  const color = agent.color

  switch (agent.status) {
    case 'completed':
      return { cssVar: color, glowClass: 'glow-blip' }
    case 'locked':
      return { cssVar: color, glowClass: 'glow-ring' }
    case 'awaiting_approval':
      return { cssVar: color, glowClass: 'glow-blip-fast' }
    case 'error':
    case 'looping': {
      const errorColor = 'oklch(0.62 0.16 15)'
      return { cssVar: errorColor, glowClass: 'glow-blip-fast' }
    }
    default:
      return null
  }
}

interface AgentMiniCardProps {
  agent: AgentState
  isActive: boolean
  isRead: boolean
  onSelectAgent: (id: string) => void
  onKillAgent?: (id: string) => void
  onPauseAgent?: (id: string) => void
  onResumeAgent?: (id: string) => void
  onToggleVoiceMode?: (agentId: string, mode: VoiceMode) => void
  onToggleTelegramNotify?: (agentId: string, enabled: boolean) => void
  onOpenGuardrails?: (agentId: string) => void
}

function AgentMiniCard({
  agent,
  isActive,
  isRead,
  onSelectAgent,
  onKillAgent,
  onPauseAgent,
  onResumeAgent,
  onToggleVoiceMode,
  onToggleTelegramNotify,
  onOpenGuardrails,
}: AgentMiniCardProps): React.JSX.Element {
  // Escalation tracking (30s for awaiting/locked)
  const awaitingSinceRef = useRef<number | null>(null)
  const [isEscalated, setIsEscalated] = useState(false)

  useEffect(() => {
    const isAwaiting = agent.status === 'locked' || agent.status === 'awaiting_approval'
    if (isAwaiting) {
      if (awaitingSinceRef.current === null) {
        awaitingSinceRef.current = Date.now()
      }
      const elapsed = Date.now() - awaitingSinceRef.current
      if (elapsed >= 30_000) {
        setIsEscalated(true)
        return
      }
      const remaining = 30_000 - elapsed
      const timer = setTimeout(() => setIsEscalated(true), remaining)
      return () => clearTimeout(timer)
    } else {
      awaitingSinceRef.current = null
      setIsEscalated(false)
      return undefined
    }
  }, [agent.status])

  const settledStatus = useSettledStatus(agent.status)
  const settledAgent: AgentState = { ...agent, status: settledStatus }
  const glow = getGlowConfig(settledAgent, isEscalated, isRead)

  const glowClass = glow?.glowClass ?? ''
  const glowStyle: React.CSSProperties = glow
    ? ({ '--glow-color': glow.cssVar } as React.CSSProperties)
    : {}

  const colorWashStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(to right, ${agent.color}0d 0%, transparent 60%)`,
    '--agent-color': agent.color,
    borderLeftColor: agent.color,
    borderLeftWidth: isRead ? '0px' : '3px',
    borderLeftStyle: 'solid',
  } as React.CSSProperties

  return (
    <div
      role="listitem"
      aria-label={`${agent.name}, status ${agent.status}`}
      className={`agent-card cursor-pointer ${glowClass} ${isActive ? 'card-active' : ''} ${isRead ? 'agent-card-read' : ''}`}
      style={{ ...colorWashStyle, ...glowStyle }}
      onClick={() => onSelectAgent(agent.id)}
    >
      <div className="flex items-center gap-2 py-1.5 px-3">
        {/* Color avatar monogram */}
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
          style={{ backgroundColor: agent.color }}
        >
          {agent.name.slice(0, 2).toUpperCase() || 'AG'}
        </div>
        {/* Status dot */}
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[agent.status] ?? 'bg-base-content/60'}`}
        />
        {/* Name */}
        <span className="text-sm font-medium truncate flex-1">{agent.name}</span>
        {/* Status label */}
        <span className="text-[10px] text-base-content/40 shrink-0">
          {STATUS_DISPLAY_LABELS[agent.status] ?? agent.status}
        </span>
      </div>
      {isActive && (
        <div className="flex gap-1 pb-1.5 px-3 ml-8">
          {(agent.status === 'busy' || agent.status === 'locked') && onPauseAgent && (
            <button
              onClick={(e) => { e.stopPropagation(); onPauseAgent(agent.id) }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-warning/20 hover:text-warning"
              title="Pause"
            >
              Pause
            </button>
          )}
          {agent.status === 'paused' && onResumeAgent && (
            <button
              onClick={(e) => { e.stopPropagation(); onResumeAgent(agent.id) }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-success/20 hover:text-success"
              title="Resume"
            >
              Resume
            </button>
          )}
          {onKillAgent && (
            <button
              onClick={(e) => { e.stopPropagation(); onKillAgent(agent.id) }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-error/20 hover:text-error"
              title="Kill agent"
            >
              Kill
            </button>
          )}
          {onOpenGuardrails && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenGuardrails(agent.id) }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-base-content/20"
              title="Guardrails"
            >
              &#9881;
            </button>
          )}
          {onToggleVoiceMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const current: VoiceMode = agent.voiceMode ?? 'off'
                const idx = VOICE_MODE_CYCLE.indexOf(current)
                const next = VOICE_MODE_CYCLE[(idx + 1) % VOICE_MODE_CYCLE.length]
                onToggleVoiceMode(agent.id, next)
              }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-base-content/20"
              title={VOICE_MODE_LABEL[agent.voiceMode ?? 'off']}
            >
              {VOICE_MODE_ICON[agent.voiceMode ?? 'off']}
            </button>
          )}
          {onToggleTelegramNotify && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTelegramNotify(agent.id, !agent.telegramNotify) }}
              className={`btn btn-xs rounded-full ${agent.telegramNotify ? 'bg-info/30 text-info' : 'bg-base-content/10 text-base-content/60'} hover:bg-base-content/20`}
              title={agent.telegramNotify ? 'Telegram on' : 'Telegram off'}
            >
              ✈
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AgentMiniCard
