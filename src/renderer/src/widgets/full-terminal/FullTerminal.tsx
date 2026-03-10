import { useEffect, useRef, useCallback, useState, type MouseEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '@renderer/stores/theme-store'
import { getXtermTheme } from './theme-bridge'
import { outputBuffer } from '@renderer/services/output-buffer'
import TerminalContextMenu from './TerminalContextMenu'

/**
 * Write large data in 16KB chunks, yielding to the renderer between each
 * chunk so xterm can repaint and the UI doesn't freeze.
 */
function writeChunked(
  term: Terminal,
  data: string,
  guard: React.RefObject<boolean>,
  chunkSize = 16_384
): void {
  let offset = 0
  function writeNext(): void {
    if (!guard.current || offset >= data.length) return
    const end = Math.min(offset + chunkSize, data.length)
    term.write(data.slice(offset, end), () => {
      offset = end
      if (offset < data.length) setTimeout(writeNext, 0)
    })
  }
  writeNext()
}

// Feature #9: Track WebGL failures across instances to decide when to give up
let webglFailureCount = 0
const MAX_WEBGL_FAILURES = 3

interface FullTerminalProps {
  agentId: string
  visible: boolean
  onReady?: () => void
  onTitleChange?: (agentId: string, title: string) => void
  onSerialize?: (agentId: string, serialize: () => string) => void
}

function FullTerminal({ agentId, visible, onReady, onTitleChange, onSerialize }: FullTerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const mountedRef = useRef(false)
  const writeCallbackRef = useRef<((data: string) => void) | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const visibleRef = useRef(visible)

  const isFittingRef = useRef(false)
  const fixedColsRef = useRef<number | null>(null)
  const theme = useThemeStore((s) => s.theme)

  // Feature #1: Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Feature #3: Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Keep visibleRef in sync so the ResizeObserver closure can read it
  visibleRef.current = visible

  // rAF-batched write callback
  const pendingRef = useRef('')
  const rafIdRef = useRef<number | null>(null)

  const writeCallback = useCallback((data: string) => {
    if (!mountedRef.current) return
    pendingRef.current += data
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        if (mountedRef.current && termRef.current && pendingRef.current) {
          termRef.current.write(pendingRef.current)
          pendingRef.current = ''
        }
      })
    }
  }, [])

  // Stable refs for callbacks that shouldn't trigger effect re-runs
  const writeCallbackStableRef = useRef(writeCallback)
  writeCallbackStableRef.current = writeCallback
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onTitleChangeRef = useRef(onTitleChange)
  onTitleChangeRef.current = onTitleChange
  const onSerializeRef = useRef(onSerialize)
  onSerializeRef.current = onSerialize

  // Feature #1: Search handlers
  const handleSearchNext = useCallback(() => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery)
    }
  }, [searchQuery])

  const handleSearchPrev = useCallback(() => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findPrevious(searchQuery)
    }
  }, [searchQuery])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
    searchAddonRef.current?.clearDecorations()
    termRef.current?.focus()
  }, [])

  // Live search as user types
  useEffect(() => {
    if (searchOpen && searchQuery && searchAddonRef.current) {
      searchAddonRef.current.findNext(searchQuery)
    }
  }, [searchQuery, searchOpen])

  // Feature #9: Try loading WebGL, track failures for permanent fallback
  function tryLoadWebGL(term: Terminal, id: string): void {
    if (webglFailureCount >= MAX_WEBGL_FAILURES) {
      console.warn(`[TERM ${id}] WebGL permanently disabled after ${MAX_WEBGL_FAILURES} failures, using canvas`)
      return
    }
    try {
      const webgl = new WebglAddon()
      term.loadAddon(webgl)
      webgl.onContextLoss(() => {
        console.warn(`[TERM ${id}] WebGL context lost, disposing addon`)
        webgl.dispose()
        webglAddonRef.current = null
        webglFailureCount++
      })
      webglAddonRef.current = webgl
    } catch (err) {
      console.warn(`[TERM ${id}] WebGL failed, using canvas:`, err)
      webglFailureCount++
    }
  }

  // Create terminal on mount, dispose on unmount
  useEffect(() => {
    if (!containerRef.current) return

    let active = true
    mountedRef.current = true
    fixedColsRef.current = null
    const currentWriteCallback = writeCallbackStableRef.current
    writeCallbackRef.current = currentWriteCallback

    // 1. Create terminal
    console.log(`[TERM ${agentId}] 1. Creating terminal instance`)
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', Menlo, monospace",
      // lineHeight 1.19 matches macOS Terminal visual parity but reduces row count by ~17%.
      // This is acceptable as long as fit() reports accurate rows to PTY.
      lineHeight: 1.19,
      letterSpacing: 0,
      theme: getXtermTheme(),
      scrollback: 5000,
      allowProposedApi: true,
      devicePixelRatio: window.devicePixelRatio
    })
    termRef.current = term

    // 2. Open in the visible container
    term.open(containerRef.current)

    // 3. Load addons — FitAddon first (before WebGL to avoid canvas size lock-in)
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    // Feature #1: SearchAddon
    const searchAddon = new SearchAddon()
    term.loadAddon(searchAddon)
    searchAddonRef.current = searchAddon

    // Feature #2: WebLinksAddon — clickable URLs in terminal output
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(webLinksAddon)

    // Feature #6: Unicode11Addon — proper emoji/CJK character width
    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    term.unicode.activeVersion = '11'

    // Feature #7: SerializeAddon — export terminal buffer
    const serializeAddon = new SerializeAddon()
    term.loadAddon(serializeAddon)
    serializeAddonRef.current = serializeAddon

    // Expose serialize function to parent
    onSerializeRef.current?.(agentId, () => serializeAddon.serialize())

    // 4. Initial fit, THEN WebGL, THEN drain+write
    requestAnimationFrame(() => {
      if (!active) return

      document.fonts.ready.then(() => {
        if (!active) return

        // 4a. Load WebGL renderer first (Feature #9: with failure tracking)
        tryLoadWebGL(term, agentId)

        // 4b. Single fit after WebGL is loaded — avoids metric inconsistency from double-fit
        fitAddon.fit()

        // Feature #5: Use proposeDimensions() (public API) instead of private _core internals
        const proposed = fitAddon.proposeDimensions()
        console.log(`[TERM ${agentId}] Post-WebGL fit: cols=${term.cols}, rows=${term.rows}, proposed=${proposed?.cols}x${proposed?.rows}`)

        // DPR diagnostic
        console.log(`[TERM ${agentId}] DPR=${window.devicePixelRatio}, container=${containerRef.current?.clientWidth}x${containerRef.current?.clientHeight}`)
        const canvas = containerRef.current?.querySelector('canvas')
        if (canvas) {
          console.log(`[TERM ${agentId}] Canvas: CSS=${canvas.style.width}x${canvas.style.height}, backing=${canvas.width}x${canvas.height}`)
        }

        fixedColsRef.current = term.cols
        lastCols = term.cols
        lastRows = term.rows
        window.agentHub.agents.resize(agentId, term.cols, term.rows)

        // 4d. Replay buffered output + start passthrough
        const buffered = outputBuffer.drain(agentId, currentWriteCallback)
        if (buffered) {
          writeChunked(term, buffered, mountedRef)
        }
        onReadyRef.current?.()
      })
    })

    // 5. Wire keyboard input
    const inputDisposable = term.onData((data: string) => {
      window.agentHub.agents.sendInput(agentId, data)
    })

    // 6. Wire clipboard + search shortcut
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      const isMeta = e.metaKey || e.ctrlKey

      // Cmd+C with selection → copy
      if (isMeta && e.key === 'c' && term.hasSelection()) {
        window.agentHub.clipboard.writeText(term.getSelection())
        return false
      }
      // Cmd+V → paste
      if (isMeta && e.key === 'v') {
        const text = window.agentHub.clipboard.readText()
        if (text) window.agentHub.agents.sendInput(agentId, text)
        return false
      }
      // Feature #1: Cmd+F → open search
      if (isMeta && e.key === 'f') {
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return false
      }
      // Escape → close search
      if (e.key === 'Escape' && searchAddonRef.current) {
        setSearchOpen(false)
        setSearchQuery('')
        searchAddonRef.current.clearDecorations()
        term.focus()
        return false
      }
      return true
    })

    // Feature #8: onTitleChange — shells set terminal title via escape codes
    const titleDisposable = term.onTitleChange((title: string) => {
      onTitleChangeRef.current?.(agentId, title)
    })

    // 7. ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let lastCols = term.cols
    let lastRows = term.rows
    const stabilizeAt = Date.now() + 800
    const observer = new ResizeObserver((entries) => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!visibleRef.current) return
        if (!mountedRef.current || !fitAddonRef.current || !termRef.current) return
        if (Date.now() < stabilizeAt) return
        if (isFittingRef.current) return
        isFittingRef.current = true
        try {
          fitAddonRef.current.fit()
          const { cols, rows } = termRef.current

          // Feature #5: Use ResizeObserverEntry + proposeDimensions (public API)
          const containerWidth = entries[0]?.contentRect?.width ?? 0
          console.log(`[TERM ${agentId}] ResizeObserver: fit cols=${cols} rows=${rows}, prev=${lastCols}x${lastRows}, container=${Math.round(containerWidth)}`)
          console.log(`[TERM ${agentId}] ResizeObserver DPR=${window.devicePixelRatio}, containerH=${containerRef.current?.clientHeight}`)

          if (fixedColsRef.current !== null && Math.abs(cols - fixedColsRef.current) > 5) {
            fixedColsRef.current = cols
            lastCols = cols
            lastRows = rows
            window.agentHub.agents.resize(agentId, cols, rows)
          } else if (fixedColsRef.current !== null) {
            termRef.current.resize(fixedColsRef.current, rows)
            if (rows !== lastRows) {
              lastRows = rows
              window.agentHub.agents.resize(agentId, fixedColsRef.current, rows)
            }
          } else if (cols !== lastCols || rows !== lastRows) {
            lastCols = cols
            lastRows = rows
            window.agentHub.agents.resize(agentId, cols, rows)
          }
        } finally {
          isFittingRef.current = false
        }
      }, 300)
    })
    observer.observe(containerRef.current)
    resizeObserverRef.current = observer

    // Cleanup on unmount
    return () => {
      active = false
      mountedRef.current = false

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      pendingRef.current = ''

      outputBuffer.stopPassthrough(agentId, currentWriteCallback)

      if (resizeTimer) clearTimeout(resizeTimer)
      observer.disconnect()
      resizeObserverRef.current = null

      inputDisposable.dispose()
      titleDisposable.dispose()

      webglAddonRef.current = null
      searchAddonRef.current = null
      serializeAddonRef.current = null
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      writeCallbackRef.current = null
    }
  }, [agentId])

  // Theme sync
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getXtermTheme()
    }
  }, [theme])

  // WebGL lifecycle on visibility change
  useEffect(() => {
    if (!termRef.current || !fitAddonRef.current) return

    if (visible) {
      // Reload WebGL if it was disposed when hidden (and not permanently disabled)
      if (!webglAddonRef.current && webglFailureCount < MAX_WEBGL_FAILURES) {
        tryLoadWebGL(termRef.current, agentId)
      }

      if (fixedColsRef.current !== null) {
        requestAnimationFrame(() => {
          if (!mountedRef.current || !fitAddonRef.current || !termRef.current) return
          fitAddonRef.current.fit()
          const { cols, rows } = termRef.current
          window.agentHub.agents.resize(agentId, cols, rows)
          termRef.current.refresh(0, rows - 1)
          termRef.current.focus()
        })
      }
    } else {
      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose()
          webglAddonRef.current = null
        } catch {
          webglAddonRef.current = null
        }
      }
    }
  }, [visible, agentId])

  return (
    <div
      className="flex flex-col h-full w-full relative"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      onContextMenu={handleContextMenu}
    >
      {/* Feature #1: Search bar */}
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

      {/* Feature #3: Right-click context menu */}
      {contextMenu && (
        <TerminalContextMenu
          position={contextMenu}
          hasSelection={termRef.current?.hasSelection() ?? false}
          onCopy={() => {
            if (termRef.current?.hasSelection()) {
              window.agentHub.clipboard.writeText(termRef.current.getSelection())
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
          onClear={() => termRef.current?.clear()}
          onSelectAll={() => termRef.current?.selectAll()}
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
