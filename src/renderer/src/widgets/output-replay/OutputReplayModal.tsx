import { useEffect, useState, useRef } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { stripAnsi } from '../continuation-dialog/buildContinuationPrompt'

interface OutputReplayModalProps {
  agent: AgentState
  onClose: () => void
  onSpawnContinuation: (agentId: string) => void
  onDropAgent: (agentId: string) => void
}

export function OutputReplayModal({
  agent,
  onClose,
  onSpawnContinuation,
  onDropAgent
}: OutputReplayModalProps): React.JSX.Element {
  const [output, setOutput] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    window.agentHub.history.get(agent.id).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        const joined = res.data.map((e) => e.content).join('')
        setOutput(stripAnsi(joined))
      } else {
        setError('Failed to load terminal output.')
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled) {
        setError('Failed to load terminal output.')
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [agent.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [output])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel-glass flex flex-col w-full max-w-4xl max-h-[85vh] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-base-content">{agent.name}</span>
            <span className="text-[11px] bg-warning/20 text-warning px-2 py-0.5 rounded-full capitalize">
              {agent.status}
            </span>
            <span className="text-[11px] text-base-content/40">{agent.cwd}</span>
          </div>
          <button
            className="btn btn-xs btn-ghost text-base-content/60"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Output area */}
        <div className="flex-1 overflow-y-auto bg-base-100/80 p-4">
          {loading && (
            <div className="text-sm text-base-content/40 text-center py-8">
              Loading terminal output…
            </div>
          )}
          {error && (
            <div className="text-sm text-error text-center py-8">{error}</div>
          )}
          {!loading && !error && (
            <pre className="text-xs font-mono text-base-content/80 whitespace-pre-wrap break-all leading-relaxed">
              {output || '(no output recorded for this agent)'}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-base-content/10 shrink-0">
          <button
            className="btn btn-xs btn-ghost text-error hover:bg-error/10"
            onClick={() => {
              onDropAgent(agent.id)
              onClose()
            }}
          >
            Drop Agent
          </button>
          <div className="flex gap-2">
            <button
              className="btn btn-xs btn-ghost text-base-content/60"
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="btn btn-xs btn-primary"
              onClick={() => onSpawnContinuation(agent.id)}
            >
              Spawn Continuation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
