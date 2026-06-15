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
  onSpawnContinuation?: (agentId: string) => void
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
  onChangeColor,
  onSpawnContinuation
}: AgentContextMenuProps): React.JSX.Element {
  const handleAction = (action: (agentId: string) => void): void => {
    action(agent.id)
    onClose()
  }

  const canPause = agent.status === 'busy' || agent.status === 'idle' || agent.status === 'locked'
  const canResume = agent.status === 'paused'
  const canSendTask = agent.status === 'idle' || agent.status === 'completed' || agent.status === 'locked'
  const canContinue = agent.status === 'completed' || agent.status === 'interrupted'

  return (
    <div
      data-testid="context-menu"
      className="dropdown-panel min-w-[160px] fixed"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {canPause && (
        <button
          data-testid="context-menu-pause"
          className="dropdown-item w-full text-left text-xs"
          onClick={() => handleAction(onPause)}
        >
          Pause
        </button>
      )}

      {canResume && (
        <button
          data-testid="context-menu-resume"
          className="dropdown-item w-full text-left text-xs"
          onClick={() => handleAction(onResume)}
        >
          Resume
        </button>
      )}

      <button
        data-testid="context-menu-view-output"
        className="dropdown-item w-full text-left text-xs"
        onClick={() => handleAction(onViewOutput)}
      >
        View Output
      </button>

      {onSendTask && canSendTask && (
        <button
          data-testid="context-menu-send-task"
          className="dropdown-item w-full text-left text-xs"
          onClick={() => handleAction(onSendTask)}
        >
          Send Task
        </button>
      )}

      {onViewNotes && (
        <button
          data-testid="context-menu-view-notes"
          className="dropdown-item w-full text-left text-xs"
          onClick={() => handleAction(onViewNotes)}
        >
          View Notes
        </button>
      )}

      {onBreakout && (
        <button
          data-testid="context-menu-breakout"
          className="dropdown-item w-full text-left text-xs"
          onClick={() => handleAction(onBreakout)}
        >
          Breakout Terminal
        </button>
      )}

      <button
        data-testid="context-menu-copy-id"
        className="dropdown-item w-full text-left text-xs"
        onClick={() => handleAction(onCopyId)}
      >
        Copy Agent ID
      </button>

      {onChangeColor && (
        <button
          data-testid="context-menu-change-color"
          className="dropdown-item w-full text-left text-xs"
          onClick={() => handleAction(onChangeColor)}
        >
          Change Color
        </button>
      )}

      {onSpawnContinuation && canContinue && (
        <button
          data-testid="context-menu-spawn-continuation"
          className="dropdown-item w-full text-left text-xs"
          onClick={() => handleAction(onSpawnContinuation)}
        >
          Spawn Continuation
        </button>
      )}

      <div data-testid="context-menu-divider" className="border-t border-base-content/10 my-1" />

      <button
        data-testid="context-menu-kill"
        className="dropdown-item w-full text-left text-xs text-error"
        onClick={() => handleAction(onKill)}
      >
        Kill
      </button>
    </div>
  )
}

export default AgentContextMenu
