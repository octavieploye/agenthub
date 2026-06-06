import { useState, useCallback, useRef, useEffect } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { VoiceInputButton } from '../voice-input-button/VoiceInputButton'
import { isLightColor } from '../agent-detail/color-utils'

interface InlineTaskInputProps {
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
      return { disabled: false, placeholder: 'Send a prompt to resume...' }
    case 'looping':
      return { disabled: true, placeholder: 'Agent looping...' }
    case 'tray_running':
      return { disabled: false, placeholder: 'Send a prompt...' }
    default:
      return { disabled: true, placeholder: 'Unavailable' }
  }
}

function InlineTaskInput({ agent, onSendInput }: InlineTaskInputProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { disabled, placeholder } = getInputConfig(agent.status)

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    onSendInput(agent.id, trimmed + '\r')
    setInputValue('')
  }, [inputValue, agent.id, onSendInput])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text')
      if (!text) return
      const el = e.currentTarget
      const start = el.selectionStart ?? inputValue.length
      const end = el.selectionEnd ?? inputValue.length
      const next = inputValue.slice(0, start) + text + inputValue.slice(end)
      setInputValue(next)
      requestAnimationFrame(() => {
        el.selectionStart = start + text.length
        el.selectionEnd = start + text.length
      })
    },
    [inputValue]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  // Cmd+L to focus input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  return (
    <div
      data-testid="inline-task-input"
      className="shrink-0 flex items-center gap-2 px-3 py-2 border-t"
      style={{ borderTopColor: `${agent.color}30` }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: agent.color }}
      />
      <input
        ref={inputRef}
        data-testid="inline-input-field"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        disabled={disabled && !inputValue.trim()}
        placeholder={placeholder}
        className="flex-1 input input-sm input-bordered bg-base-100/50 text-base-content text-xs placeholder:text-base-content/30"
      />
      <VoiceInputButton inputRef={inputRef} />
      <button
        data-testid="inline-send-button"
        className="btn btn-sm text-xs"
        style={{ backgroundColor: agent.color, color: isLightColor(agent.color) ? '#1e1e2e' : '#ffffff' }}
        disabled={!inputValue.trim()}
        onClick={handleSubmit}
      >
        Send
      </button>
      <span className="text-[11px] text-base-content/60 hidden sm:inline">
        {disabled ? '' : 'Enter'}
      </span>
    </div>
  )
}

export default InlineTaskInput
