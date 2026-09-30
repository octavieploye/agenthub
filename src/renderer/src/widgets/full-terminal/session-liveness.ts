/**
 * Registry of agents whose PTY has exited.
 *
 * Terminals persist outside the React lifecycle, so a pane stays mounted after
 * its agent exits. Without this registry the xterm pane keeps accepting
 * keystrokes and forwarding them to a PTY that no longer exists — main drops
 * them ("sendInput: agent not found") and the user sees a frozen terminal.
 */

const endedSessions = new Set<string>()

/** Record that an agent's PTY is gone. */
export function markSessionEnded(agentId: string): void {
  endedSessions.add(agentId)
}

/** Record that an agent has a live PTY again (respawn). */
export function clearSessionEnded(agentId: string): void {
  endedSessions.delete(agentId)
}

/** True when the agent's PTY is gone and input cannot be delivered. */
export function isSessionEnded(agentId: string): boolean {
  return endedSessions.has(agentId)
}

/** Test-only: drop all recorded state so specs start from a clean registry. */
export function resetSessionLiveness(): void {
  endedSessions.clear()
}
