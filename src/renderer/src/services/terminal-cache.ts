import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { getXtermTheme } from '../widgets/full-terminal/theme-bridge'

interface CachedTerminal {
  term: Terminal
  cleanups: (() => void)[]
  offscreen: HTMLDivElement
}

/**
 * Singleton cache that keeps xterm Terminal instances alive across agent switches.
 * Instead of disposing/recreating terminals on every agent tab change,
 * terminals are created once and moved between visible containers and an
 * offscreen holding area.
 */
class TerminalCache {
  private cache = new Map<string, CachedTerminal>()

  getOrCreate(agentId: string): Terminal {
    const existing = this.cache.get(agentId)
    if (existing) return existing.term

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: getXtermTheme(),
      allowTransparency: true,
      scrollback: 5000
    })

    // Open in an offscreen container so xterm initializes its DOM
    const offscreen = document.createElement('div')
    offscreen.style.position = 'absolute'
    offscreen.style.left = '-9999px'
    offscreen.style.width = '800px'
    offscreen.style.height = '600px'
    document.body.appendChild(offscreen)
    term.open(offscreen)

    try {
      const webgl = new WebglAddon()
      term.loadAddon(webgl)
      webgl.onContextLoss(() => webgl.dispose())
    } catch {
      // WebGL not available — falls back to canvas renderer
    }

    const cleanups: (() => void)[] = []

    // Subscribe to agent PTY output (once, lives for the cache entry lifetime)
    const unsubOutput = window.agentHub.on.agentOutput((id: string, data: string) => {
      if (id === agentId) term.write(data)
    })
    cleanups.push(unsubOutput)

    // Forward keyboard input to the agent process
    const disposable = term.onData((data: string) => {
      window.agentHub.agents.sendInput(agentId, data)
    })
    cleanups.push(() => disposable.dispose())

    this.cache.set(agentId, { term, cleanups, offscreen })
    return term
  }

  /**
   * Move the terminal's DOM into a visible container.
   */
  attach(agentId: string, container: HTMLElement): void {
    const cached = this.cache.get(agentId)
    if (!cached?.term.element) return
    container.appendChild(cached.term.element)
  }

  /**
   * Move the terminal's DOM back to its offscreen holding container.
   */
  detach(agentId: string): void {
    const cached = this.cache.get(agentId)
    if (!cached?.term.element) return
    cached.offscreen.appendChild(cached.term.element)
  }

  get(agentId: string): Terminal | null {
    return this.cache.get(agentId)?.term ?? null
  }

  has(agentId: string): boolean {
    return this.cache.has(agentId)
  }

  /**
   * Update theme on all cached terminals.
   */
  updateTheme(): void {
    const theme = getXtermTheme()
    for (const cached of this.cache.values()) {
      cached.term.options.theme = theme
    }
  }

  /**
   * Fully destroy a single terminal (e.g. when agent exits).
   */
  dispose(agentId: string): void {
    const cached = this.cache.get(agentId)
    if (!cached) return
    for (const cleanup of cached.cleanups) cleanup()
    cached.term.dispose()
    cached.offscreen.remove()
    this.cache.delete(agentId)
  }

  /**
   * Destroy all cached terminals (app shutdown).
   */
  disposeAll(): void {
    for (const agentId of [...this.cache.keys()]) {
      this.dispose(agentId)
    }
  }
}

export const terminalCache = new TerminalCache()
