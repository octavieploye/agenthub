import { useRef, useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import type { AgentState, AgentLifecycleStatus, VoiceMode } from '@shared/types/agent.types'
import { useSettledStatus } from '@renderer/hooks/use-settled-status'
import { getShortModelName } from '@renderer/utils/model-utils'

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
  skillInjectSkipped?: Set<string>
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
  skillInjectSkipped,
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

  const [shimmerClass, setShimmerClass] = useState('')
  const [showNudge, setShowNudge] = useState(false)
  const [requestSentGlow, setRequestSentGlow] = useState(false)
  const prevStatusRef = useRef(agent.status)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = agent.status

    if (agent.status === 'busy' && prev === 'locked') {
      setRequestSentGlow(true)
      const timer = setTimeout(() => setRequestSentGlow(false), 900)
      return () => clearTimeout(timer)
    }

    if (agent.status === 'locked' && prev !== 'locked') {
      setShimmerClass('card-shimmer-double')
      const timer = setTimeout(() => setShimmerClass(''), 1250)
      return () => clearTimeout(timer)
    }

    if (agent.status === 'awaiting_approval' && prev !== 'awaiting_approval') {
      setShimmerClass('card-shimmer')
      setShowNudge(true)
      const shimmerTimer = setTimeout(() => setShimmerClass(''), 650)
      const nudgeTimer = setTimeout(() => setShowNudge(false), 400)
      return () => {
        clearTimeout(shimmerTimer)
        clearTimeout(nudgeTimer)
      }
    }

    if (agent.status !== 'locked') {
      setShimmerClass('')
    }
    return undefined
  }, [agent.status])

  const handleAnimationEnd = useCallback((e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.animationName === 'card-shimmer') {
      setShimmerClass('')
    }
  }, [])

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tooltipState, setTooltipState] = useState<{ isVisible: boolean; coords: { x: number; y: number } }>({
    isVisible: false,
    coords: { x: 0, y: 0 },
  })

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    hoverTimerRef.current = setTimeout(() => {
      setTooltipState({
        isVisible: true,
        coords: { x: rect.right + 8, y: rect.top + rect.height / 2 },
      })
    }, 400)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setTooltipState((prev) => ({ ...prev, isVisible: false }))
  }, [])

  const handleMouseDown = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setTooltipState((prev) => ({ ...prev, isVisible: false }))
  }, [])

  const settledStatus = useSettledStatus(agent.status)
  const settledAgent: AgentState = { ...agent, status: settledStatus }
  const glow = getGlowConfig(settledAgent, isEscalated, isRead)

  const glowClass = glow?.glowClass ?? ''
  const glowStyle: React.CSSProperties = (glow || requestSentGlow)
    ? ({ '--glow-color': glow?.cssVar ?? agent.color } as React.CSSProperties)
    : {}

  const colorWashStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(to right, ${agent.color}0d 0%, transparent 60%)`,
    '--agent-color': agent.color,
    borderLeftColor: agent.color,
    borderLeftWidth: isRead ? '0px' : '3px',
    borderLeftStyle: 'solid',
  } as React.CSSProperties

  return (
    <>
    <div
      role="listitem"
      aria-label={`${agent.name}, status ${agent.status}`}
      aria-describedby={tooltipState.isVisible ? `agent-tooltip-${agent.id}` : undefined}
      className={`agent-card cursor-pointer ${glowClass} ${isActive ? 'card-active' : ''} ${isRead ? 'agent-card-read' : ''} ${requestSentGlow ? 'glow-blip-soft' : ''} ${shimmerClass} ${showNudge ? 'card-nudge' : ''}`}
      onAnimationEnd={handleAnimationEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
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
        {skillInjectSkipped?.has(agent.id) && (
          <span className="badge badge-warning badge-xs shrink-0" title="Skill injection was skipped for this agent">
            Skill not injected
          </span>
        )}
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
    {tooltipState.isVisible && ReactDOM.createPortal(
      <div
        id={`agent-tooltip-${agent.id}`}
        role="tooltip"
        style={{
          position: 'fixed',
          left: tooltipState.coords.x,
          top: tooltipState.coords.y,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          minWidth: 200,
          maxWidth: 280,
          padding: '10px 12px',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}
        className="bg-base-200 border border-base-content/10 tooltip-enter"
      >
        <div
          style={{
            position: 'absolute',
            left: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: '6px solid',
          }}
          className="border-r-base-200"
        />
        <div style={{ fontSize: 12, fontWeight: 600 }} className="text-base-content">
          {agent.name}
        </div>
        <div style={{ fontSize: 11, marginTop: 4 }} className="text-base-content/60">
          <span className="text-base-content/40">AI Engine </span>
          {getShortModelName(agent.model)}
        </div>
        <div style={{ fontSize: 11, marginTop: 2 }} className="text-base-content/60">
          <span className="text-base-content/40">Project </span>
          {agent.cwd.split('/').pop() ?? agent.cwd}
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

export default AgentMiniCard
