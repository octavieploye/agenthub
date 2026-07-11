import { useState, useEffect } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import FullTerminal from '../full-terminal/FullTerminal'
import TerminalToolbar from '../terminal-toolbar/TerminalToolbar'

interface TerminalTabProps {
  agent: AgentState
  onBreakout?: (agentId: string) => void
  onPause?: (agentId: string) => void
  onResume?: (agentId: string) => void
  onKill?: (agentId: string) => void
  onAttachTerminal?: (agentId: string) => void
  onDetachTerminal?: (agentId: string) => void
  proxyActive?: boolean
  onReadResponse?: (agentId: string) => void
}

function TerminalTab({ agent, onBreakout, onPause, onResume, onKill, onAttachTerminal, onDetachTerminal, proxyActive, onReadResponse, visible = true }: TerminalTabProps & { visible?: boolean }): React.JSX.Element {
  const [pathMismatch, setPathMismatch] = useState(false)

  useEffect(() => {
    const unsub = window.agentHub.on.agentErrorDetail((payload) => {
      if (payload.agentId === agent.id && payload.errorType === 'PATH_MISMATCH') {
        setPathMismatch(true)
      }
    })
    return unsub
  }, [agent.id])

  return (
    <div data-testid="terminal-tab" className="flex flex-col h-full">
      {/* Toolbar with breakout */}
      <TerminalToolbar
        agent={agent}
        onPause={onPause ?? (() => {})}
        onResume={onResume}
        onStop={onKill ?? (() => {})}
        onForceKill={onKill ?? (() => {})}
        onBreakout={onBreakout}
        onAttachTerminal={onAttachTerminal}
        onDetachTerminal={onDetachTerminal}
        proxyActive={proxyActive}
        onReadResponse={onReadResponse}
      />

      {/* S16: PATH_MISMATCH install guide */}
      {pathMismatch && (
        <div className="alert alert-warning rounded-none shrink-0 flex items-center justify-between gap-3 px-4 py-2 text-xs">
          <span>
            Claude CLI not found in PATH. Install it from claude.ai/download, then respawn this agent.
          </span>
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => setPathMismatch(false)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 min-h-0">
        <FullTerminal agentId={agent.id} agentColor={agent.color} visible={visible} />
      </div>
    </div>
  )
}

export default TerminalTab
