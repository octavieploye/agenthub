import { useEffect, useState, useCallback, useRef } from 'react'
import { useThemeStore } from '../../stores/theme-store'
import FullTerminal from '../full-terminal/FullTerminal'
import { startIpcListener, injectHistory } from '../full-terminal/terminal-manager'
import type { AgentState } from '@shared/types/agent.types'
import { VoiceInputButton } from '../voice-input-button/VoiceInputButton'
import { isLightColor } from '../agent-detail/color-utils'

interface BreakoutLayoutProps {
  agentId: string
  renderTerminal?: (agentId: string, color?: string) => React.ReactNode
}

function BreakoutLayout({ agentId, renderTerminal }: BreakoutLayoutProps): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme)
  const [agent, setAgent] = useState<AgentState | null>(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Start terminal IPC listener (breakout windows skip App where startIpcListener() normally lives)
  useEffect(() => {
    startIpcListener()
  }, [])

  // Replay DB history into the terminal — breakout windows have a fresh terminal-manager
  // with no historical content, so we fetch from DB and inject before live output arrives.
  useEffect(() => {
    window.agentHub.history.get(agentId).then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        const content = res.data.map((e) => e.content).join('')
        injectHistory(agentId, content)
      }
    })
  }, [agentId])

  // Fetch agent state on mount
  useEffect(() => {
    window.agentHub.agents.getState(agentId).then((res) => {
      if (res.success && res.data) {
        setAgent(res.data)
      }
    })
  }, [agentId])

  // Subscribe to status changes
  useEffect(() => {
    const unsub = window.agentHub.on.agentStatusChange((id, status, confidence) => {
      if (id === agentId) {
        setAgent((prev) =>
          prev
            ? {
                ...prev,
                status,
                confidence
              }
            : prev
        )
      }
    })
    return unsub
  }, [agentId])

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleSendInput = useCallback(
    (text: string) => {
      if (!text.trim()) return
      window.agentHub.agents.sendInput(agentId, text + '\r')
      setInputValue('')
    },
    [agentId]
  )

  const handleVoiceAutoSend = useCallback(() => {
    const el = inputRef.current
    const text = el?.value ?? ''
    if (text.trim()) {
      handleSendInput(text)
      if (el) el.value = ''
    }
  }, [handleSendInput])

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

  const canSendInput =
    agent?.status === 'locked' ||
    agent?.status === 'idle' ||
    agent?.status === 'completed'

  const statusColors: Record<string, string> = {
    busy: 'text-success',
    locked: 'text-warning',
    completed: 'text-info',
    paused: 'text-warning',
    idle: 'text-base-content/50',
    looping: 'text-error',
    interrupted: 'text-error',
    spawning: 'text-info'
  }

  return (
    <div className="flex flex-col h-screen w-screen" data-theme={theme}>
      {/* Minimal header */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0 border-b"
        style={{
          borderBottomColor: `${agent?.color ?? '#3B82F6'}40`,
          backgroundColor: `${agent?.color ?? '#3B82F6'}08`
        }}
      >
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: agent?.color ?? '#3B82F6' }}
        />
        <span className="text-sm font-medium truncate">
          {agent?.name ?? 'Loading...'}
        </span>
        <span className="text-xs text-base-content/50 truncate">
          {agent?.cwd?.split('/').pop() ?? ''}
        </span>
        <span
          className={`text-xs font-medium ml-auto ${statusColors[agent?.status ?? 'idle'] ?? ''}`}
        >
          {agent?.status ?? '...'}
        </span>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0">
        {renderTerminal
          ? renderTerminal(agentId, agent?.color)
          : <FullTerminal agentId={agentId} agentColor={agent?.color} visible={true} skipBootOverlay />}
      </div>

      {/* Inline input */}
      <div className="px-3 py-2 shrink-0 border-t border-base-content/10">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            data-testid="breakout-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSendInput) {
                handleSendInput(inputValue)
              }
            }}
            placeholder={
              !agent
                ? 'Loading...'
                : canSendInput
                  ? 'Send task or response...'
                  : `Agent ${agent.status}...`
            }
            className="input input-sm input-bordered flex-1 bg-base-200/50 text-sm"
            style={{ borderColor: `${agent?.color ?? '#3B82F6'}40` }}
          />
          <VoiceInputButton inputRef={inputRef} onAutoSend={handleVoiceAutoSend} />
          <button
            data-testid="breakout-send"
            onClick={() => handleSendInput(inputValue)}
            disabled={!canSendInput || !inputValue.trim()}
            className="btn btn-sm"
            style={{ backgroundColor: agent?.color ?? '#3B82F6', color: isLightColor(agent?.color ?? '#3B82F6') ? '#1e1e2e' : '#ffffff' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default BreakoutLayout
