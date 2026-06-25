/**
 * Terminal registry for cross-terminal search.
 *
 * Terminals are now owned by FullTerminal components (one per agent).
 * This module provides a lightweight registry so cross-terminal search
 * can access all active terminal buffers.
 */

import { Terminal } from '@xterm/xterm'

const terminals = new Map<string, Terminal>()

/**
 * Register a terminal instance for cross-terminal search.
 * Called by FullTerminal on mount.
 */
export function registerTerminal(agentId: string, term: Terminal): void {
  terminals.set(agentId, term)
}

/**
 * Unregister a terminal instance.
 * Called by FullTerminal on cleanup.
 */
export function unregisterTerminal(agentId: string): void {
  terminals.delete(agentId)
}

export interface TerminalSearchHit {
  agentId: string
  line: string
  lineNumber: number
}

/**
 * Search all registered terminal buffers for a query string.
 */
export function searchAllTerminals(query: string): TerminalSearchHit[] {
  if (!query.trim()) return []
  const lowerQuery = query.toLowerCase()
  const results: TerminalSearchHit[] = []

  for (const [agentId, term] of terminals.entries()) {
    const buffer = term.buffer.active
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
