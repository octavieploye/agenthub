import { useEffect } from 'react'

interface HelpModalProps {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'Views',
    rows: [
      { keys: ['⌘ 1'], desc: 'Switch to Raid view (grid overview)' },
      { keys: ['⌘ 2'], desc: 'Switch to Terminal view' },
    ]
  },
  {
    title: 'Agent Navigation',
    rows: [
      { keys: ['↑', '⌥ ↑'], desc: 'Select previous agent in Raid view' },
      { keys: ['↓', '⌥ ↓'], desc: 'Select next agent in Raid view' },
      { keys: ['Tab'], desc: 'Cycle to next agent (wraps)' },
      { keys: ['⇧ Tab'], desc: 'Cycle to previous agent (wraps)' },
      { keys: ['⌘ ←', '⌥ ←'], desc: 'Switch to previous agent (terminal view)' },
      { keys: ['⌘ →', '⌥ →'], desc: 'Switch to next agent (terminal view)' },
      { keys: ['⌘ ⇧ ↑'], desc: 'Focus previous repo group (Raid view)' },
      { keys: ['⌘ ⇧ ↓'], desc: 'Focus next repo group (Raid view)' },
      { keys: ['Enter'], desc: 'Expand focused agent' },
      { keys: ['Space'], desc: 'Open context menu for focused agent' },
      { keys: ['⌫'], desc: 'Kill focused agent' },
    ]
  },
  {
    title: 'Voice Input',
    rows: [
      { keys: ['⌘ E'], desc: 'Start / stop voice recording in the task input field' },
    ]
  },
  {
    title: 'General',
    rows: [
      { keys: ['⌘ N'], desc: 'Spawn a new agent' },
      { keys: ['⌘ K'], desc: 'Open Command Palette (search agents, tasks, repos)' },
      { keys: ['⌘ R'], desc: 'Open repo switcher' },
      { keys: ['⌘ Q'], desc: 'Quit / shutdown AgentHub' },
      { keys: ['Esc'], desc: 'Close any open panel or dialog' },
    ]
  },
  {
    title: 'How It Works',
    rows: [
      { keys: ['Spawn'], desc: 'Launch a new Claude agent on any repo with a task description' },
      { keys: ['Terminal'], desc: 'Each agent has a live terminal — type directly or use the task bar below' },
      { keys: ['Breakout'], desc: 'Pop an agent terminal into its own window' },
      { keys: ['Code Blue'], desc: 'Emergency stop — pauses all running agents instantly' },
      { keys: ['Skills'], desc: 'Pre-defined prompt templates you can fire at any agent' },
    ]
  }
]

function HelpModal({ onClose }: HelpModalProps): React.JSX.Element {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Help — Keyboard Shortcuts"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Panel — solid, no transparency */}
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-xl overflow-hidden shadow-2xl bg-base-200 border border-base-content/20">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/10 bg-base-300">
          <h2 className="text-sm font-bold tracking-wide uppercase text-base-content">
            AgentHub — Help & Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-base-content/50 hover:text-base-content transition-colors text-lg leading-none"
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[70vh] px-5 py-4 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40 mb-2">
                {section.title}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.desc} className="border-t border-base-content/5 first:border-t-0">
                      <td className="py-1.5 pr-4 w-40 align-top">
                        <div className="flex gap-1 flex-wrap">
                          {row.keys.map((k) => (
                            <kbd
                              key={k}
                              className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-base-100 border border-base-content/20 text-base-content/80 whitespace-nowrap"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </td>
                      <td className="py-1.5 text-base-content/70 align-top text-xs">
                        {row.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-base-content/10 bg-base-300 text-[10px] text-base-content/30 text-right">
          Press Esc to close
        </div>
      </div>
    </div>
  )
}

export default HelpModal
