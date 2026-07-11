import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentState, VoiceMode } from '@shared/types/agent.types'
import type { SkillItem } from '@shared/types/skills.types'
import { useBranchName } from '@renderer/hooks/useBranchName'
import { useSettledStatus } from '@renderer/hooks/use-settled-status'
import { AGENT_COLOR_PALETTE } from '@shared/constants/defaults'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useSkillsStore } from '@renderer/stores/skills-store'
import { useViewStore } from '@renderer/stores/view-store'
import { getShortModelName } from '@renderer/utils/model-utils'
import IntentInput from './IntentInput'
import ChipSurface from './ChipSurface'
import ChipOverflowRow from './ChipOverflowRow'
import AgentMiniCard from './AgentMiniCard'

const VOICE_MODE_CYCLE: VoiceMode[] = ['off', 'speak_up', 'always_on']
const VOICE_MODE_ICON: Record<VoiceMode, string> = { off: '🔇', speak_up: '🔈', always_on: '🔊' }
const VOICE_MODE_LABEL: Record<VoiceMode, string> = { off: 'Voice off', speak_up: 'Speak up (manual read)', always_on: 'Always on (auto-read)' }

interface AgentSidebarProps {
  agents: AgentState[]
  activeAgentId: string | null
  onSelectAgent: (id: string) => void
  onKillAgent: (id: string) => void
  onPauseAgent: (id: string) => void
  onResumeAgent: (id: string) => void
  onSpawnAgent: () => void
  onOpenGuardrails?: (agentId: string) => void
  onToggleVoiceMode?: (agentId: string, mode: VoiceMode) => void
  onToggleTelegramNotify?: (agentId: string, enabled: boolean) => void
  // New props
  skills?: SkillItem[]
  onLaunchWithIntent?: (text: string, skillId?: string) => void
  skillInjectSkipped?: Set<string>
}

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
  tray_running: 'bg-success/50'
}

interface GlowResult {
  cssVar: string
  glowClass: string
}

function getGlowConfig(agent: AgentState, isEscalated: boolean, isRead: boolean): GlowResult | null {
  if (isRead) return null

  const color = agent.color

  switch (agent.status) {
    case 'completed': {
      return { cssVar: color, glowClass: 'glow-blip' }
    }
    case 'locked': {
      return { cssVar: color, glowClass: 'glow-ring' }
    }
    case 'awaiting_approval': {
      return { cssVar: color, glowClass: 'glow-blip-fast' }
    }
    case 'error':
    case 'looping': {
      const errorColor = 'oklch(0.62 0.16 15)'
      return { cssVar: errorColor, glowClass: 'glow-blip-fast' }
    }
    default:
      return null
  }
}

function truncateBranch(branch: string): string {
  return branch.length > 20 ? branch.slice(0, 20) + '\u2026' : branch
}

