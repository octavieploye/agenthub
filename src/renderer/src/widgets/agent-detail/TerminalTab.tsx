import type { AgentState } from '@shared/types/agent.types'
import FullTerminal from '../full-terminal/FullTerminal'
import TerminalToolbar from '../terminal-toolbar/TerminalToolbar'

interface TerminalTabProps {
  agent: AgentState
  onBreakout?: (agentId: string) => void
  onPause?: (agentId: string) => void
  onResume?: (agentId: string) => void
  onKill?: (agentId: string) => void
}

function TerminalTab({ agent, onBreakout, onPause, onResume, onKill }: TerminalTabProps): React.JSX.Element {
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
      />

      {/* Terminal area */}
      <div className="flex-1 min-h-0">
        <FullTerminal agentId={agent.id} visible={true} />
      </div>
    </div>
  )
}

export default TerminalTab
