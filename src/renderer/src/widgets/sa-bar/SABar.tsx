import type { AgentState } from '@shared/types/agent.types'
import { useViewStore } from '@renderer/stores/view-store'
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
  onOpenSearch?: () => void
  repoSwitcherRef?: React.RefObject<RepoSwitcherHandle>
}

const VIEW_MODES = [
  { key: 'raid' as const, label: 'Raid' },
  { key: 'terminal' as const, label: 'Terminal' }
]

/** Lucide-style inline SVG icons (16x16) — lucide-react is not installed */
function SearchIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function Volume2Icon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function VolumeXIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z" />
    </svg>
  )
}

function SABar({ agents: _agents, onOpenSettings, onOpenSearch, repoSwitcherRef }: SABarProps): React.JSX.Element {
  const viewMode = useViewStore((s) => s.viewMode)
  const setViewMode = useViewStore((s) => s.setViewMode)
  const soundEnabled = useViewStore((s) => s.soundEnabled)
  const toggleSound = useViewStore((s) => s.toggleSound)

  return (
    <header
      data-testid="sa-bar"
      className="h-14 flex items-center px-4 panel-glass border-b border-base-content/10 shrink-0 relative z-[100]"
    >
      {/* LEFT zone: wordmark + repo badge */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-mono font-semibold text-primary tracking-wide">AgentHub</h1>
        <RepoSwitcher ref={repoSwitcherRef} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* CENTER zone: view mode toggle */}
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* RIGHT zone: icon toolbar */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button
          data-testid="sa-search"
          onClick={onOpenSearch}
          className="p-1.5 rounded-md text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
          title="Search"
          aria-label="Search"
        >
          <SearchIcon />
        </button>

        {/* Sound toggle */}
        <button
          data-testid="sound-toggle"
          onClick={toggleSound}
          className="p-1.5 rounded-md text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundEnabled ? <Volume2Icon /> : <VolumeXIcon />}
        </button>

        {/* Settings */}
        {onOpenSettings && (
          <button
            data-testid="sa-settings"
            onClick={onOpenSettings}
            className="p-1.5 rounded-md text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
        )}

        {/* Help */}
        <HelpPopover />
      </div>
    </header>
  )
}

export default SABar
