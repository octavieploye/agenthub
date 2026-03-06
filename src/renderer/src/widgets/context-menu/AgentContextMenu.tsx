import type { AgentState } from '@shared/types/agent.types'

interface AgentContextMenuProps {
  agent: AgentState
  position: { x: number; y: number }
  onClose: () => void
  onPause: (agentId: string) => void
  onResume: (agentId: string) => void
  onKill: (agentId: string) => void
  onViewOutput: (agentId: string) => void
  onCopyId: (agentId: string) => void
}

function AgentContextMenu({
  agent,
  position,
  onClose,
  onPause,
  onResume,
  onKill,
  onViewOutput,
  onCopyId
}: AgentContextMenuProps): React.JSX.Element {
  const handleAction = (action: (agentId: string) => void): void => {
    action(agent.id)
    onClose()
  }

  const canPause = agent.status === 'busy' || agent.status === 'idle' || agent.status === 'locked'
  const canResume = agent.status === 'paused'

  return (
    <div
      data-testid="context-menu"
      className="panel-glass rounded-lg shadow-lg py-1 min-w-[160px] z-50 fixed"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {canPause && (
        <button
          data-testid="context-menu-pause"
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
          onClick={() => handleAction(onPause)}
        >
          Pause
        </button>
      )}

      {canResume && (
        <button
          data-testid="context-menu-resume"
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
          onClick={() => handleAction(onResume)}
        >
          Resume
        </button>
      )}

      <button
        data-testid="context-menu-view-output"
        className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
        onClick={() => handleAction(onViewOutput)}
      >
        View Output
      </button>

      <button
        data-testid="context-menu-copy-id"
        className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
        onClick={() => handleAction(onCopyId)}
      >
        Copy Agent ID
      </button>

      <div data-testid="context-menu-divider" className="border-t border-base-content/10 my-1" />

      <button
        data-testid="context-menu-kill"
        className="w-full text-left px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
        onClick={() => handleAction(onKill)}
      >
        Kill
      </button>
    </div>
  )
}

export default AgentContextMenu
