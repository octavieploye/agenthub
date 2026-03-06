import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import type { HistoryEntry } from '@shared/types/history.types'

interface HistoryTabProps {
  agent: AgentState
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function highlightMatch(text: string, query: string): React.JSX.Element {
  if (!query.trim()) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-warning/40 text-base-content rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default function HistoryTab({ agent }: HistoryTabProps): React.JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.agentHub.history.get(agent.id).then((response) => {
      if (cancelled) return
      if (response.success) {
        setEntries(response.data)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [agent.id])

  useEffect(() => {
    if (scrollRef.current && !searchQuery) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, searchQuery])

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

      if (!query.trim()) {
        window.agentHub.history.get(agent.id).then((response) => {
          if (response.success) setEntries(response.data)
        })
        return
      }

      searchTimerRef.current = setTimeout(() => {
        window.agentHub.history.search(agent.id, query).then((response) => {
          if (response.success) {
            setEntries(
              response.data.map((r) => ({
                id: r.id,
                agentId: r.agentId,
                content: r.content,
                createdAt: r.createdAt
              }))
            )
          }
        })
      }, 300)
    },
    [agent.id]
  )

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-2">
        <input
          type="text"
          placeholder="Search output..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="input input-bordered input-sm w-full bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:border-primary/40 focus:outline-none"
        />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-dots loading-sm text-base-content/40" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-base-content/40">No output recorded yet</p>
          </div>
        )}

        {!loading &&
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex gap-3 py-1.5 border-b border-base-content/5 last:border-b-0"
            >
              <span className="text-[10px] font-mono text-base-content/40 pt-0.5 shrink-0">
                {formatTimestamp(entry.createdAt)}
              </span>
              <pre className="text-xs font-mono text-base-content/80 whitespace-pre-wrap break-all flex-1 m-0">
                {searchQuery.trim()
                  ? highlightMatch(stripAnsi(entry.content), searchQuery)
                  : stripAnsi(entry.content)}
              </pre>
            </div>
          ))}
      </div>
    </div>
  )
}
