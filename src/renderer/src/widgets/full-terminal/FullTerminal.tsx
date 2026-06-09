import { useEffect, useRef, useCallback, useState, type MouseEvent } from 'react'
import '@xterm/xterm/css/xterm.css'
import { watchWebGlContext } from '../../crash-logger'
import TerminalContextMenu from './TerminalContextMenu'
import {
  getOrCreateTerminal,
  attachToContainer,
  setVisible,
  fitTerminal,
  getTerminal,
  getSearchAddon,
  getSerializeAddon,
} from './terminal-manager'

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
  const visibleRef = useRef(visible)

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

  visibleRef.current = visible

  // Stable refs
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

  // Attach terminal to container on mount
  useEffect(() => {
    if (!containerRef.current) return

    const managed = getOrCreateTerminal(agentId, agentColor)

    // Attach to DOM
    attachToContainer(agentId, containerRef.current)
    watchWebGlContext(containerRef.current, agentId)

    // Wire keyboard shortcuts (clipboard, search)
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
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
        getSearchAddon(agentId)?.clearDecorations()
        managed.term.focus()
        return false
      }
      return true
    })

    // Title change
    const titleDisposable = managed.term.onTitleChange((title: string) => {
      onTitleChangeRef.current?.(agentId, title)
    })

    // Expose serialize
    const serializeAddon = getSerializeAddon(agentId)
    if (serializeAddon) {
      onSerializeRef.current?.(agentId, () => serializeAddon.serialize())
    }

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!visibleRef.current) return
        fitTerminal(agentId)
      }, 150)
    })
    observer.observe(containerRef.current)

    onReadyRef.current?.()

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      observer.disconnect()
      titleDisposable.dispose()
      // NOTE: we do NOT destroy the terminal here — it persists in terminal-manager
    }
  }, [agentId])

  // Theme sync — DISABLED for debugging
  // useEffect(() => {
  //   updateTheme()
  // }, [theme])

  // Visibility
  useEffect(() => {
    setVisible(agentId, visible)
  }, [visible, agentId])

  const term = getTerminal(agentId)

  return (
    <div
      className="flex flex-col h-full w-full relative"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      onContextMenu={handleContextMenu}
    >
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
    </div>
  )
}

export default FullTerminal
