import { useState, useRef, useEffect } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import type { DockerStatus } from '@shared/types/docker.types'
import { useViewStore } from '@renderer/stores/view-store'
import ThemeSwitcher from '../theme-switcher/ThemeSwitcher'
import CodeBlueButton from '../code-blue/CodeBlueButton'
import SkillsDropdown from '../skills-dropdown/SkillsDropdown'
import RepoSwitcher from '../repo-switcher/RepoSwitcher'
import type { RepoSwitcherHandle } from '../repo-switcher/RepoSwitcher'
import HelpPopover from '../help-popover/HelpPopover'

interface SABarProps {
  agents: AgentState[]
  onCodeBlue?: () => void
  selectedAgentRepoPath?: string
  onOpenSettings?: () => void
  onOpenGit?: () => void
  onOpenHelp?: () => void
  repoSwitcherRef?: React.RefObject<RepoSwitcherHandle>
}

const VIEW_MODES = [
  { key: 'raid' as const, label: 'Raid' },
  { key: 'terminal' as const, label: 'Terminal' }
]

function SABar({ agents, onCodeBlue, selectedAgentRepoPath, onOpenSettings, onOpenGit, onOpenHelp: _onOpenHelp, repoSwitcherRef }: SABarProps): React.JSX.Element {
  const viewMode = useViewStore((s) => s.viewMode)
  const setViewMode = useViewStore((s) => s.setViewMode)
  const soundEnabled = useViewStore((s) => s.soundEnabled)
  const toggleSound = useViewStore((s) => s.toggleSound)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const skillsBtnRef = useRef<HTMLButtonElement>(null)
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null)

  useEffect(() => {
    const fetchStatus = (): void => {
      window.agentHub.docker.status().then((res) => {
        if (res.success) setDockerStatus(res.data)
      }).catch(() => {})
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header
      data-testid="sa-bar"
      className="h-14 flex items-center gap-3 px-4 panel-glass border-b border-base-content/10 shrink-0"
    >
      <h1 className="text-sm font-mono font-semibold text-primary tracking-wide">AgentHub</h1>

      <div className="flex-1" />

      {/* View mode toggle */}
      <div className="flex items-center bg-base-content/5 rounded-full p-0.5">
        {VIEW_MODES.map(({ key, label }) => (
          <button
            key={key}
            data-testid={`view-mode-${key}`}
            onClick={() => setViewMode(key)}
            aria-label={`Switch to ${label} view`}
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

      {/* Repo switcher */}
      <RepoSwitcher ref={repoSwitcherRef} />

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
          className="btn-hub btn-ghost btn-xs"
          onClick={onOpenGit}
          title="Git Overview"
        >
          Git
        </button>
      )}

      {/* Docker status indicator */}
      <button
        data-testid="docker-status-indicator"
        onClick={onOpenSettings}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
        title={
          dockerStatus === null
            ? 'Docker status unknown'
            : dockerStatus.available
              ? `Docker ${dockerStatus.version ?? ''} — ${dockerStatus.activeContainerCount} container(s) active`
              : 'Docker not available'
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            dockerStatus === null
              ? 'bg-base-content/20'
              : dockerStatus.available
                ? 'bg-success'
                : 'bg-error'
          }`}
        />
        <span>Docker</span>
      </button>

      {/* Settings button */}
      {onOpenSettings && (
        <button
          data-testid="sa-settings"
          className="btn-hub btn-ghost btn-xs"
          onClick={onOpenSettings}
          title="Settings"
        >
          Settings
        </button>
      )}

      {/* Help popover */}
      <HelpPopover />
    </header>
  )
}

export default SABar
