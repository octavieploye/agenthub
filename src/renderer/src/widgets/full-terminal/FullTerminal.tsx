import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '@renderer/stores/theme-store'
import { getXtermTheme } from './theme-bridge'
import { outputBuffer } from '@renderer/services/output-buffer'

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

interface FullTerminalProps {
  agentId: string
  visible: boolean
  onReady?: () => void
}

function FullTerminal({ agentId, visible, onReady }: FullTerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const mountedRef = useRef(false)
  const writeCallbackRef = useRef<((data: string) => void) | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const fixedColsRef = useRef<number | null>(null)
  const isFittingRef = useRef(false)
  const theme = useThemeStore((s) => s.theme)

  // rAF-batched write callback: accumulates IPC chunks and flushes once per
  // animation frame so the renderer doesn't choke on high-frequency PTY output.
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

  // Create terminal on mount, dispose on unmount
  useEffect(() => {
    if (!containerRef.current) return

    // Local flag scoped to THIS effect invocation — survives StrictMode double-mount
    let active = true
    mountedRef.current = true
    writeCallbackRef.current = writeCallback
    fixedColsRef.current = null

    // 1. Create terminal
    console.log(`[TERM ${agentId}] 1. Creating terminal instance`)
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: getXtermTheme(),
      scrollback: 5000
    })
    termRef.current = term

    // 2. Open in the visible container
    console.log(`[TERM ${agentId}] 2. Opening in container, visible=${visible}`)
    term.open(containerRef.current)

    // 3. Load FitAddon FIRST (before WebGL to avoid canvas size lock-in)
    console.log(`[TERM ${agentId}] 3. Loading FitAddon`)
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    // 4. Initial fit, THEN WebGL, THEN drain+write
    requestAnimationFrame(() => {
      if (!active) {
        console.log(`[TERM ${agentId}] 4. rAF skipped — effect was cleaned up (StrictMode)`)
        return
      }

      // 4a. Fit terminal to container (sets correct cols/rows)
      const parentEl = term.element?.parentElement
      console.log(`[TERM ${agentId}] 4a. Pre-fit parent dimensions: ${parentEl?.clientWidth}x${parentEl?.clientHeight}, display=${parentEl ? getComputedStyle(parentEl).display : 'N/A'}, visibility=${parentEl ? getComputedStyle(parentEl).visibility : 'N/A'}`)
      fitAddon.fit()
      // Lock cols after first fit — only rows will change from now on
      fixedColsRef.current = term.cols
      console.log(`[TERM ${agentId}] 4a. Post-fit: cols=${term.cols}, rows=${term.rows}, fixedCols=${fixedColsRef.current}`)
      window.agentHub.agents.resize(agentId, term.cols, term.rows)

      // 4b. Load WebGL AFTER sizing is locked in
      console.log(`[TERM ${agentId}] 4b. Loading WebGL addon`)
      try {
        const webgl = new WebglAddon()
        term.loadAddon(webgl)
        webgl.onContextLoss(() => webgl.dispose())
        console.log(`[TERM ${agentId}] 4b. WebGL loaded OK`)
      } catch (err) {
        console.warn(`[TERM ${agentId}] 4b. WebGL failed, using canvas:`, err)
      }

      // 4c. Replay buffered output + start passthrough (after fit + WebGL)
      const buffered = outputBuffer.drain(agentId, writeCallback)
      console.log(`[TERM ${agentId}] 4c. Drain buffer: ${buffered ? buffered.length + ' bytes' : 'empty'}`)
      if (buffered) {
        writeChunked(term, buffered, mountedRef)
      }
      console.log(`[TERM ${agentId}] 4d. Mount complete, ready`)
      onReady?.()
    })

    // 7. Wire keyboard input
    const inputDisposable = term.onData((data: string) => {
      window.agentHub.agents.sendInput(agentId, data)
    })

    // 8. ResizeObserver — skip resizes during initial stabilization (breakout
    //    window animation triggers hundreds of resize events), then debounce 150ms.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let lastCols = term.cols
    let lastRows = term.rows
    const stabilizeAt = Date.now() + 800
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!mountedRef.current || !fitAddonRef.current || !termRef.current) return
        if (Date.now() < stabilizeAt) return
        if (isFittingRef.current) {
          console.log(`[TERM ${agentId}] ResizeObserver: skipped (isFitting guard)`)
          return
        }
        isFittingRef.current = true
        try {
          fitAddonRef.current.fit()
          const { cols, rows } = termRef.current
          const lockedCols = fixedColsRef.current ?? cols
          console.log(`[TERM ${agentId}] ResizeObserver: fit cols=${cols} rows=${rows}, locked=${lockedCols}, prev=${lastCols}x${lastRows}`)
          if (cols !== lockedCols) {
            console.log(`[TERM ${agentId}] ResizeObserver: snapping cols ${cols} → ${lockedCols}`)
            termRef.current.resize(lockedCols, rows)
          }
          if (lockedCols !== lastCols || rows !== lastRows) {
            lastCols = lockedCols
            lastRows = rows
            console.log(`[TERM ${agentId}] ResizeObserver: PTY resize → ${lockedCols}x${rows}`)
            window.agentHub.agents.resize(agentId, lockedCols, rows)
          }
        } finally {
          isFittingRef.current = false
        }
      }, 150)
    })
    observer.observe(containerRef.current)
    resizeObserverRef.current = observer

    // Cleanup on unmount
    return () => {
      console.log(`[TERM ${agentId}] Unmounting, disposing terminal`)
      active = false
      mountedRef.current = false

      // 1. Cancel pending rAF write
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      pendingRef.current = ''

      // 2. Stop passthrough
      outputBuffer.stopPassthrough(agentId, writeCallback)

      // 3. Disconnect resize observer
      if (resizeTimer) clearTimeout(resizeTimer)
      observer.disconnect()
      resizeObserverRef.current = null

      // 4. Clean up input handler
      inputDisposable.dispose()

      // 5. Dispose terminal (also disposes addons)
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      writeCallbackRef.current = null
    }
  }, [agentId, writeCallback, onReady])

  // Theme sync: update terminal theme when DaisyUI theme changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getXtermTheme()
    }
  }, [theme])

  // Re-fit rows only + force repaint when becoming visible
  useEffect(() => {
    console.log(`[TERM ${agentId}] Visibility changed: visible=${visible}`)
    if (visible && termRef.current && fitAddonRef.current) {
      requestAnimationFrame(() => {
        if (!mountedRef.current || !fitAddonRef.current || !termRef.current) return
        const term = termRef.current
        // Skip if initial mount hasn't completed yet (fixedCols not set)
        if (fixedColsRef.current === null) {
          console.log(`[TERM ${agentId}] Visibility rAF: skipped, fixedCols not set yet`)
          return
        }
        const parentEl = term.element?.parentElement
        console.log(`[TERM ${agentId}] Visibility rAF: parent ${parentEl?.clientWidth}x${parentEl?.clientHeight}, visibility=${parentEl ? getComputedStyle(parentEl).visibility : 'N/A'}`)
        fitAddonRef.current.fit()
        const lockedCols = fixedColsRef.current
        console.log(`[TERM ${agentId}] Visibility fit: cols=${term.cols} rows=${term.rows}, locked=${lockedCols}`)
        if (term.cols !== lockedCols) {
          console.log(`[TERM ${agentId}] Visibility: snapping cols ${term.cols} → ${lockedCols}`)
          term.resize(lockedCols, term.rows)
        }
        window.agentHub.agents.resize(agentId, lockedCols, term.rows)
        term.refresh(0, term.rows - 1)
        term.focus()
      })
    }
  }, [visible, agentId])

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
    >
      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ padding: '4px' }}
      />
    </div>
  )
}

export default FullTerminal