function AgentCard({
  agent,
  isActive,
  onSelectAgent,
  onKillAgent,
  onPauseAgent,
  onResumeAgent,
  onOpenGuardrails,
  onToggleVoiceMode,
  onToggleTelegramNotify
}: {
  agent: AgentState
  isActive: boolean
  onSelectAgent: (id: string) => void
  onKillAgent: (id: string) => void
  onPauseAgent: (id: string) => void
  onResumeAgent: (id: string) => void
  onOpenGuardrails?: (agentId: string) => void
  onToggleVoiceMode?: (agentId: string, mode: VoiceMode) => void
  onToggleTelegramNotify?: (agentId: string, enabled: boolean) => void
}): React.JSX.Element {
  const branchName = useBranchName(agent.cwd)
  const isRunning = agent.status === 'busy' || agent.status === 'locked'
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)
  const updateColor = useAgentStore((s) => s.updateColor)
  const updateTaskDescription = useAgentStore((s) => s.updateTaskDescription)
  const renameAgent = useAgentStore((s) => s.renameAgent)
  const readAgentIds = useAgentStore((s) => s.readAgentIds)
  const isRead = readAgentIds.has(agent.id)
  const [editingTask, setEditingTask] = useState(false)
  const [editingValue, setEditingValue] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

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

  const opacityStyle: React.CSSProperties = isPaused ? { opacity: 0.6 } : {}

  const shortModel = getShortModelName(agent.model)
  const repoName = agent.cwd?.split('/').filter(Boolean).pop() ?? 'unknown'
  const modelLine = branchName
    ? `${shortModel} · ${truncateBranch(branchName)}`
    : shortModel

  return (
    <div
      key={agent.id}
      role="listitem"
      aria-label={`${agent.name}, status ${agent.status}`}
      onClick={() => onSelectAgent(agent.id)}
      className={`agent-card cursor-pointer status-${agent.status} ${glowClass} ${isActive ? 'card-active' : ''} ${isRead ? 'agent-card-read' : ''} ${requestSentGlow ? 'glow-blip-soft' : ''} ${shimmerClass} ${showNudge ? 'card-nudge' : ''}`}
      onAnimationEnd={handleAnimationEnd}
      style={{
        ...colorWashStyle,
        ...glowStyle,
        ...opacityStyle,
      }}
    >
      <div className="flex items-center gap-2">
        {/* Monogram avatar with color palette popover */}
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
            <div className="dropdown-panel absolute left-0 top-8 z-50 p-2 min-w-[80px]">
              <div className="grid grid-cols-3 gap-1">
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
              <label className="flex items-center gap-1 mt-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="color"
                  value={agent.color}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                  onChange={(e) => {
                    const c = e.target.value
                    updateColor(agent.id, c)
                    window.agentHub.agents.updateColor(agent.id, c).catch(console.error)
                  }}
                  title="Custom color"
                />
                <span className="text-[10px] text-base-content/60">Custom</span>
              </label>
            </div>
          )}
        </div>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
            STATUS_COLORS[agent.status] ?? 'bg-base-content/60'
          }`}
        />
        {editingName ? (
          <input
            autoFocus
            className="text-sm font-medium bg-transparent border-b border-primary/50 outline-none flex-1 text-base-content"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                renameAgent(agent.id, nameValue)
                window.agentHub.agents.rename(agent.id, nameValue).catch(console.error)
                setEditingName(false)
              }
              if (e.key === 'Escape') setEditingName(false)
            }}
            onBlur={() => {
              renameAgent(agent.id, nameValue)
              window.agentHub.agents.rename(agent.id, nameValue).catch(console.error)
              setEditingName(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-sm font-medium truncate flex-1 cursor-text"
            onClick={(e) => {
              e.stopPropagation()
              setEditingName(true)
              setNameValue(agent.name)
            }}
            title="Click to rename"
          >
            {agent.name}
          </span>
        )}
      </div>

      <div className="ml-8 mt-1">
        <span className="text-[11px] text-base-content/60 truncate block">
          {repoName}
        </span>
        <span className="text-[11px] text-base-content/60 truncate block">
          {modelLine}
        </span>
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
        <span className="text-[11px] bg-base-content/15 rounded px-1 inline-block text-base-content/60">
          {agent.status === 'tray_running' ? 'Remote' : agent.status === 'awaiting_approval' ? 'Awaiting' : agent.status}
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
          {onToggleVoiceMode && (
            <button
              data-testid="voice-mode-toggle"
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
              data-testid="telegram-notify-toggle"
              onClick={(e) => {
                e.stopPropagation()
                onToggleTelegramNotify(agent.id, !agent.telegramNotify)
              }}
              className={`btn btn-xs rounded-full ${agent.telegramNotify ? 'bg-info/30 text-info' : 'bg-base-content/10 text-base-content/60'} hover:bg-base-content/20`}
              title={agent.telegramNotify ? 'Telegram notifications on' : 'Telegram notifications off'}
            >
              {agent.telegramNotify ? '\u2708' : '\u2708'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyAgentMessage(): React.JSX.Element {
  const selectedRepoId = useViewStore((s) => s.selectedRepoId)
  const repoName = selectedRepoId
    ? selectedRepoId.split('/').filter(Boolean).pop() ?? selectedRepoId
    : null
  return (
    <span>
      {repoName
        ? `No agents in ${repoName}. Click + to add one.`
        : 'Select a repo to see agents.'}
    </span>
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
  onOpenGuardrails,
  onToggleVoiceMode,
  onToggleTelegramNotify,
  skills: skillsProp,
  onLaunchWithIntent,
  skillInjectSkipped,
}: AgentSidebarProps): React.JSX.Element {
  // Intent state
  const [intentText, setIntentText] = useState('')
  const [isIntentLoading, setIsIntentLoading] = useState(false)
  const [loadingChipId, setLoadingChipId] = useState<string | null>(null)
  const [chipsExpanded, setChipsExpanded] = useState(false)
  const [statusCollapsed, setStatusCollapsed] = useState(false)
  const [chipsTotalCount, setChipsTotalCount] = useState(0)
  const [recentSkillIds, setRecentSkillIds] = useState<string[]>([])

  const readAgentIds = useAgentStore((s) => s.readAgentIds)

  // Get skills from store if not passed as prop
  const storeSkills = useSkillsStore((s) => s.skills)
  const fetchSkills = useSkillsStore((s) => s.fetchSkills)
  const skills = skillsProp ?? storeSkills

  // Fetch skills on mount if not provided via prop
  useEffect(() => {
    if (!skillsProp) {
      fetchSkills()
    }
  }, [skillsProp, fetchSkills])

  const handleChipTap = useCallback(async (skillId: string) => {
    setLoadingChipId(skillId)
    setIsIntentLoading(true)
    setRecentSkillIds((prev) => [skillId, ...prev.filter((id) => id !== skillId)].slice(0, 4))

    // Compose a task string: "Skill Label: user intent" or just one of them
    const skill = skills.find((s) => s.id === skillId)
    const skillLabel = skill?.displayName ?? skill?.name ?? skillId
    const trimmedIntent = intentText.trim()
    const composedTask = trimmedIntent ? `${skillLabel}: ${trimmedIntent}` : skillLabel

    if (onLaunchWithIntent) {
      await onLaunchWithIntent(composedTask, skillId)
    } else {
      onSpawnAgent()
    }
    setLoadingChipId(null)
    setIsIntentLoading(false)
    setIntentText('')
  }, [intentText, skills, onLaunchWithIntent, onSpawnAgent])

  const handleIntentSubmit = useCallback((text: string) => {
    if (onLaunchWithIntent) {
      onLaunchWithIntent(text, undefined)
    } else {
      onSpawnAgent()
    }
  }, [onLaunchWithIntent, onSpawnAgent])

  const workingCount = agents.filter((a) => a.status === 'busy' || a.status === 'locked').length

  return (
    <aside className="w-60 md:w-64 xl:w-72 2xl:w-80 shrink-0 panel-glass border-r border-base-content/10 flex flex-col h-full">
      {/* Zone A — Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-content/10 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">AgentHub</span>
        <button
          onClick={onSpawnAgent}
          className="w-5 h-5 rounded flex items-center justify-center text-base-content/50 hover:text-base-content hover:bg-base-content/10 transition-colors"
          title="New agent (Cmd+N)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
        </button>
      </div>

      {/* Zone B — Intent Input */}
      <IntentInput
        value={intentText}
        onChange={setIntentText}
        onSubmit={handleIntentSubmit}
        isLoading={isIntentLoading}
        agentCount={agents.length}
      />

      {/* Zone C — Chip Surface */}
      <ChipSurface
        intentText={intentText}
        skills={skills}
        recentSkillIds={recentSkillIds}
        isExpanded={chipsExpanded}
        onChipTap={handleChipTap}
        loadingChipId={loadingChipId}
        onTotalCountChange={setChipsTotalCount}
      />

      {/* Zone D — Chip Overflow */}
      <ChipOverflowRow
        totalCount={chipsTotalCount}
        visibleMax={chipsExpanded ? 6 : 4}
        isExpanded={chipsExpanded}
        onToggle={() => setChipsExpanded((prev) => !prev)}
      />

      {/* Zone E — Agent Status Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Collapsible section header */}
        <button
          className="flex items-center justify-between px-3 py-1.5 border-t border-base-content/8 hover:bg-base-content/4 shrink-0 w-full text-left"
          onClick={() => setStatusCollapsed((prev) => !prev)}
        >
          <span className="text-[11px] text-base-content/50 font-semibold uppercase tracking-wider">
            {statusCollapsed ? '\u25B6' : '\u25BC'} Agents ({agents.length})
          </span>
        </button>

        {!statusCollapsed && (
          <div className="flex-1 overflow-y-auto py-1" role="list" aria-label="Agent list">
            {agents.length === 0 && (
              <p className="px-3 py-4 text-[11px] text-base-content/40 text-center">
                Start a task above to launch your first assistant
              </p>
            )}
            {agents.map((agent) => (
              <AgentMiniCard
                key={agent.id}
                agent={agent}
                isActive={agent.id === activeAgentId}
                isRead={readAgentIds.has(agent.id)}
                onSelectAgent={onSelectAgent}
                onKillAgent={onKillAgent}
                onPauseAgent={onPauseAgent}
                onResumeAgent={onResumeAgent}
                onToggleVoiceMode={onToggleVoiceMode}
                onToggleTelegramNotify={onToggleTelegramNotify}
                onOpenGuardrails={onOpenGuardrails}
                skillInjectSkipped={skillInjectSkipped}
              />
            ))}
          </div>
        )}
      </div>

      {/* Zone F — Footer */}
      <div className="px-3 py-1.5 border-t border-base-content/10 shrink-0">
        <span className="text-[11px] text-base-content/50">
          {workingCount} working{' / '}{agents.length} total
        </span>
      </div>
    </aside>
  )
}

// Keep AgentCard exported for any future external usage, but it is not used
// in the new sidebar layout (AgentMiniCard is used instead).
export { AgentCard }
export default AgentSidebar
