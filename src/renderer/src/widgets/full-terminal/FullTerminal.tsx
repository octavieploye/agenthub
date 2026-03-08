import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '@renderer/stores/theme-store'
import { getXtermTheme } from './theme-bridge'
import { outputBuffer } from '@renderer/services/output-buffer'

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

  // Stable write callback that guards against writing to a disposed terminal
  const writeCallback = useCallback((data: string) => {
    if (mountedRef.current && termRef.current) {
      termRef.current.write(data)
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

    // 5. Initial fit
    requestAnimationFrame(() => {
      if (!mountedRef.current) return
      fitAddon.fit()
      window.agentHub.agents.resize(agentId, term.cols, term.rows)
      onReady?.()
    })

    // 6. Replay buffered output + start passthrough
    const buffered = outputBuffer.drain(agentId, writeCallback)
    if (buffered) {
      term.write(buffered)
    }

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

      // 1. Stop passthrough
      outputBuffer.stopPassthrough(agentId, writeCallback)

      // 2. Disconnect resize observer
      if (resizeTimer) clearTimeout(resizeTimer)
      observer.disconnect()
      resizeObserverRef.current = null

      // 3. Clean up input handler
      inputDisposable.dispose()

      // 4. Dispose terminal (also disposes addons)
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
