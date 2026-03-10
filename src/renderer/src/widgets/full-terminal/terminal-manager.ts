/**
 * Persistent terminal manager — exact same pattern as the Phase 5 mock.
 *
 * Terminals are created once per agent. Data flows directly from IPC to
 * term.write() — no output buffer, no rAF batching, no chunking.
 */

import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { getXtermTheme } from './theme-bridge'

let webglFailureCount = 0
const MAX_WEBGL_FAILURES = 3

interface ManagedTerminal {
  term: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  serializeAddon: SerializeAddon
  webglAddon: WebglAddon | null
  opened: boolean
  pendingWrites: string[]
}

const terminals = new Map<string, ManagedTerminal>()

// Global IPC subscription — routes data to the correct terminal
let ipcUnsubscribe: (() => void) | null = null

// Pre-open buffer: catches IPC data for agents that don't have a terminal yet
const preOpenBuffers = new Map<string, string[]>()

function ensureIpcSubscription(): void {
  if (ipcUnsubscribe) return
  ipcUnsubscribe = window.agentHub.on.agentOutput((agentId: string, data: string) => {
    const managed = terminals.get(agentId)
    if (managed) {
      if (managed.opened) {
        managed.term.write(data)
      } else {
        managed.pendingWrites.push(data)
      }
    } else {
      let buf = preOpenBuffers.get(agentId)
      if (!buf) {
        buf = []
        preOpenBuffers.set(agentId, buf)
      }
      buf.push(data)
    }
  })
}

/**
 * Start listening to IPC immediately. Call on app mount.
 */
export function startIpcListener(): void {
  ensureIpcSubscription()
}

function tryLoadWebGL(term: Terminal): WebglAddon | null {
  if (webglFailureCount >= MAX_WEBGL_FAILURES) return null
  try {
    const webgl = new WebglAddon()
    term.loadAddon(webgl)
    webgl.onContextLoss(() => {
      webgl.dispose()
      webglFailureCount++
    })
    return webgl
  } catch {
    webglFailureCount++
    return null
  }
}

/**
 * Get or create a terminal for the given agent.
 * NOTE: Addons are loaded AFTER open() in attachToContainer — matching Phase 5 mock.
 * Only the Terminal instance is created here.
 */
export function getOrCreateTerminal(agentId: string): ManagedTerminal {
  const existing = terminals.get(agentId)
  if (existing) return existing

  ensureIpcSubscription()

  // Hardcoded Catppuccin Mocha theme — identical to working Phase 5 mock
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'SF Mono', Menlo, monospace",
    lineHeight: 1.19,
    letterSpacing: 0,
    theme: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selectionBackground: '#585b70',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5', brightWhite: '#a6adc8',
    },
    scrollback: 5000,
    allowProposedApi: true,
  })

  const managed: ManagedTerminal = {
    term,
    fitAddon: null as unknown as FitAddon,
    searchAddon: null as unknown as SearchAddon,
    serializeAddon: null as unknown as SerializeAddon,
    webglAddon: null,
    opened: false,
    pendingWrites: [],
  }

  // Drain any data that arrived before this terminal was created
  const preBuffer = preOpenBuffers.get(agentId)
  if (preBuffer && preBuffer.length > 0) {
    managed.pendingWrites.push(...preBuffer)
    preOpenBuffers.delete(agentId)
  }

  terminals.set(agentId, managed)
  return managed
}

/**
 * Open terminal in a DOM container. First call opens it; subsequent calls
 * reparent the existing DOM element.
 */
export function attachToContainer(agentId: string, container: HTMLDivElement): void {
  const managed = terminals.get(agentId)
  if (!managed) return

  if (!managed.opened) {
    // Phase 5 sequence: open FIRST, then load addons, then fit
    managed.term.open(container)
    managed.opened = true

    // Load addons AFTER open — matching Phase 5 mock
    const fitAddon = new FitAddon()
    managed.term.loadAddon(fitAddon)
    managed.fitAddon = fitAddon

    const searchAddon = new SearchAddon()
    managed.term.loadAddon(searchAddon)
    managed.searchAddon = searchAddon

    const webLinksAddon = new WebLinksAddon()
    managed.term.loadAddon(webLinksAddon)

    const unicode11Addon = new Unicode11Addon()
    managed.term.loadAddon(unicode11Addon)
    managed.term.unicode.activeVersion = '11'

    const serializeAddon = new SerializeAddon()
    managed.term.loadAddon(serializeAddon)
    managed.serializeAddon = serializeAddon

    managed.webglAddon = tryLoadWebGL(managed.term)

    // Fit after addons loaded
    managed.fitAddon.fit()
    window.agentHub.agents.resize(agentId, managed.term.cols, managed.term.rows)

    // Flush any data that arrived before the terminal was opened
    if (managed.pendingWrites.length > 0) {
      const pending = managed.pendingWrites.join('')
      managed.pendingWrites = []
      managed.term.write(pending)
    }

    // Wire keyboard input (same as mock)
    managed.term.onData((data: string) => {
      window.agentHub.agents.sendInput(agentId, data)
    })
  } else {
    // Reparent: move xterm .xterm wrapper to new container (if needed)
    const xtermEl = managed.term.element
    if (xtermEl && xtermEl.parentElement !== container) {
      container.appendChild(xtermEl)
    }
    managed.fitAddon.fit()
    window.agentHub.agents.resize(agentId, managed.term.cols, managed.term.rows)
  }
}

/**
 * Refresh terminal when it becomes visible.
 */
export function setVisible(agentId: string, visible: boolean): void {
  const managed = terminals.get(agentId)
  if (!managed || !managed.opened) return

  if (visible) {
    if (!managed.webglAddon && webglFailureCount < MAX_WEBGL_FAILURES) {
      managed.webglAddon = tryLoadWebGL(managed.term)
    }
    managed.fitAddon.fit()
    const { cols, rows } = managed.term
    window.agentHub.agents.resize(agentId, cols, rows)
    managed.term.refresh(0, rows - 1)
    managed.term.focus()
  } else {
    if (managed.webglAddon) {
      try { managed.webglAddon.dispose() } catch { /* ok */ }
      managed.webglAddon = null
    }
  }
}

/**
 * Fit terminal to container and resize PTY.
 */
export function fitTerminal(agentId: string): void {
  const managed = terminals.get(agentId)
  if (!managed || !managed.opened) return
  managed.fitAddon.fit()
  window.agentHub.agents.resize(agentId, managed.term.cols, managed.term.rows)
}

/**
 * Update theme on all terminals.
 */
export function updateTheme(): void {
  const theme = getXtermTheme()
  for (const managed of terminals.values()) {
    managed.term.options.theme = theme
  }
}

/**
 * Destroy terminal — called when agent exits.
 */
export function destroyTerminal(agentId: string): void {
  const managed = terminals.get(agentId)
  if (!managed) return
  if (managed.webglAddon) {
    try { managed.webglAddon.dispose() } catch { /* ok */ }
  }
  managed.term.dispose()
  terminals.delete(agentId)
}

/**
 * Get raw Terminal instance for search, serialize, selection, etc.
 */
export function getTerminal(agentId: string): Terminal | null {
  return terminals.get(agentId)?.term ?? null
}

export function getSearchAddon(agentId: string): SearchAddon | null {
  return terminals.get(agentId)?.searchAddon ?? null
}

export function getSerializeAddon(agentId: string): SerializeAddon | null {
  return terminals.get(agentId)?.serializeAddon ?? null
}
