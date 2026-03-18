import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAgentStore } from '@renderer/stores/agent-store'
import { searchAllTerminals, type TerminalSearchHit } from '../full-terminal/terminal-manager'

interface TerminalSearchPanelProps {
  onClose: () => void
  onSelectAgent: (agentId: string) => void
}

function TerminalSearchPanel({ onClose, onSelectAgent }: TerminalSearchPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TerminalSearchHit[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const agents = useAgentStore((s) => s.agents)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSearch = useCallback(() => {
    if (!query.trim()) return
    const hits = searchAllTerminals(query)
    setResults(hits)
    setHasSearched(true)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSearch()
      }
    },
    [handleSearch]
  )

  // Group results by agent
  const grouped = useMemo(() => {
    const map = new Map<string, TerminalSearchHit[]>()
    for (const hit of results) {
      const existing = map.get(hit.agentId)
      if (existing) {
        existing.push(hit)
      } else {
        map.set(hit.agentId, [hit])
      }
    }
    return map
  }, [results])

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-black/40" onClick={onClose}>
      <div
        className="dropdown-panel w-[560px] max-h-[70vh] flex flex-col bg-base-200 border border-base-content/10 rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="px-3 py-2 border-b border-base-content/10">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search across all terminal output..."
              className="input input-bordered w-full rounded-xl bg-base-200/50 text-sm pl-9"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!hasSearched && (
            <div className="px-4 py-8 text-center text-xs text-base-content/40">
              Type a query and press Enter to search all terminal output
            </div>
          )}

          {hasSearched && results.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-base-content/40">
              No matches found for &quot;{query}&quot;
            </div>
          )}

          {hasSearched && results.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] text-base-content/40">
                {results.length} match{results.length !== 1 ? 'es' : ''} across {grouped.size} agent{grouped.size !== 1 ? 's' : ''}
              </div>
              {Array.from(grouped.entries()).map(([agentId, hits]) => {
                const agent = agents.get(agentId)
                const agentName = agent?.name ?? agentId.slice(0, 8)
                const agentColor = agent?.color ?? '#3B82F6'

                return (
                  <div key={agentId} className="mb-1">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-base-content/5 transition-colors"
                      onClick={() => {
                        onSelectAgent(agentId)
                        onClose()
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: agentColor }}
                      />
                      <span className="text-xs font-medium">{agentName}</span>
                      <span className="text-[10px] text-base-content/40">{hits.length} hit{hits.length !== 1 ? 's' : ''}</span>
                    </button>
                    <div className="pl-7 pr-3">
                      {hits.slice(0, 5).map((hit, i) => (
                        <button
                          key={i}
                          className="w-full text-left py-0.5 hover:bg-base-content/5 rounded px-1 transition-colors"
                          onClick={() => {
                            onSelectAgent(agentId)
                            onClose()
                          }}
                        >
                          <span className="text-[10px] text-base-content/30 mr-2">L{hit.lineNumber}</span>
                          <HighlightedText text={hit.line} query={query} />
                        </button>
                      ))}
                      {hits.length > 5 && (
                        <div className="text-[10px] text-base-content/30 py-0.5 px-1">
                          ...and {hits.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }): React.JSX.Element {
  const trimmed = text.trim()
  if (!query) return <span className="text-[11px] font-mono text-base-content/60 truncate">{trimmed}</span>

  const lowerText = trimmed.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)

  if (idx === -1) return <span className="text-[11px] font-mono text-base-content/60 truncate">{trimmed}</span>

  const before = trimmed.slice(0, idx)
  const match = trimmed.slice(idx, idx + query.length)
  const after = trimmed.slice(idx + query.length)

  return (
    <span className="text-[11px] font-mono text-base-content/60 truncate">
      {before}
      <mark className="bg-warning/30 text-warning-content rounded-sm px-0.5">{match}</mark>
      {after}
    </span>
  )
}

export default TerminalSearchPanel
