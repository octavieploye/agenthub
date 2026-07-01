import { useEffect, useRef, useCallback, useState, type MouseEvent } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '@renderer/stores/theme-store'
import {
  getOrCreateTerminal,
  attachToContainer,
  detachFromContainer,
  setVisible as setTerminalVisible,
  fitTerminal,
  updateTheme,
  getTerminal,
  getSearchAddon,
  getSerializeAddon,
  hasReceivedData,
  onClaudeReady,
} from './terminal-manager'
import TerminalContextMenu from './TerminalContextMenu'

interface FullTerminalProps {
  agentId: string
  agentColor?: string
  visible: boolean
  onReady?: () => void
  onTitleChange?: (agentId: string, title: string) => void
  onSerialize?: (agentId: string, serialize: () => string) => void
}

function FullTerminal({ agentId, agentColor, visible, onReady, onTitleChange, onSerialize }: FullTerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  // Boot overlay: covers the terminal with the xterm background until Claude's welcome box
  // appears, hiding the brief shell prompt / clear sequence on first launch.
  // Skipped for agents that already have data (re-selecting an existing agent).
  const [bootOverlay, setBootOverlay] = useState(() => !hasReceivedData(agentId))

  useEffect(() => {
    if (!bootOverlay) return
    // Safety net: always remove after 8 s in case detection misses
    const safetyTimer = setTimeout(() => setBootOverlay(false), 8000)
    const unregister = onClaudeReady(agentId, () => setBootOverlay(false))
    return () => {
      clearTimeout(safetyTimer)
      unregister()
    }
  }, [agentId]) // intentionally omits bootOverlay — runs once per agent

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Stable refs for callbacks
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onTitleChangeRef = useRef(onTitleChange)
  onTitleChangeRef.current = onTitleChange
  const onSerializeRef = useRef(onSerialize)
  onSerializeRef.current = onSerialize

  // Search handlers
  const handleSearchNext = useCallback(() => {
    const addon = getSearchAddon(agentId)
    if (addon && searchQuery) addon.findNext(searchQuery)
  }, [searchQuery, agentId])

  const handleSearchPrev = useCallback(() => {
    const addon = getSearchAddon(agentId)
    if (addon && searchQuery) addon.findPrevious(searchQuery)
  }, [searchQuery, agentId])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
    getSearchAddon(agentId)?.clearDecorations()
    getTerminal(agentId)?.focus()
  }, [agentId])

  // Live search as user types
  useEffect(() => {
    if (searchOpen && searchQuery) {
      getSearchAddon(agentId)?.findNext(searchQuery)
    }
  }, [searchQuery, searchOpen, agentId])

  // Theme subscription
  const theme = useThemeStore((s) => s.theme)

  // Theme sync effect — apply DaisyUI theme AFTER initial render
  useEffect(() => {
    updateTheme()
  }, [theme])

  // Main terminal lifecycle: attach persistent terminal to container
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    // Get or create the persistent terminal and attach to this container
    const managed = getOrCreateTerminal(agentId)
    attachToContainer(agentId, container)

    // Wire keyboard shortcuts (component-scoped — replaceable on remount)
    managed.term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === 'c' && managed.term.hasSelection()) {
        window.agentHub.clipboard.writeText(managed.term.getSelection())
        return false
      }

      if (isMeta && e.key === 'f') {
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return false
      }

      // Agent navigation shortcuts — let these bubble to App.tsx
      const isAlt = e.altKey && !e.metaKey && !e.ctrlKey
      if ((isMeta || isAlt) && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return false
      }

      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
        getSearchAddon(agentId)?.clearDecorations()
        managed.term.focus()
        return false
      }
      return true
    })

    // Wire title change (disposed on cleanup)
    const titleDisposable = managed.term.onTitleChange((title: string) => {
      onTitleChangeRef.current?.(agentId, title)
    })

    // Expose serialize callback
    const serializeAddon = getSerializeAddon(agentId)
    if (serializeAddon) {
      onSerializeRef.current?.(agentId, () => serializeAddon.serialize())
    }

    // ResizeObserver for container size changes
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!visibleRef.current) return
        fitTerminal(agentId)
      }, 150)
    })
    observer.observe(container)

    onReadyRef.current?.()

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      observer.disconnect()
      titleDisposable.dispose()
      detachFromContainer(agentId)
    }
  }, [agentId])

  // Visibility: re-fit, refresh, and focus when becoming visible
  useEffect(() => {
    if (!visible) return
    setTerminalVisible(agentId, visible)
  }, [visible, agentId])

  const term = getTerminal(agentId)

  const color = agentColor ?? '#3B82F6'

  return (
    <div
      className="flex flex-col h-full w-full relative"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      onContextMenu={handleContextMenu}
    >
      {/* Agent color accent bar */}
      <div
        className="shrink-0"
        style={{
          height: '2px',
          background: `linear-gradient(to right, ${color}, ${color}40)`,
        }}
      />
      {searchOpen && (
        <div className="absolute top-1 right-2 z-10 flex items-center gap-1 bg-base-300 border border-base-content/20 rounded-md px-2 py-1 shadow-lg">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? handleSearchPrev() : handleSearchNext()
              }
              if (e.key === 'Escape') {
                handleSearchClose()
              }
            }}
            placeholder="Search..."
            className="input input-xs input-bordered w-48 bg-base-100 text-sm"
            autoFocus
          />
          <button onClick={handleSearchPrev} className="btn btn-xs btn-ghost" title="Previous (Shift+Enter)">
            ▲
          </button>
          <button onClick={handleSearchNext} className="btn btn-xs btn-ghost" title="Next (Enter)">
            ▼
          </button>
          <button onClick={handleSearchClose} className="btn btn-xs btn-ghost" title="Close (Esc)">
            ✕
          </button>
        </div>
      )}

      {contextMenu && (
        <TerminalContextMenu
          position={contextMenu}
          hasSelection={term?.hasSelection() ?? false}
          onCopy={() => {
            if (term?.hasSelection()) {
              window.agentHub.clipboard.writeText(term.getSelection())
            }
          }}
          onPaste={() => {
            const text = window.agentHub.clipboard.readText()
            if (text) window.agentHub.agents.sendInput(agentId, text)
          }}
          onSearch={() => {
            setSearchOpen(true)
            setTimeout(() => searchInputRef.current?.focus(), 50)
          }}
          onClear={() => term?.clear()}
          onSelectAll={() => term?.selectAll()}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ padding: '4px' }}
      />
      {bootOverlay && (
        <div className="absolute inset-0" style={{ background: '#1e1e2e', zIndex: 5 }} />
      )}
    </div>
  )
}

export default FullTerminal
