import { useEffect, useRef, useCallback, useState, type MouseEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { getXtermTheme } from './theme-bridge'
import { outputBuffer } from '@renderer/services/output-buffer'
import { useThemeStore } from '@renderer/stores/theme-store'
import { watchWebGlContext } from '../../crash-logger'
import { registerTerminal, unregisterTerminal } from './terminal-manager'
import TerminalContextMenu from './TerminalContextMenu'

interface FullTerminalProps {
  agentId: string
  agentColor?: string
  visible: boolean
  onReady?: () => void
  onTitleChange?: (agentId: string, title: string) => void
  onSerialize?: (agentId: string, serialize: () => string) => void
}

function FullTerminal({ agentId, agentColor: _agentColor, visible, onReady, onTitleChange, onSerialize }: FullTerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleRef = useRef(visible)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Terminal refs (stable across renders, cleaned up in effect)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  visibleRef.current = visible

  // Stable refs for callbacks
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onTitleChangeRef = useRef(onTitleChange)
  onTitleChangeRef.current = onTitleChange
  const onSerializeRef = useRef(onSerialize)
  onSerializeRef.current = onSerialize

  // Search handlers
  const handleSearchNext = useCallback(() => {
    if (searchAddonRef.current && searchQuery) searchAddonRef.current.findNext(searchQuery)
  }, [searchQuery])

  const handleSearchPrev = useCallback(() => {
    if (searchAddonRef.current && searchQuery) searchAddonRef.current.findPrevious(searchQuery)
  }, [searchQuery])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
    searchAddonRef.current?.clearDecorations()
    termRef.current?.focus()
  }, [])

  // Live search as user types
  useEffect(() => {
    if (searchOpen && searchQuery) {
      searchAddonRef.current?.findNext(searchQuery)
    }
  }, [searchQuery, searchOpen])

  // Theme subscription
  const theme = useThemeStore((s) => s.theme)

  // Theme sync effect
  useEffect(() => {
    if (!termRef.current) return
    const xtermTheme = getXtermTheme()
    termRef.current.options.theme = xtermTheme
  }, [theme])

  // Main terminal lifecycle: create, attach, wire, dispose
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Create terminal with theme
    const xtermTheme = getXtermTheme()
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', Menlo, monospace",
      lineHeight: 1.19,
      letterSpacing: 0,
      theme: xtermTheme,
      scrollback: 5000,
      allowProposedApi: true,
    })

    termRef.current = term

    // Open terminal in DOM and register for cross-terminal search
    term.open(container)
    registerTerminal(agentId, term)
    watchWebGlContext(container, agentId)

    // Load addons after open
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    const searchAddon = new SearchAddon()
    term.loadAddon(searchAddon)
    searchAddonRef.current = searchAddon

    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(webLinksAddon)

    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    term.unicode.activeVersion = '11'

    const serializeAddon = new SerializeAddon()
    term.loadAddon(serializeAddon)
    serializeAddonRef.current = serializeAddon

    // Try WebGL
    let webglAddon: WebglAddon | null = null
    try {
      webglAddon = new WebglAddon()
      term.loadAddon(webglAddon)
      webglAddon.onContextLoss(() => {
        webglAddon?.dispose()
        webglAddon = null
      })
    } catch {
      webglAddon = null
    }

    // Wire keyboard shortcuts (clipboard, search)
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === 'c' && term.hasSelection()) {
        window.agentHub.clipboard.writeText(term.getSelection())
        return false
      }

      if (isMeta && e.key === 'f') {
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return false
      }

      // Agent navigation shortcuts - let these bubble to App.tsx
      const isAlt = e.altKey && !e.metaKey && !e.ctrlKey
      if ((isMeta || isAlt) && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return false
      }

      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
        searchAddon.clearDecorations()
        term.focus()
        return false
      }
      return true
    })

    // Wire keyboard input to IPC
    const onDataDisposable = term.onData((data: string) => {
      window.agentHub.agents.sendInput(agentId, data)
    })

    // Title change
    const titleDisposable = term.onTitleChange((title: string) => {
      onTitleChangeRef.current?.(agentId, title)
    })

    // Expose serialize
    onSerializeRef.current?.(agentId, () => serializeAddon.serialize())

    // Drain buffered output and register passthrough IMMEDIATELY so no data is lost
    const passthroughCallback = (data: string): void => {
      term.write(data)
    }
    const buffered = outputBuffer.drain(agentId, passthroughCallback)
    if (buffered) {
      term.write(buffered)
    }

    // Defer fit to rAF + fonts.ready (layout-only, not data flow)
    requestAnimationFrame(() => {
      document.fonts.ready.then(() => {
        if (!fitAddonRef.current || !termRef.current) return
        fitAddon.fit()
        window.agentHub.agents.resize(agentId, term.cols, term.rows)
      })
    })

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!visibleRef.current) return
        fitAddon.fit()
        window.agentHub.agents.resize(agentId, term.cols, term.rows)
      }, 150)
    })
    observer.observe(container)

    onReadyRef.current?.()

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      observer.disconnect()
      titleDisposable.dispose()
      onDataDisposable.dispose()
      outputBuffer.stopPassthrough(agentId, passthroughCallback)
      unregisterTerminal(agentId)
      if (webglAddon) {
        try { webglAddon.dispose() } catch { /* ok */ }
      }
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
      serializeAddonRef.current = null
    }
  }, [agentId])

  // Visibility: re-fit and focus when becoming visible
  useEffect(() => {
    if (!visible || !termRef.current || !fitAddonRef.current) return

    requestAnimationFrame(() => {
      document.fonts.ready.then(() => {
        if (!fitAddonRef.current || !termRef.current) return
        fitAddonRef.current.fit()
        termRef.current.focus()
        window.agentHub.agents.resize(agentId, termRef.current.cols, termRef.current.rows)
      })
    })
  }, [visible, agentId])

  const term = termRef.current

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
