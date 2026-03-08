const MAX_BUFFER_BYTES = 2 * 1024 * 1024 // 2MB per agent

/**
 * Singleton service that buffers agent PTY output received via IPC.
 *
 * When no consumer is listening (no passthrough callbacks), output chunks are
 * accumulated in memory up to a 2MB cap per agent. When a consumer calls
 * `drain()`, all buffered content is returned and subsequent output is
 * forwarded directly to the registered callback(s) — no buffering occurs
 * while at least one passthrough is active.
 *
 * Multiple simultaneous passthroughs per agent are supported (e.g. main
 * window + breakout window).
 */
class OutputBuffer {
  private buffers = new Map<string, string[]>()
  private sizes = new Map<string, number>()
  private passthroughs = new Map<string, Set<(data: string) => void>>()
  private unsubscribe: (() => void) | null = null

  /**
   * Subscribe to the IPC agentOutput event. Call once on app mount.
   */
  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = window.agentHub.on.agentOutput(
      (agentId: string, data: string) => {
        this.handleData(agentId, data)
      }
    )
  }

  /**
   * Unsubscribe from IPC. Call on app unmount / cleanup.
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  /**
   * Return all buffered content for `agentId` as a single string, then
   * register `callback` as a passthrough so future data is forwarded
   * directly instead of buffered.
   */
  drain(agentId: string, callback: (data: string) => void): string {
    // Gather buffered content
    const chunks = this.buffers.get(agentId)
    const buffered = chunks ? chunks.join('') : ''

    // Clear the buffer since we've drained it
    this.buffers.delete(agentId)
    this.sizes.delete(agentId)

    // Register the passthrough callback
    let callbacks = this.passthroughs.get(agentId)
    if (!callbacks) {
      callbacks = new Set()
      this.passthroughs.set(agentId, callbacks)
    }
    callbacks.add(callback)

    return buffered
  }

  /**
   * Remove a single passthrough callback. If no callbacks remain for the
   * agent, future output reverts to buffering.
   */
  stopPassthrough(agentId: string, callback: (data: string) => void): void {
    const callbacks = this.passthroughs.get(agentId)
    if (!callbacks) return
    callbacks.delete(callback)
    if (callbacks.size === 0) {
      this.passthroughs.delete(agentId)
    }
  }

  /**
   * Remove the buffer for a single agent.
   */
  clear(agentId: string): void {
    this.buffers.delete(agentId)
    this.sizes.delete(agentId)
  }

  /**
   * Remove all buffers.
   */
  clearAll(): void {
    this.buffers.clear()
    this.sizes.clear()
  }

  // ---- internal ----

  private handleData(agentId: string, data: string): void {
    const callbacks = this.passthroughs.get(agentId)
    if (callbacks && callbacks.size > 0) {
      // Passthrough mode — forward to all consumers, skip buffering
      for (const cb of callbacks) {
        cb(data)
      }
      return
    }

    // Buffering mode
    let chunks = this.buffers.get(agentId)
    if (!chunks) {
      chunks = []
      this.buffers.set(agentId, chunks)
    }

    chunks.push(data)
    const currentSize = (this.sizes.get(agentId) ?? 0) + data.length
    this.sizes.set(agentId, currentSize)

    // Enforce 2MB cap — drop oldest chunks from the front
    if (currentSize > MAX_BUFFER_BYTES) {
      this.trimBuffer(agentId, chunks)
    }
  }

  private trimBuffer(agentId: string, chunks: string[]): void {
    let totalSize = this.sizes.get(agentId) ?? 0
    while (totalSize > MAX_BUFFER_BYTES && chunks.length > 0) {
      const dropped = chunks.shift()!
      totalSize -= dropped.length
    }
    this.sizes.set(agentId, totalSize)
  }
}

export const outputBuffer = new OutputBuffer()
