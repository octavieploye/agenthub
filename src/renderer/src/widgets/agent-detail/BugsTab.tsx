import { useState, useEffect, useCallback, useRef } from 'react'
import { useBugStore } from '../../stores/bug-store'
import { VoiceInputButton } from '../voice-input-button/VoiceInputButton'
import { parseBugVoice } from '../../helpers/parse-voice-fields'
import { isLightColor } from './color-utils'
import type { AgentState } from '@shared/types/agent.types'
import type { BugEntry, BugSeverity } from '@shared/types/bug-radar.types'

interface BugsTabProps {
  agent: AgentState
  onSendToAgent?: (task: string) => void
}

const SEVERITY_BADGE: Record<BugSeverity, string> = {
  critical: 'badge-error',
  high: 'badge-warning',
  medium: 'badge-info',
  low: 'badge-ghost'
}

const ERROR_TYPES = [
  'test_failure',
  'compile_error',
  'runtime_error',
  'lint_error',
  'type_error',
  'other'
] as const

function sortBugs(bugs: BugEntry[]): BugEntry[] {
  const severityOrder: Record<BugSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  }

  return [...bugs].sort((a, b) => {
    const aResolved = a.resolvedAt ? 1 : 0
    const bResolved = b.resolvedAt ? 1 : 0
    if (aResolved !== bResolved) return aResolved - bResolved
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

function truncatePath(filePath: string, maxLength: number = 50): string {
  if (filePath.length <= maxLength) return filePath
  const parts = filePath.split('/')
  let result = parts[parts.length - 1]
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i] + '/' + result
    if (candidate.length > maxLength) {
      return '.../' + result
    }
    result = candidate
  }
  return result
}

export default function BugsTab({ agent, onSendToAgent }: BugsTabProps): React.JSX.Element {

  const bugs = useBugStore((s) => s.bugs)
  const fetchBugsOnce = useBugStore((s) => s.fetchBugsOnce)
  const loading = useBugStore((s) => s.loading)
  const createBug = useBugStore((s) => s.createBug)
  const resolveBug = useBugStore((s) => s.resolveBug)
  const deleteBug = useBugStore((s) => s.deleteBug)

  const [newMessage, setNewMessage] = useState('')
  const [newFilePath, setNewFilePath] = useState('')
  const [newErrorType, setNewErrorType] = useState<string>('runtime_error')
  const [newSeverity, setNewSeverity] = useState<BugSeverity>('medium')
  const bugInputRef = useRef<HTMLInputElement>(null)
  const voiceParsedRef = useRef(false)

  useEffect(() => {
    fetchBugsOnce()
  }, [fetchBugsOnce])

  useEffect(() => {
    if (voiceParsedRef.current || !newMessage) return
    const hasMarkers = /\b(?:description|message|bug|severity|file\s*path?|type)\s*[:.]?\s/i.test(newMessage)
    if (!hasMarkers) return
    voiceParsedRef.current = true
    const parsed = parseBugVoice(newMessage)
    setNewMessage(parsed.message)
    if (parsed.severity !== 'medium' || /\b(?:medium)\b/i.test(newMessage)) setNewSeverity(parsed.severity)
    if (parsed.filePath) setNewFilePath(parsed.filePath)
    if (parsed.errorType !== 'runtime_error') setNewErrorType(parsed.errorType)
  }, [newMessage])

  const repoBugs = sortBugs(bugs.filter((b) => b.repoId === agent.repoId))

  const handleAdd = useCallback(async () => {
    const message = newMessage.trim()
    if (!message) return
    await createBug({
      agentId: agent.id,
      agentName: agent.name,
      repoId: agent.repoId,
      repoName: agent.cwd.split('/').pop() || agent.repoId,
      errorType: newErrorType,
      filePath: newFilePath.trim() || 'unknown',
      message,
      severity: newSeverity
    })
    setNewMessage('')
    setNewFilePath('')
    setNewErrorType('runtime_error')
    setNewSeverity('medium')
    voiceParsedRef.current = false
  }, [newMessage, newFilePath, newErrorType, newSeverity, agent, createBug])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd]
  )

  const handleResolve = useCallback(
    (id: string) => {
      resolveBug(id)
    },
    [resolveBug]
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteBug(id)
    },
    [deleteBug]
  )

  const agentColor = agent.color || '#3B82F6'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-dots loading-sm text-base-content/40" />
          </div>
        )}

        {!loading && repoBugs.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-base-content/40">No bugs tracked for this repo</p>
          </div>
        )}

        {!loading &&
          repoBugs.map((bug) => (
            <div
              key={bug.id}
              className={`px-3 py-2.5 border-b border-base-content/5 last:border-b-0 space-y-1 hover:bg-base-content/5 transition-colors ${
                bug.resolvedAt ? 'opacity-40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`badge badge-xs ${SEVERITY_BADGE[bug.severity]} shrink-0`}>
                    {bug.severity}
                  </span>
                  <span className="text-xs font-medium text-base-content/70 shrink-0">
                    {bug.errorType}
                  </span>
                  <span className="text-[10px] font-mono text-base-content/40 truncate">
                    {truncatePath(bug.filePath)}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {!bug.resolvedAt && (
                    <>
                      <button
                        onClick={() => {
                          const prompt = `Fix bug: ${bug.message}${bug.filePath !== 'unknown' ? ` in ${bug.filePath}` : ''} (${bug.errorType}, ${bug.severity})`
                          onSendToAgent?.(prompt)
                          handleResolve(bug.id)
                        }}
                        className="btn btn-ghost btn-xs text-success"
                        title="Send to agent & resolve"
                      >
                        Fix
                      </button>
                      <button
                        onClick={() => handleResolve(bug.id)}
                        className="btn btn-ghost btn-xs text-success/50"
                        title="Mark resolved without sending to agent"
                      >
                        ✓
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(bug.id)}
                    className="btn btn-ghost btn-xs text-error/60"
                    title="Delete bug"
                  >
                    Del
                  </button>
                </div>
              </div>

              <p className="text-xs text-base-content/50 truncate">{bug.message}</p>
            </div>
          ))}
      </div>

      <div className="border-t border-base-content/10 p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={bugInputRef}
            type="text"
            placeholder="Bug description (voice: 'severity high file path src/foo.ts ...')"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input input-bordered input-sm flex-1 bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:outline-none"
            style={{ borderColor: `${agentColor}30` }}
          />
          <VoiceInputButton inputRef={bugInputRef} />
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as BugSeverity)}
            className="select select-bordered select-sm bg-base-100/50 text-xs border-base-content/10"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={handleAdd}
            className="btn-lcars text-[10px] px-3 py-1"
            style={{ backgroundColor: agentColor, color: isLightColor(agentColor) ? '#1e1e2e' : '#ffffff' }}
          >
            Add
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="File path (optional)..."
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            className="input input-bordered input-sm flex-1 bg-base-100/50 text-xs text-base-content placeholder:text-base-content/30 border-base-content/10 focus:outline-none"
            style={{ borderColor: `${agentColor}30` }}
          />
          <select
            value={newErrorType}
            onChange={(e) => setNewErrorType(e.target.value)}
            className="select select-bordered select-sm bg-base-100/50 text-xs border-base-content/10"
          >
            {ERROR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
