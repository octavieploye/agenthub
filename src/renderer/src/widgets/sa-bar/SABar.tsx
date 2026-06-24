import { useState, useRef } from 'react'
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
  onOpenHowTo?: () => void
  onOpenSearch?: () => void
  repoSwitcherRef?: React.RefObject<RepoSwitcherHandle | null>
}

const VIEW_MODES = [
  { key: 'raid' as const, label: 'Raid' },
  { key: 'terminal' as const, label: 'Terminal' },
  { key: 'activity' as const, label: 'Activity' }
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

function HowToIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  )
}

function SABar({ agents: _agents, onOpenSettings, onOpenSearch, onOpenHowTo, repoSwitcherRef }: SABarProps): React.JSX.Element {
  const viewMode = useViewStore((s) => s.viewMode)
  const setViewMode = useViewStore((s) => s.setViewMode)
  const soundEnabled = useViewStore((s) => s.soundEnabled)
  const toggleSound = useViewStore((s) => s.toggleSound)
  const ttsVolume = useViewStore((s) => s.ttsVolume)
  const setTtsVolume = useViewStore((s) => s.setTtsVolume)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const volumeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

        {/* Sound toggle + volume slider */}
        <div
          className="relative"
          onMouseEnter={() => {
            if (volumeHideTimer.current) clearTimeout(volumeHideTimer.current)
            setShowVolumeSlider(true)
          }}
          onMouseLeave={() => {
            volumeHideTimer.current = setTimeout(() => setShowVolumeSlider(false), 200)
          }}
        >
          <button
            data-testid="sound-toggle"
            onClick={toggleSound}
            className="p-1.5 rounded-md text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <Volume2Icon /> : <VolumeXIcon />}
          </button>
          {showVolumeSlider && (
            <div className="absolute top-full right-0 mt-2 px-2 py-1.5 rounded-lg bg-base-200 border border-base-content/15 shadow-lg flex flex-col items-center gap-1 z-[200]">
              <span className="text-[9px] text-base-content/40 whitespace-nowrap">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ttsVolume}
                onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
                className="h-20 w-1 accent-primary cursor-pointer"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                aria-label="TTS volume"
              />
              <span className="text-[9px] text-base-content/40">{Math.round(ttsVolume * 100)}%</span>
            </div>
          )}
        </div>

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

        {/* Guide */}
        {onOpenHowTo && (
          <button
            data-testid="sa-how-to"
            onClick={onOpenHowTo}
            className="p-1.5 rounded-md text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
            title="AgentHub Guide"
            aria-label="Open how-to guide"
          >
            <HowToIcon />
          </button>
        )}

        {/* Help */}
        <HelpPopover />
      </div>
    </header>
  )
}

export default SABar
