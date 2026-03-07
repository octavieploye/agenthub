import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
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

    const term = terminalCache.getOrCreate(agentId)
    terminalCache.attach(agentId, containerRef.current)

    // Handle resize
    const container = containerRef.current
    const resizeObserver = new ResizeObserver(() => {
      if (container) {
        const { cols, rows } = fitTerminal(container, term)
        window.agentHub.agents.resize(agentId, cols, rows)
      }
    })
    resizeObserver.observe(container)

    // Initial fit
    const { cols, rows } = fitTerminal(container, term)
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
            const { cols, rows } = fitTerminal(containerRef.current, term)
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
