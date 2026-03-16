import { useState, useEffect, useRef, useCallback } from 'react'

const KEYBOARD_SHORTCUTS = [
  { shortcut: 'Cmd+1', action: 'Raid view' },
  { shortcut: 'Cmd+2', action: 'Terminal view' },
  { shortcut: 'Cmd+E', action: 'Switch repo' },
  { shortcut: 'Cmd+N', action: 'New agent' },
  { shortcut: 'Cmd+K', action: 'Command palette' },
  { shortcut: 'Opt+↑/↓', action: 'Navigate agents' }
]

const TIPS = [
  'Click agent name to edit task description',
  'Click color dot to change agent color',
  'Drag agent card to reorder'
]

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
          className="dropdown-panel absolute right-0 top-7 min-w-[280px] z-50"
          style={{ maxHeight: 'none' }}
        >
          {/* Keyboard shortcuts */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-base-content/40 font-semibold mb-2">
              Keyboard Shortcuts
            </p>
            <table className="w-full border-collapse">
              <tbody>
                {KEYBOARD_SHORTCUTS.map(({ shortcut, action }) => (
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
