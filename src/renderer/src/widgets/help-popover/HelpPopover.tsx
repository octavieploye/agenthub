import { useState, useEffect, useRef, useCallback } from 'react'

const NAVIGATION_SHORTCUTS = [
  { shortcut: 'Tab', action: 'Cycle through agents' },
  { shortcut: 'Shift+Tab', action: 'Cycle agents (reverse)' },
  { shortcut: 'Enter', action: 'Expand focused agent' },
  { shortcut: 'Escape', action: 'Close panel / deselect' }
]

const VIEW_SHORTCUTS = [
  { shortcut: 'Cmd+1', action: 'Raid view' },
  { shortcut: 'Cmd+2', action: 'Terminal view' }
]

const ACTION_SHORTCUTS = [
  { shortcut: 'Cmd+N', action: 'Spawn new agent' },
  { shortcut: 'Cmd+K', action: 'Command palette' },
  { shortcut: 'Cmd+R', action: 'Repo switcher' },
  { shortcut: 'Cmd+E', action: 'Voice input (hold = push-to-talk)' },
  { shortcut: 'Cmd+Q', action: 'Quit / shutdown' },
  { shortcut: 'Delete / Backspace', action: 'Kill focused agent' },
  { shortcut: 'Space', action: 'Context menu for focused agent' },
  { shortcut: 'Cmd+Shift+Up/Down', action: 'Navigate repo list (raid view)' }
]

const TIPS = [
  'Click agent name to edit task description',
  'Click color dot to change agent color',
  'Hold Cmd+E to use push-to-talk voice input',
  'Use Cmd+K to quickly search commands and agents'
]

interface ShortcutSectionProps {
  title: string
  shortcuts: { shortcut: string; action: string }[]
}

function ShortcutSection({ title, shortcuts }: ShortcutSectionProps): React.JSX.Element {
  return (
    <div className="px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-base-content/40 font-semibold mb-2">
        {title}
      </p>
      <table className="w-full border-collapse">
        <tbody>
          {shortcuts.map(({ shortcut, action }) => (
            <tr key={shortcut} className="align-middle">
              <td className="py-0.5 pr-3 whitespace-nowrap">
                <kbd className="bg-base-content/10 px-1 rounded text-[10px] font-mono">
                  {shortcut}
                </kbd>
              </td>
              <td className="py-0.5 text-xs text-base-content/70">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HelpPopover(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.agentHub.system.getAppVersion().then((v) => setAppVersion(v)).catch(() => {})
  }, [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }

    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, close])

  return (
    <div ref={containerRef} className="relative">
      <button
        data-testid="help-popover-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="w-5 h-5 rounded-full text-[10px] font-bold text-base-content/50 hover:text-base-content/80 hover:bg-base-content/10 transition-colors flex items-center justify-center"
        title="Help &amp; keyboard shortcuts"
        aria-label="Help and keyboard shortcuts"
        aria-expanded={open}
      >
        ?
      </button>

      {open && (
        <div
          data-testid="help-popover-panel"
          className="dropdown-panel absolute right-0 top-7 min-w-[320px] z-[9999] bg-base-200 border border-base-content/10 rounded-lg shadow-xl"
          style={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
          <ShortcutSection title="Navigation" shortcuts={NAVIGATION_SHORTCUTS} />
          <div className="mx-3 border-t border-base-content/10" />

          <ShortcutSection title="Views" shortcuts={VIEW_SHORTCUTS} />
          <div className="mx-3 border-t border-base-content/10" />

          <ShortcutSection title="Actions" shortcuts={ACTION_SHORTCUTS} />
          <div className="mx-3 border-t border-base-content/10" />

          {/* Tips */}
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-base-content/40 font-semibold mb-2">
              Tips
            </p>
            <ul className="list-disc list-inside space-y-1">
              {TIPS.map((tip) => (
                <li key={tip} className="text-xs text-base-content/70">
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-3 border-t border-base-content/10" />

          {/* Footer */}
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] text-base-content/40">
              {appVersion ? `v${appVersion}` : ''}
            </span>
            <a
              href="https://github.com/anthropics/claude-code/issues"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-base-content/40 hover:text-base-content/70 transition-colors"
            >
              Report issue
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default HelpPopover
