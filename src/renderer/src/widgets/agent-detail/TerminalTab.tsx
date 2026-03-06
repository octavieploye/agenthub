import { useState, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import FullTerminal from '../full-terminal/FullTerminal'

interface TerminalTabProps {
  agent: AgentState
  onSendInput: (agentId: string, data: string) => void
}

function getInputConfig(status: AgentState['status']): {
  disabled: boolean
  placeholder: string
} {
  switch (status) {
    case 'busy':
    case 'spawning':
      return { disabled: true, placeholder: 'Agent working...' }
    case 'locked':
      return { disabled: false, placeholder: 'Respond to agent...' }
    case 'idle':
    case 'completed':
      return { disabled: false, placeholder: 'Send a prompt...' }
    case 'paused':
      return { disabled: true, placeholder: 'Agent paused' }
    case 'interrupted':
      return { disabled: true, placeholder: 'Agent interrupted' }
    case 'looping':
      return { disabled: true, placeholder: 'Agent looping...' }
    case 'tray_running':
      return { disabled: false, placeholder: 'Send a prompt...' }
    default:
      return { disabled: true, placeholder: 'Unavailable' }
  }
}

function TerminalTab({ agent, onSendInput }: TerminalTabProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const { disabled, placeholder } = getInputConfig(agent.status)

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    onSendInput(agent.id, trimmed + '\n')
    setInputValue('')
  }, [inputValue, agent.id, onSendInput])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div data-testid="terminal-tab" className="flex flex-col h-full">
      {/* Terminal area */}
      <div className="flex-1 min-h-0">
        <FullTerminal agentId={agent.id} visible={true} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-base-content/10 bg-base-200/50">
        <input
          data-testid="terminal-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 input input-sm input-bordered bg-base-100/50 text-base-content text-xs placeholder:text-base-content/30"
        />
        <button
          data-testid="terminal-send-button"
          className="btn-lcars btn btn-sm btn-primary"
          disabled={disabled || !inputValue.trim()}
          onClick={handleSubmit}
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default TerminalTab
