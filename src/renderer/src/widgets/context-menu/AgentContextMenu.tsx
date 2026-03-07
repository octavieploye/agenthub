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
  onSendTask?: (agentId: string) => void
  onViewNotes?: (agentId: string) => void
  onBreakout?: (agentId: string) => void
  onChangeColor?: (agentId: string) => void
}

function AgentContextMenu({
  agent,
  position,
  onClose,
  onPause,
  onResume,
  onKill,
  onViewOutput,
  onCopyId,
  onSendTask,
  onViewNotes,
  onBreakout,
  onChangeColor
}: AgentContextMenuProps): React.JSX.Element {
  const handleAction = (action: (agentId: string) => void): void => {
    action(agent.id)
    onClose()
  }

  const canPause = agent.status === 'busy' || agent.status === 'idle' || agent.status === 'locked'
  const canResume = agent.status === 'paused'
  const canSendTask = agent.status === 'idle' || agent.status === 'completed' || agent.status === 'locked'

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

      {onSendTask && canSendTask && (
        <button
          data-testid="context-menu-send-task"
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
          onClick={() => handleAction(onSendTask)}
        >
          Send Task
        </button>
      )}

      {onViewNotes && (
        <button
          data-testid="context-menu-view-notes"
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
          onClick={() => handleAction(onViewNotes)}
        >
          View Notes
        </button>
      )}

      {onBreakout && (
        <button
          data-testid="context-menu-breakout"
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
          onClick={() => handleAction(onBreakout)}
        >
          Breakout Terminal
        </button>
      )}

      <button
        data-testid="context-menu-copy-id"
        className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
        onClick={() => handleAction(onCopyId)}
      >
        Copy Agent ID
      </button>

      {onChangeColor && (
        <button
          data-testid="context-menu-change-color"
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-content/10 transition-colors"
          onClick={() => handleAction(onChangeColor)}
        >
          Change Color
        </button>
      )}

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
