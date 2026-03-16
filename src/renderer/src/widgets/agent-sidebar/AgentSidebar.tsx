import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { useSettledStatus } from '@renderer/hooks/use-settled-status'
import { useBranchName } from '@renderer/hooks/useBranchName'
import { AGENT_COLOR_PALETTE } from '@shared/constants/defaults'
import { useAgentStore } from '@renderer/stores/agent-store'

interface AgentSidebarProps {
  agents: AgentState[]
  activeAgentId: string | null
  onSelectAgent: (id: string) => void
  onKillAgent: (id: string) => void
  onPauseAgent: (id: string) => void
  onResumeAgent: (id: string) => void
  onSpawnAgent: () => void
  onOpenGuardrails?: (agentId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
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

interface GlowResult {
  boxShadow: string
  cssVar: string
  glowClass: string
}

function getGlowConfig(agent: AgentState, isEscalated: boolean): GlowResult | null {
  const c = agent.color

  switch (agent.status) {
    case 'busy':
    case 'idle':
    case 'paused':
    case 'completed':
      return null

    case 'locked':
    case 'awaiting_approval': {
      if (isEscalated) {
        const warmColor = 'oklch(0.72 0.18 65)'
        return {
          boxShadow: `0 0 18px ${warmColor}, 0 0 40px color-mix(in srgb, ${warmColor} 40%, transparent)`,
          cssVar: warmColor,
          glowClass: '',
        }
      }
      return {
        boxShadow: `0 0 0 1px ${c}60`,
        cssVar: c,
        glowClass: 'glow-blip',
      }
    }

    case 'error':
    case 'looping': {
      const errorColor = 'oklch(0.62 0.16 15)'
      return {
        boxShadow: `0 0 0 1px ${errorColor}60`,
        cssVar: errorColor,
        glowClass: 'glow-blip-fast',
      }
    }

    default:
      return null
  }
}

function truncateBranch(branch: string): string {
  return branch.length > 20 ? branch.slice(0, 20) + '…' : branch
}

function AgentCard({
  agent,
  isActive,
  onSelectAgent,
  onKillAgent,
  onPauseAgent,
  onResumeAgent,
  onOpenGuardrails
}: {
  agent: AgentState
  isActive: boolean
  onSelectAgent: (id: string) => void
  onKillAgent: (id: string) => void
  onPauseAgent: (id: string) => void
  onResumeAgent: (id: string) => void
  onOpenGuardrails?: (agentId: string) => void
}): React.JSX.Element {
  const settledStatus = useSettledStatus(agent.status)
  const branchName = useBranchName(agent.cwd)
  const isRunning = agent.status === 'busy' || agent.status === 'locked'
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)
  const updateColor = useAgentStore((s) => s.updateColor)
  const updateTaskDescription = useAgentStore((s) => s.updateTaskDescription)
  const [editingTask, setEditingTask] = useState(false)
  const [editingValue, setEditingValue] = useState('')

  // Track when agent entered awaiting_approval/locked for 30s escalation
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
    }
  }, [agent.status])

  // Shimmer: add class on completed, remove after animation
  const [showShimmer, setShowShimmer] = useState(false)
  const prevStatusRef = useRef(agent.status)

  useEffect(() => {
    if (agent.status === 'completed' && prevStatusRef.current !== 'completed') {
      setShowShimmer(true)
      const timer = setTimeout(() => setShowShimmer(false), 650)
      return () => clearTimeout(timer)
    }
    if (agent.status !== 'completed') {
      setShowShimmer(false)
    }
    prevStatusRef.current = agent.status
  }, [agent.status])

  const handleAnimationEnd = useCallback(() => {
    setShowShimmer(false)
  }, [])

  useEffect(() => {
    if (!paletteOpen) return
    function handlePointerDown(e: PointerEvent): void {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [paletteOpen])
  const isPaused = agent.status === 'paused'

  const glow = getGlowConfig(agent, isEscalated)

  const glowClass = glow?.glowClass ?? ''

  const glowStyle: React.CSSProperties = glow
    ? ({
        '--glow-color': glow.cssVar,
        boxShadow: glow.boxShadow,
      } as React.CSSProperties)
    : {}

  const colorWashStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(to right, ${agent.color}0d 0%, transparent 60%)`,
  }

  const opacityStyle: React.CSSProperties = isPaused ? { opacity: 0.6 } : {}

  const modelLine = branchName
    ? `${agent.model} · ${truncateBranch(branchName)}`
    : agent.model

  return (
    <div
      key={agent.id}
      role="listitem"
      aria-label={`${agent.name}, status ${agent.status}`}
      onClick={() => onSelectAgent(agent.id)}
      className={`agent-card cursor-pointer ${glowClass} ${isActive ? 'card-active' : ''} ${showShimmer ? 'card-shimmer' : ''}`}
      onAnimationEnd={handleAnimationEnd}
      style={{
        ...colorWashStyle,
        ...glowStyle,
        ...opacityStyle,
      }}
    >
      <div className="flex items-center gap-2">
        {/* S2.8 / S4.3 — Monogram avatar with color palette popover */}
        <div className="relative" ref={paletteRef}>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white select-none cursor-pointer"
            style={{ backgroundColor: agent.color }}
            onClick={(e) => {
              e.stopPropagation()
              setPaletteOpen((prev) => !prev)
            }}
            title="Click to change color"
          >
            {agent.name.slice(0, 2).toUpperCase() || 'AG'}
          </div>

          {paletteOpen && (
            <div className="dropdown-panel absolute left-0 top-8 z-50 p-2 grid grid-cols-3 gap-1 min-w-[80px]">
              {AGENT_COLOR_PALETTE.slice(0, 6).map((color) => (
                <button
                  key={color}
                  className="w-5 h-5 rounded cursor-pointer border-2 hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: color,
                    borderColor: agent.color === color ? 'white' : 'transparent',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    updateColor(agent.id, color)
                    window.agentHub.agents.updateColor(agent.id, color).catch(console.error)
                    setPaletteOpen(false)
                  }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
            STATUS_COLORS[agent.status] ?? 'bg-base-content/60'
          }`}
        />
        <span className="text-sm font-medium truncate flex-1">
          {agent.name}
        </span>
      </div>

      <div className="ml-8 mt-1">
        {/* S2.3 — text-[11px] and /60 opacity minimum */}
        <span className="text-[11px] text-base-content/60 truncate block">
          {agent.cwd?.split('/').slice(-2).join('/') ?? 'unknown'}
        </span>
        {/* S2.4 — model · branch line */}
        <span className="text-[11px] text-base-content/60 truncate block">
          {modelLine}
        </span>
        {/* S4.1 — editable task description */}
        {editingTask ? (
          <input
            autoFocus
            className="text-[11px] bg-transparent border-b border-primary/50 outline-none w-full text-base-content"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                updateTaskDescription(agent.id, editingValue)
                window.agentHub.agents.updateTaskDescription(agent.id, editingValue).catch(console.error)
                setEditingTask(false)
              }
              if (e.key === 'Escape') {
                setEditingTask(false)
              }
            }}
            onBlur={() => {
              updateTaskDescription(agent.id, editingValue)
              window.agentHub.agents.updateTaskDescription(agent.id, editingValue).catch(console.error)
              setEditingTask(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-[11px] text-base-content/60 cursor-text truncate block"
            onClick={(e) => {
              e.stopPropagation()
              setEditingTask(true)
              setEditingValue(agent.taskDescription)
            }}
            title="Click to edit task"
          >
            {agent.taskDescription || '(no task)'}
          </span>
        )}
        <span className="text-[11px] bg-base-content/15 rounded px-1 inline-block capitalize text-base-content/60">
          {agent.status}
          {agent.confidence === 'inferred' ? ' ~' : ''}
        </span>
      </div>

      {isActive && (
        <div className="flex gap-1 mt-1.5 ml-8">
          {isRunning && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPauseAgent(agent.id)
              }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-warning/20 hover:text-warning"
              title="Pause agent"
            >
              Pause
            </button>
          )}
          {isPaused && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onResumeAgent(agent.id)
              }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-success/20 hover:text-success"
              title="Resume agent"
            >
              Resume
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onKillAgent(agent.id)
            }}
            className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-error/20 hover:text-error"
            title="Kill agent"
          >
            Kill
          </button>
          {onOpenGuardrails && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenGuardrails(agent.id)
              }}
              className="btn btn-xs rounded-full bg-base-content/10 text-base-content/60 hover:bg-base-content/20"
              title="Guardrails settings"
            >
              &#9881;
            </button>
          )}
        </div>
      )}

      {/* S2.7 — Status progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[0.75rem] overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease${
            agent.status === 'awaiting_approval' || agent.status === 'locked'
              ? ' animate-breathe'
              : agent.status === 'completed'
              ? ' progress-bar-fade'
              : ''
          }`}
          style={{
            width:
              agent.status === 'busy' ? `${Math.max(2, Math.min(100, agent.progress))}%` :
              agent.status === 'error' || agent.status === 'looping' ? '100%' :
              agent.status === 'awaiting_approval' || agent.status === 'locked' ? '100%' :
              agent.status === 'completed' ? '100%' :
              '100%',
            backgroundColor:
              agent.status === 'error' || agent.status === 'looping'
                ? 'var(--color-error)'
                : agent.status === 'completed'
                ? 'var(--color-success, #22c55e)'
                : agent.status === 'idle' || agent.status === 'paused'
                ? undefined
                : agent.color,
            opacity:
              agent.status === 'idle' || agent.status === 'paused' ? 0.2 : undefined,
            ...(agent.status === 'idle' || agent.status === 'paused'
              ? { backgroundColor: agent.color }
              : {}),
          }}
        />
      </div>
    </div>
  )
}

function AgentSidebar({
  agents,
  activeAgentId,
  onSelectAgent,
  onKillAgent,
  onPauseAgent,
  onResumeAgent,
  onSpawnAgent,
  onOpenGuardrails
}: AgentSidebarProps): React.JSX.Element {
  return (
    <aside className="w-56 shrink-0 panel-glass border-r border-base-content/10 flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-content/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
          Agents
        </span>
        <button
          onClick={onSpawnAgent}
          className="btn btn-xs btn-primary btn-outline rounded-full"
          title="Spawn new agent"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1" role="list" aria-label="Agent list">
        {agents.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-base-content/60">
            No agents running
          </div>
        )}

        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isActive={agent.id === activeAgentId}
            onSelectAgent={onSelectAgent}
            onKillAgent={onKillAgent}
            onPauseAgent={onPauseAgent}
            onResumeAgent={onResumeAgent}
            onOpenGuardrails={onOpenGuardrails}
          />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-base-content/10">
        <span className="text-[11px] text-base-content/60">
          {agents.filter((a) => a.status === 'busy' || a.status === 'locked').length} active
          {' / '}
          {agents.length} total
        </span>
      </div>
    </aside>
  )
}

export default AgentSidebar
