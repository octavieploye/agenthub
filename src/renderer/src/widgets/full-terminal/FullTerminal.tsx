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

    mountedRef.current = true
    writeCallbackRef.current = writeCallback

    // 1. Create terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: getXtermTheme(),
      scrollback: 5000
    })
    termRef.current = term

    // 2. Open in the visible container
    term.open(containerRef.current)

    // 3. Load WebGL addon
    try {
      const webgl = new WebglAddon()
      term.loadAddon(webgl)
      webgl.onContextLoss(() => webgl.dispose())
    } catch {
      // WebGL not available — falls back to canvas renderer
    }

    // 4. Load FitAddon
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    // 5. Initial fit THEN drain+write (must write AFTER terminal is sized)
    requestAnimationFrame(() => {
      if (!mountedRef.current) return
      fitAddon.fit()
      window.agentHub.agents.resize(agentId, term.cols, term.rows)

      // 6. Replay buffered output + start passthrough (after fit)
      const buffered = outputBuffer.drain(agentId, writeCallback)
      if (buffered) {
        writeChunked(term, buffered, mountedRef)
      }
      onReady?.()
    })

    // 7. Wire keyboard input
    const inputDisposable = term.onData((data: string) => {
      window.agentHub.agents.sendInput(agentId, data)
    })

    // 8. ResizeObserver (debounced 100ms)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!mountedRef.current || !fitAddonRef.current || !termRef.current) return
        fitAddonRef.current.fit()
        window.agentHub.agents.resize(agentId, termRef.current.cols, termRef.current.rows)
      }, 100)
    })
    observer.observe(containerRef.current)
    resizeObserverRef.current = observer

    // Cleanup on unmount
    return () => {
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

  // Re-fit when becoming visible
  useEffect(() => {
    if (visible && termRef.current && fitAddonRef.current) {
      requestAnimationFrame(() => {
        if (!mountedRef.current || !fitAddonRef.current || !termRef.current) return
        fitAddonRef.current.fit()
        window.agentHub.agents.resize(agentId, termRef.current.cols, termRef.current.rows)
        termRef.current.focus()
      })
    }
  }, [visible, agentId])

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ display: visible ? 'flex' : 'none' }}
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
