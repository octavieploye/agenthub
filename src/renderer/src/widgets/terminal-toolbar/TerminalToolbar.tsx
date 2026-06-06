import { useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'

interface TerminalToolbarProps {
  agent: AgentState
  onPause: (agentId: string) => void
  onResume?: (agentId: string) => void
  onStop: (agentId: string) => void
  onForceKill: (agentId: string) => void
  onBreakout?: (agentId: string) => void
  onAttachTerminal?: (agentId: string) => void
  onDetachTerminal?: (agentId: string) => void
  proxyActive?: boolean
  onReadResponse?: (agentId: string) => void
}

function TerminalToolbar({
  agent,
  onPause,
  onResume,
  onStop,
  onForceKill,
  onBreakout,
  onAttachTerminal,
  onDetachTerminal,
  proxyActive,
  onReadResponse
}: TerminalToolbarProps): React.JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTerminal = agent.status === 'completed' || agent.status === 'interrupted'
  const isPaused = agent.status === 'paused'

  const handleForceKillDown = useCallback(() => {
    if (isTerminal) return
    timerRef.current = setTimeout(() => {
      onForceKill(agent.id)
      timerRef.current = null
    }, 2000)
  }, [agent.id, isTerminal, onForceKill])

  const handleForceKillUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return (
    <div data-testid="terminal-toolbar" className="flex items-center gap-2 px-3 py-1.5 panel-glass border-b border-base-content/10">
      {isPaused ? (
        <button
          data-testid="toolbar-resume"
          className="btn btn-xs btn-ghost"
          onClick={() => onResume?.(agent.id)}
        >
          Resume
        </button>
      ) : (
        <button
          data-testid="toolbar-pause"
          className="btn btn-xs btn-ghost"
          disabled={isTerminal}
          onClick={() => onPause(agent.id)}
        >
          Pause
        </button>
      )}

      <button
        data-testid="toolbar-stop"
        className="btn btn-xs btn-ghost"
        disabled={isTerminal}
        onClick={() => onStop(agent.id)}
      >
        Stop
      </button>

      <button
        data-testid="toolbar-force-kill"
        className="btn btn-xs btn-error btn-ghost"
        disabled={isTerminal}
        onMouseDown={handleForceKillDown}
        onMouseUp={handleForceKillUp}
        onMouseLeave={handleForceKillUp}
      >
        Force Kill
      </button>

      <div className="ml-auto flex items-center gap-1">
        {onReadResponse && agent.voiceMode !== 'off' && (
          <button
            data-testid="toolbar-read-response"
            className="btn btn-xs btn-ghost"
            title="Read response (Cmd+Shift+R)"
            onClick={() => onReadResponse(agent.id)}
          >
            Read
          </button>
        )}
        {(onAttachTerminal || onDetachTerminal) && !isTerminal && (
          proxyActive ? (
            <button
              data-testid="toolbar-detach-terminal"
              className="btn btn-xs btn-ghost text-warning"
              onClick={() => onDetachTerminal?.(agent.id)}
            >
              Detach
            </button>
          ) : (
            <button
              data-testid="toolbar-attach-terminal"
              className="btn btn-xs btn-ghost"
              onClick={() => onAttachTerminal?.(agent.id)}
            >
              Attach
            </button>
          )
        )}
        {onBreakout && (
          <button
            data-testid="toolbar-breakout"
            className="btn btn-xs btn-ghost"
            onClick={() => onBreakout(agent.id)}
          >
            Breakout
          </button>
        )}
      </div>
    </div>
  )
}

export default TerminalToolbar
