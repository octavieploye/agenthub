import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import type { HistoryEntry } from '@shared/types/history.types'
import { useHistoryStore } from '../../stores/history-store'

const ITEM_HEIGHT = 60
const BUFFER = 5

interface HistoryTabProps {
  agent: AgentState
}

interface VirtualizedHistoryListProps {
  entries: HistoryEntry[]
  renderEntry: (entry: HistoryEntry, index: number) => React.JSX.Element
}

function VirtualizedHistoryList({
  entries,
  renderEntry
}: VirtualizedHistoryListProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((resizeEntries) => {
      for (const resizeEntry of resizeEntries) {
        setContainerHeight(resizeEntry.contentRect.height)
      }
    })
    observer.observe(el)
    setContainerHeight(el.clientHeight)
    return () => observer.disconnect()
  }, [])

  const totalHeight = entries.length * ITEM_HEIGHT

  const startIndex = useMemo(
    () => Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER),
    [scrollTop]
  )

  const endIndex = useMemo(
    () => Math.min(entries.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER),
    [scrollTop, containerHeight, entries.length]
  )

  const visibleEntries = useMemo(
    () => entries.slice(startIndex, endIndex),
    [entries, startIndex, endIndex]
  )

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return (
    <div
      ref={containerRef}
      data-testid="virtualized-list-container"
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 pb-3"
    >
      <div
        data-testid="virtualized-list-spacer"
        style={{ height: totalHeight, position: 'relative' }}
      >
        <div
          data-testid="virtualized-list-window"
          style={{ position: 'absolute', top: startIndex * ITEM_HEIGHT, width: '100%' }}
        >
          {visibleEntries.map((entry, i) => renderEntry(entry, startIndex + i))}
        </div>
      </div>
    </div>
  )
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

function shouldCollapse(content: string): boolean {
  return content.length > 500
}

function getLineCount(content: string): number {
  return content.split('\n').length
}

function truncateContent(content: string): string {
  const lines = content.split('\n')
  return lines.slice(0, 3).join('\n')
}

function getTimelineMarkerClass(
  content: string,
  index: number,
  total: number,
  agentStatus: string
): string {
  if (index === 0) return 'bg-success'
  if (index === total - 1 && agentStatus === 'completed') return 'bg-info'

  const stripped = stripAnsi(content)
  if (/\berror\b/i.test(stripped)) return 'bg-error'
  if (/\b(checkpoint|saved)\b/i.test(stripped)) return 'bg-warning'

  return 'bg-base-content/20'
}

function generateMarkdownExport(agent: AgentState, entries: HistoryEntry[]): string {
  const dateStr = new Date().toISOString().split('T')[0]
  let md = `# Agent Session: ${agent.name}\n`
  md += `Repository: ${agent.cwd}\n`
  md += `Date: ${dateStr}\n\n---\n\n`

  for (const entry of entries) {
    const ts = formatTimestamp(entry.createdAt)
    const content = stripAnsi(entry.content)
    md += `## [${ts}]\n${content}\n\n`
  }

  return md
}

function generatePlainTextExport(entries: HistoryEntry[]): string {
  return entries
    .map((entry) => `[${formatTimestamp(entry.createdAt)}] ${stripAnsi(entry.content)}`)
    .join('\n')
}

export default function HistoryTab({ agent }: HistoryTabProps): React.JSX.Element {
  const entries = useHistoryStore((s) => s.entries)
  const loading = useHistoryStore((s) => s.loading)

  const fetchHistoryOnce = useHistoryStore((s) => s.fetchHistoryOnce)
  const searchHistory = useHistoryStore((s) => s.searchHistory)
  const fetchHistory = useHistoryStore((s) => s.fetchHistory)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set())
  const [copyFeedback, setCopyFeedback] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchHistoryOnce(agent.id)
  }, [agent.id, fetchHistoryOnce])

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

      if (!query.trim()) {
        fetchHistory(agent.id)
        return
      }

      searchTimerRef.current = setTimeout(() => {
        searchHistory(agent.id, query)
      }, 300)
    },
    [agent.id, fetchHistory, searchHistory]
  )

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const handleExport = useCallback(() => {
    const markdown = generateMarkdownExport(agent, entries)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const dateStr = new Date().toISOString().split('T')[0]
    const a = document.createElement('a')
    a.href = url
    a.download = `${agent.name}-history-${dateStr}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [agent, entries])

  const handleCopy = useCallback(() => {
    const text = generatePlainTextExport(entries)
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    })
  }, [entries])

  const toggleExpand = useCallback((entryId: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }, [])

  const renderEntry = useCallback(
    (entry: HistoryEntry, index: number): React.JSX.Element => {
      const stripped = stripAnsi(entry.content)
      const isCollapsible = shouldCollapse(stripped)
      const isExpanded = expandedEntries.has(entry.id)
      const markerClass = getTimelineMarkerClass(
        entry.content,
        index,
        entries.length,
        agent.status
      )

      return (
        <div
          key={entry.id}
          data-testid={`history-entry-${entry.id}`}
          className="flex gap-2 py-1.5 border-b border-base-content/5 last:border-b-0"
        >
          {/* Timeline marker */}
          <span
            data-testid={`timeline-marker-${index}`}
            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${markerClass}`}
          />

          {/* Timestamp */}
          <span className="text-[10px] font-mono text-base-content/40 pt-0.5 shrink-0">
            {formatTimestamp(entry.createdAt)}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <pre className="text-xs font-mono text-base-content/80 whitespace-pre-wrap break-all m-0">
              {isCollapsible && !isExpanded
                ? searchQuery.trim()
                  ? highlightMatch(truncateContent(stripped), searchQuery)
                  : truncateContent(stripped)
                : searchQuery.trim()
                  ? highlightMatch(stripped, searchQuery)
                  : stripped}
            </pre>
            {isCollapsible && (
              <button
                data-testid={`expand-toggle-${entry.id}`}
                onClick={() => toggleExpand(entry.id)}
                className="text-[10px] text-primary hover:text-primary/80 mt-0.5"
              >
                {isExpanded
                  ? 'Show less'
                  : `Show more (${getLineCount(stripped)} lines)`}
              </button>
            )}
          </div>
        </div>
      )
    },
    [expandedEntries, entries.length, agent.status, searchQuery, toggleExpand]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 pb-2">
        <input
          type="text"
          placeholder="Search output..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="input input-bordered input-sm flex-1 bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:border-primary/40 focus:outline-none"
        />
        <button
          data-testid="history-copy"
          onClick={handleCopy}
          className="btn btn-ghost btn-xs text-base-content/50 hover:text-base-content/80"
          title="Copy conversation"
        >
          {copyFeedback ? (
            <span className="text-[10px] text-success font-medium">Copied!</span>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        <button
          data-testid="history-export"
          onClick={handleExport}
          className="btn btn-ghost btn-xs text-base-content/50 hover:text-base-content/80"
          title="Export as Markdown"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>

      {/* Entry list */}
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

      {!loading && entries.length > 0 && (
        <VirtualizedHistoryList entries={entries} renderEntry={renderEntry} />
      )}
    </div>
  )
}
