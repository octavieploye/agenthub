import { useState, useRef } from 'react'
import type { AgentState, AgentLifecycleStatus } from '@shared/types/agent.types'
import { useViewStore } from '@renderer/stores/view-store'
import ThemeSwitcher from '../theme-switcher/ThemeSwitcher'
import CodeBlueButton from '../code-blue/CodeBlueButton'
import SkillsDropdown from '../skills-dropdown/SkillsDropdown'

interface SABarProps {
  agents: AgentState[]
  onCodeBlue?: () => void
  selectedAgentRepoPath?: string
  onOpenSettings?: () => void
  onOpenGit?: () => void
}

const STATUS_COUNTERS: { key: AgentLifecycleStatus; label: string; dotClass: string }[] = [
  { key: 'busy', label: 'Active', dotClass: 'bg-success' },
  { key: 'locked', label: 'Locked', dotClass: 'bg-warning animate-breathe' },
  { key: 'paused', label: 'Paused', dotClass: 'bg-amber-400' },
  { key: 'completed', label: 'Done', dotClass: 'bg-info' }
]

const VIEW_MODES = [
  { key: 'raid' as const, label: 'Raid' },
  { key: 'channel' as const, label: 'Channel' },
  { key: 'terminal' as const, label: 'Terminal' }
]

function SABar({ agents, onCodeBlue, selectedAgentRepoPath, onOpenSettings, onOpenGit }: SABarProps): React.JSX.Element {
  const viewMode = useViewStore((s) => s.viewMode)
  const setViewMode = useViewStore((s) => s.setViewMode)
  const setStatusFilter = useViewStore((s) => s.setStatusFilter)
  const soundEnabled = useViewStore((s) => s.soundEnabled)
  const toggleSound = useViewStore((s) => s.toggleSound)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const skillsBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <header
      data-testid="sa-bar"
      className="h-12 flex items-center gap-3 px-4 panel-glass border-b border-base-content/10 shrink-0"
    >
      <h1 className="text-sm font-bold text-primary tracking-wide">AgentHub</h1>

      {/* Status counters */}
      <div className="flex items-center gap-2 ml-3">
        {STATUS_COUNTERS.map(({ key, label, dotClass }) => {
          const count = agents.filter((a) => a.status === key).length
          return (
            <button
              key={key}
              data-testid={`status-counter-${key}`}
              onClick={() => setStatusFilter(key)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs hover:bg-base-content/10 transition-colors"
              title={`Filter by ${label}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
              <span className="text-base-content/60">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* View mode toggle */}
      <div className="flex items-center bg-base-content/5 rounded-full p-0.5">
        {VIEW_MODES.map(({ key, label }) => (
          <button
            key={key}
            data-testid={`view-mode-${key}`}
            onClick={() => setViewMode(key)}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
              viewMode === key
                ? 'bg-primary text-primary-content'
                : 'text-base-content/50 hover:text-base-content/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Code Blue emergency stop */}
      {agents.length > 0 && onCodeBlue && (
        <CodeBlueButton onActivate={onCodeBlue} />
      )}

      {/* Skills dropdown */}
      <div className="relative">
        <button
          ref={skillsBtnRef}
          data-testid="skills-button"
          onClick={() => setSkillsOpen((prev) => !prev)}
          className="text-[10px] font-medium text-base-content/50 hover:text-base-content/80 transition-colors px-2 py-0.5 rounded hover:bg-base-content/5"
          title="Skills"
        >
          Skills
        </button>
        <SkillsDropdown
          isOpen={skillsOpen}
          onClose={() => setSkillsOpen(false)}
          repoPath={selectedAgentRepoPath}
        />
      </div>

      {/* Sound toggle */}
      <button
        data-testid="sound-toggle"
        onClick={toggleSound}
        className="text-xs text-base-content/50 hover:text-base-content/80 transition-colors px-1"
        title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      {/* Theme switcher */}
      <ThemeSwitcher />

      {/* Git button */}
      {onOpenGit && (
        <button
          data-testid="sa-git"
          className="btn btn-xs btn-ghost"
          onClick={onOpenGit}
          title="Git Overview"
        >
          Git
        </button>
      )}

      {/* Settings button */}
      {onOpenSettings && (
        <button
          data-testid="sa-settings"
          className="btn btn-xs btn-ghost"
          onClick={onOpenSettings}
          title="Settings"
        >
          Settings
        </button>
      )}
    </header>
  )
}

export default SABar
