import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

interface FullTerminalProps {
  agentId: string
  visible: boolean
  onReady?: () => void
}

function FullTerminal({ agentId, visible, onReady }: FullTerminalProps): React.JSX.Element {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])

  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#7c93ee',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#7c93ee44',
        black: '#1a1a2e',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e0e0e0',
        brightBlack: '#404060',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      allowTransparency: true,
      scrollback: 5000
    })

    term.open(terminalRef.current)

    try {
      const webgl = new WebglAddon()
      term.loadAddon(webgl)
      webgl.onContextLoss(() => {
        webgl.dispose()
      })
    } catch {
      // WebGL not available, fall back to canvas renderer
    }

    xtermRef.current = term

    // Subscribe to agent output
    const unsubOutput = window.agentHub.on.agentOutput((id, data) => {
      if (id === agentId) {
        term.write(data)
      }
    })
    cleanupRef.current.push(unsubOutput)

    // Forward keyboard input to agent
    const disposable = term.onData((data) => {
      window.agentHub.agents.sendInput(agentId, data)
    })
    cleanupRef.current.push(() => disposable.dispose())

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (terminalRef.current && xtermRef.current) {
        const { cols, rows } = fitTerminal(terminalRef.current, xtermRef.current)
        window.agentHub.agents.resize(agentId, cols, rows)
      }
    })
    resizeObserver.observe(terminalRef.current)
    cleanupRef.current.push(() => resizeObserver.disconnect())

    // Initial fit
    const { cols, rows } = fitTerminal(terminalRef.current, term)
    window.agentHub.agents.resize(agentId, cols, rows)

    onReady?.()
  }, [agentId, onReady])

  useEffect(() => {
    initTerminal()

    return () => {
      for (const cleanup of cleanupRef.current) {
        cleanup()
      }
      cleanupRef.current = []
      xtermRef.current?.dispose()
      xtermRef.current = null
    }
  }, [initTerminal])

  // Re-fit when becoming visible
  useEffect(() => {
    if (visible && terminalRef.current && xtermRef.current) {
      requestAnimationFrame(() => {
        if (terminalRef.current && xtermRef.current) {
          const { cols, rows } = fitTerminal(terminalRef.current, xtermRef.current)
          window.agentHub.agents.resize(agentId, cols, rows)
          xtermRef.current.focus()
        }
      })
    }
  }, [visible, agentId])

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ display: visible ? 'flex' : 'none' }}
    >
      <div
        ref={terminalRef}
        className="flex-1 min-h-0"
        style={{ padding: '4px' }}
      />
    </div>
  )
}

function fitTerminal(
  container: HTMLElement,
  term: Terminal
): { cols: number; rows: number } {
  const dims = term.options.fontSize ?? 13
  const lineHeight = Math.ceil(dims * 1.2)
  const charWidth = dims * 0.6

  const cols = Math.max(2, Math.floor(container.clientWidth / charWidth))
  const rows = Math.max(2, Math.floor(container.clientHeight / lineHeight))

  term.resize(cols, rows)
  return { cols, rows }
}

export default FullTerminal
