import { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchResult } from '@shared/types/search.types'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onSelectResult: (result: SearchResult) => void
}

const TYPE_LABELS: Record<string, string> = {
  agent: 'Agent',
  task: 'Task',
  repo: 'Repo',
  terminal: 'Terminal'
}

const TYPE_COLORS: Record<string, string> = {
  agent: 'text-primary',
  task: 'text-warning',
  repo: 'text-success',
  terminal: 'text-info'
}

function highlightMatch(text: string, query: string): React.JSX.Element {
  if (!query) return <>{text}</>
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-primary/30 text-inherit rounded-sm">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

function groupResults(results: SearchResult[]): Map<string, SearchResult[]> {
  const groups = new Map<string, SearchResult[]>()
  for (const r of results) {
    const group = groups.get(r.type) ?? []
    group.push(r)
    groups.set(r.type, group)
  }
  return groups
}

function CommandPalette({ open, onClose, onSelectResult }: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const response = await window.agentHub.search.query(q)
      if (response.success) {
        setResults(response.data)
        setSelectedIndex(0)
      }
    } catch {
      // Search failure is not critical
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => performSearch(value), 150)
    },
    [performSearch]
  )

  const flatResults = results
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (flatResults[selectedIndex]) {
          onSelectResult(flatResults[selectedIndex])
          onClose()
        }
        return
      }
    },
    [flatResults, selectedIndex, onClose, onSelectResult]
  )

  if (!open) return null

  const grouped = groupResults(results)

  return (
    <div
      data-testid="command-palette-overlay"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        data-testid="command-palette"
        className="panel-glass w-full max-w-[600px] relative z-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-base-content/10">
          <span className="text-base-content/40 text-sm">Search</span>
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search agents, tasks, repos, terminal output..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/30"
          />
          <kbd className="text-[10px] text-base-content/30 bg-base-content/5 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        <div
          data-testid="command-palette-results"
          className="max-h-[400px] overflow-y-auto"
        >
          {loading && (
            <div className="px-4 py-6 text-center text-xs text-base-content/40">Searching...</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-base-content/40">
              No results for "{query}"
            </div>
          )}

          {!loading && !query && (
            <div className="px-4 py-6 text-center text-xs text-base-content/40">
              Type to search across agents, tasks, repos, and terminal output
            </div>
          )}

          {!loading &&
            Array.from(grouped.entries()).map(([type, items]) => {
              let globalIdx = 0
              for (const [t, itms] of grouped.entries()) {
                if (t === type) break
                globalIdx += itms.length
              }

              return (
                <div key={type}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold text-base-content/40 uppercase tracking-widest bg-base-content/3">
                    {TYPE_LABELS[type] ?? type}
                  </div>
                  {items.map((result, i) => {
                    const isSelected = selectedIndex === globalIdx + i
                    return (
                      <button
                        key={`${result.type}-${result.id}-${i}`}
                        data-testid={`search-result-${result.type}-${result.id}`}
                        onClick={() => {
                          onSelectResult(result)
                          onClose()
                        }}
                        className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-base-content/5'
                        }`}
                      >
                        <span className={`text-[10px] font-bold ${TYPE_COLORS[result.type] ?? ''}`}>
                          {TYPE_LABELS[result.type]?.[0] ?? '?'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">
                            {highlightMatch(result.title, query)}
                          </div>
                          <div className="text-xs text-base-content/40 truncate">
                            {result.subtitle}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
