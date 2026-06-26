/**
 * Persistent terminal manager — terminals live outside React lifecycle.
 *
 * Terminals are created once per agent and stored in a Map. Data flows
 * directly from IPC to term.write() — no output buffer, no React effect
 * dependency. The FullTerminal React component is just a DOM attachment
 * wrapper that calls attachToContainer/setVisible.
 *
 * This architecture is immune to React Strict Mode double-mount because
 * the terminal instance persists across mount/unmount/remount cycles.
 */

import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { getXtermTheme } from './theme-bridge'
import { watchWebGlContext } from '../../crash-logger'

let webglFailureCount = 0
const MAX_WEBGL_FAILURES = 3

// Hardcoded Catppuccin Mocha theme — guaranteed to work without CSS variables.
const CATPPUCCIN_MOCHA = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: 'transparent',
  cursorAccent: 'transparent',
  selectionBackground: '#585b70',
  black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
  blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
  brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5', brightWhite: '#a6adc8',
}

export interface ManagedTerminal {
  term: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  serializeAddon: SerializeAddon
  webglAddon: WebglAddon | null
  opened: boolean
  container: HTMLDivElement | null
  pendingWrites: string[]
}

const terminals = new Map<string, ManagedTerminal>()

// Pre-open buffer: catches IPC data for agents that don't have a terminal yet
const preOpenBuffers = new Map<string, string[]>()

// Global IPC subscription — routes data to the correct terminal
let ipcUnsubscribe: (() => void) | null = null

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
 * Start listening to IPC immediately. Call on app mount so no data is lost.
 */
export function startIpcListener(): void {
  ensureIpcSubscription()
}

function tryLoadWebGL(
  term: Terminal,
  container: HTMLDivElement,
  agentId: string
): WebglAddon | null {
  if (webglFailureCount >= MAX_WEBGL_FAILURES) return null
  try {
    const webgl = new WebglAddon()
    term.loadAddon(webgl)
    watchWebGlContext(container, agentId)
    webgl.onContextLoss(() => {
      webgl.dispose()
      webglFailureCount++
      const managed = terminals.get(agentId)
      if (managed) {
        managed.webglAddon = null
        requestAnimationFrame(() => {
          if (managed.opened && managed.container) {
            managed.fitAddon.fit()
            managed.term.refresh(0, managed.term.rows - 1)
          }
        })
      }
    })
    return webgl
  } catch {
    webglFailureCount++
    return null
  }
}

/**
 * Get or create a terminal for the given agent.
 * Only the Terminal instance is created here — addons are loaded in attachToContainer.
 */
