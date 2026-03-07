import { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '@renderer/stores/theme-store'
import { terminalCache } from '@renderer/services/terminal-cache'

interface FullTerminalProps {
  agentId: string
  visible: boolean
  onReady?: () => void
}

function FullTerminal({ agentId, visible, onReady }: FullTerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useThemeStore((s) => s.theme)

  // Attach/detach the cached terminal when agentId or container changes
  useEffect(() => {
    if (!containerRef.current) return

    terminalCache.getOrCreate(agentId)
    terminalCache.attach(agentId, containerRef.current)

    // Handle resize
    const container = containerRef.current
    const resizeObserver = new ResizeObserver(() => {
      if (container) {
        const { cols, rows } = fitTerminal(agentId)
        window.agentHub.agents.resize(agentId, cols, rows)
      }
    })
    resizeObserver.observe(container)

    // Initial fit
    const { cols, rows } = fitTerminal(agentId)
    window.agentHub.agents.resize(agentId, cols, rows)

    onReady?.()

    return () => {
      resizeObserver.disconnect()
      terminalCache.detach(agentId)
    }
  }, [agentId, onReady])

  // Update all cached terminal themes when DaisyUI theme changes
  useEffect(() => {
    terminalCache.updateTheme()
  }, [theme])

  // Re-fit when becoming visible
  useEffect(() => {
    if (visible && containerRef.current) {
      const term = terminalCache.get(agentId)
      if (term) {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const { cols, rows } = fitTerminal(agentId)
            window.agentHub.agents.resize(agentId, cols, rows)
            term.focus()
          }
        })
      }
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

function fitTerminal(agentId: string): { cols: number; rows: number } {
  const term = terminalCache.get(agentId)
  const fitAddon = terminalCache.getFitAddon(agentId)
  if (!term || !fitAddon) return { cols: 80, rows: 24 }
  fitAddon.fit()
  return { cols: term.cols, rows: term.rows }
}

export default FullTerminal
