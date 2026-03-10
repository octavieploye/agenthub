const MAX_BUFFER_BYTES = 2 * 1024 * 1024 // 2MB per agent

/**
 * Ring buffer that avoids O(n) shift() operations when trimming old data.
 * Stores chunks in a fixed-capacity array and overwrites oldest entries.
 */
class RingBuffer {
  private items: string[]
  private head = 0 // next write position
  private count = 0 // number of valid items
  private totalSize = 0
  private readonly capacity: number

  constructor(capacity = 4096) {
    this.capacity = capacity
    this.items = new Array(capacity)
  }

  push(data: string): void {
    if (this.count === this.capacity) {
      // Overwrite oldest — subtract its size
      this.totalSize -= this.items[this.head].length
    } else {
      this.count++
    }
    this.items[this.head] = data
    this.head = (this.head + 1) % this.capacity
    this.totalSize += data.length

    // Enforce byte cap by dropping oldest entries
    while (this.totalSize > MAX_BUFFER_BYTES && this.count > 0) {
      const tailIdx = (this.head - this.count + this.capacity) % this.capacity
      this.totalSize -= this.items[tailIdx].length
      this.count--
    }
  }

  drain(): string {
    if (this.count === 0) return ''
    const parts: string[] = new Array(this.count)
    const start = (this.head - this.count + this.capacity) % this.capacity
    for (let i = 0; i < this.count; i++) {
      parts[i] = this.items[(start + i) % this.capacity]
    }
    this.count = 0
    this.head = 0
    this.totalSize = 0
    return parts.join('')
  }

  get size(): number {
    return this.totalSize
  }
}

/**
 * Singleton service that buffers agent PTY output received via IPC.
 *
 * When no consumer is listening (no passthrough callbacks), output chunks are
 * accumulated in memory up to a 2MB cap per agent using a ring buffer (O(1)
 * trim instead of O(n) array.shift()). When a consumer calls `drain()`, all
 * buffered content is returned and subsequent output is forwarded directly to
 * the registered callback(s) — no buffering occurs while at least one
 * passthrough is active.
 *
 * Multiple simultaneous passthroughs per agent are supported (e.g. main
 * window + breakout window).
 */
class OutputBuffer {
  private buffers = new Map<string, RingBuffer>()
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
    // Safety: auto-start if not yet subscribed (e.g. breakout window race)
    if (!this.unsubscribe) {
      this.start()
    }

    // Gather buffered content
    const ring = this.buffers.get(agentId)
    const buffered = ring ? ring.drain() : ''

    // Clear the buffer since we've drained it
    this.buffers.delete(agentId)

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
  }

  /**
   * Remove all buffers.
   */
  clearAll(): void {
    this.buffers.clear()
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

    // Buffering mode — O(1) ring buffer insert + trim
    let ring = this.buffers.get(agentId)
    if (!ring) {
      ring = new RingBuffer()
      this.buffers.set(agentId, ring)
    }
    ring.push(data)
  }
}

export const outputBuffer = new OutputBuffer()