export function getOrCreateTerminal(agentId: string): ManagedTerminal {
  const existing = terminals.get(agentId)
  if (existing) return existing

  ensureIpcSubscription()

  const term = new Terminal({
    cursorBlink: false,
    fontSize: 13,
    fontFamily: "'JetBrains Mono Variable', 'SF Mono', Menlo, monospace",
    lineHeight: 1.19,
    letterSpacing: 0,
    theme: CATPPUCCIN_MOCHA,
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
    container: null,
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
 * Open terminal in a DOM container. First call opens + loads addons.
 * Subsequent calls reparent the existing terminal DOM element.
 */
export function attachToContainer(agentId: string, container: HTMLDivElement): void {
  const managed = getOrCreateTerminal(agentId)

  if (!managed.opened) {
    // Clear container of any stale DOM
    while (container.firstChild) container.removeChild(container.firstChild)

    // Phase 5 sequence: open FIRST, then load addons
    managed.term.open(container)
    managed.opened = true
    managed.container = container

    // Load addons AFTER open
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

    managed.webglAddon = tryLoadWebGL(managed.term, container, agentId)

    // Synchronous fit first, then rAF re-fit after fonts load
    managed.fitAddon.fit()
    window.agentHub.agents.resize(agentId, managed.term.cols, managed.term.rows)

    requestAnimationFrame(() => {
      document.fonts.ready.then(() => {
        if (!managed.opened) return
        managed.fitAddon.fit()
        window.agentHub.agents.resize(agentId, managed.term.cols, managed.term.rows)
      })
    })

    // Flush any data that arrived before the terminal was opened
    if (managed.pendingWrites.length > 0) {
      const pending = managed.pendingWrites.join('')
      managed.pendingWrites = []
      managed.term.write(pending)
    }

    // Wire keyboard input to IPC
    managed.term.onData((data: string) => {
      window.agentHub.agents.sendInput(agentId, data)
    })
  } else {
    // Already opened — reparent if needed
    managed.container = container
    const el = managed.term.element
    if (el && el.parentElement !== container) {
      while (container.firstChild) container.removeChild(container.firstChild)
      container.appendChild(el)
    }
    managed.fitAddon.fit()
    window.agentHub.agents.resize(agentId, managed.term.cols, managed.term.rows)
  }
}

/**
 * Detach terminal from its container without disposing.
 * Called by FullTerminal cleanup — terminal stays alive in the Map.
 */
export function detachFromContainer(agentId: string): void {
  const managed = terminals.get(agentId)
  if (!managed) return
  managed.container = null
}

/**
 * Handle visibility changes — fit, refresh, focus, WebGL management.
 */
export function setVisible(agentId: string, visible: boolean): void {
  const managed = terminals.get(agentId)
  if (!managed || !managed.opened) return

  if (visible) {
    // Attempt WebGL recovery if it was lost
    if (!managed.webglAddon && webglFailureCount < MAX_WEBGL_FAILURES && managed.container) {
      managed.webglAddon = tryLoadWebGL(managed.term, managed.container, agentId)
    }
    requestAnimationFrame(() => {
      document.fonts.ready.then(() => {
        if (!managed.opened) return
        managed.fitAddon.fit()
        managed.term.refresh(0, managed.term.rows - 1)
        managed.term.focus()
        window.agentHub.agents.resize(agentId, managed.term.cols, managed.term.rows)
      })
    })
  } else {
    // Conserve GPU resources for hidden terminals
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
 * Update theme on all terminals (with CSS variable guard).
 * Rejects themes where any color resolved to #000000 — means CSS variable was unavailable.
 */
export function updateTheme(): void {
  try {
    const xtermTheme = getXtermTheme()
    const colors = Object.values(xtermTheme).filter((v): v is string => typeof v === 'string')
    const hasUnresolved = colors.some((c) => c === '#000000')
    if (hasUnresolved) return
    for (const managed of terminals.values()) {
      managed.term.options.theme = xtermTheme
    }
  } catch {
    // Theme bridge failed — keep current theme
  }
}

/**
 * Destroy terminal — call when agent is removed from the UI.
 */
export function destroyTerminal(agentId: string): void {
  const managed = terminals.get(agentId)
  if (!managed) return
  if (managed.webglAddon) {
    try { managed.webglAddon.dispose() } catch { /* ok */ }
  }
  managed.term.dispose()
  terminals.delete(agentId)
  preOpenBuffers.delete(agentId)
}

/**
 * Get raw Terminal instance for selection, clear, selectAll, etc.
 */
export function getTerminal(agentId: string): Terminal | null {
  return terminals.get(agentId)?.term ?? null
}

/**
 * Get search addon for in-terminal search UI.
 */
export function getSearchAddon(agentId: string): SearchAddon | null {
  return terminals.get(agentId)?.searchAddon ?? null
}

/**
 * Get serialize addon for terminal serialization.
 */
export function getSerializeAddon(agentId: string): SerializeAddon | null {
  return terminals.get(agentId)?.serializeAddon ?? null
}

// ── Cross-terminal search (used by TerminalSearchPanel) ─────────────

export interface TerminalSearchHit {
  agentId: string
  line: string
  lineNumber: number
}

export function searchAllTerminals(query: string): TerminalSearchHit[] {
  if (!query.trim()) return []
  const lowerQuery = query.toLowerCase()
  const results: TerminalSearchHit[] = []

  for (const [agentId, managed] of terminals.entries()) {
    const buffer = managed.term.buffer.active
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i)
      if (!line) continue
      const text = line.translateToString(true)
      if (text.toLowerCase().includes(lowerQuery)) {
        results.push({ agentId, line: text, lineNumber: i + 1 })
      }
    }
  }
  return results
}
