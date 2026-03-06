import { useEffect, useRef } from 'react'
import type { AgentState } from '@shared/types/agent.types'

interface CodeBluePanelProps {
  agents: AgentState[]
  onResumeAgent: (id: string) => void
  onKillAgent: (id: string) => void
  onRestartAgent: (id: string) => void
  onResumeAll: () => void
  onDismiss: () => void
  isActive: boolean
}

function CodeBluePanel({
  agents,
  onResumeAgent,
  onKillAgent,
  onRestartAgent,
  onResumeAll,
  onDismiss,
  isActive
}: CodeBluePanelProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive || !panelRef.current) return

    const panel = panelRef.current
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onDismiss()
        return
      }

      if (e.key === 'Tab') {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    panel.addEventListener('keydown', handleKeyDown)

    // Auto-focus first focusable element
    const firstFocusable = panel.querySelector<HTMLElement>(focusableSelector)
    firstFocusable?.focus()

    return () => panel.removeEventListener('keydown', handleKeyDown)
  }, [isActive, onDismiss])

  if (!isActive) return null

  return (
    <>
      <div
        data-testid="code-blue-backdrop"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm panel-glass"
      />
      <div
        ref={panelRef}
        data-testid="code-blue-panel"
        role="dialog"
        aria-modal="true"
        className="fixed inset-4 z-50 panel-glass rounded-xl border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] ring-red-500/20 ring-2 flex flex-col p-6 overflow-auto"
      >
        <h2 className="text-lg font-bold text-error mb-4">Code Blue — Emergency Stop</h2>

        <div data-testid="code-blue-agent-list" className="flex flex-col gap-2 flex-1">
          {agents.map((agent) => (
            <div
              key={agent.id}
              data-testid={`code-blue-agent-${agent.id}`}
              className="flex items-center gap-3 p-2 rounded-lg bg-base-content/5"
            >
              <span className="text-sm font-medium flex-1">{agent.name}</span>
              <span className="text-xs text-base-content/40 capitalize">{agent.status}</span>
              <button
                data-testid={`code-blue-resume-${agent.id}`}
                className="btn btn-xs btn-ghost"
                onClick={() => onResumeAgent(agent.id)}
              >
                Resume
              </button>
              <button
                data-testid={`code-blue-kill-${agent.id}`}
                className="btn btn-xs btn-error btn-ghost"
                onClick={() => onKillAgent(agent.id)}
              >
                Kill
              </button>
              <button
                data-testid={`code-blue-restart-${agent.id}`}
                className="btn btn-xs btn-ghost"
                onClick={() => onRestartAgent(agent.id)}
              >
                Restart
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-base-content/10">
          <button
            data-testid="code-blue-resume-all"
            className="btn btn-sm btn-primary"
            onClick={onResumeAll}
          >
            Resume All
          </button>
          <button
            data-testid="code-blue-dismiss"
            className="btn btn-sm btn-ghost"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  )
}

export default CodeBluePanel
