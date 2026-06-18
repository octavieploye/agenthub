/**
 * TtsTrigger — debounced TTS emission controller.
 *
 * Claude CLI cycles busy→locked→busy→locked multiple times during tool calls.
 * This class ensures TTS.RESPONSE_READY is emitted only on the FINAL locked
 * (or completed) transition — the one not interrupted by another busy cycle.
 */

export interface TtsTriggerOptions {
  debounceMs: number
  onEmit: (text: string) => void
  /**
   * Whether the trigger is ready to fire immediately on the first busy→locked.
   * - true (default): task mode — agent was spawned with a task, first response is real
   * - false: interactive mode — wait for the first locked→busy (user sends a message)
   *          before firing, to avoid announcing on Claude's initial ❯ prompt
   */
  primed?: boolean
}

export class TtsTrigger {
  private debounceMs: number
  private onEmit: (text: string) => void
  private timer: ReturnType<typeof setTimeout> | null = null
  private primed: boolean

  constructor(options: TtsTriggerOptions) {
    this.debounceMs = options.debounceMs
    this.onEmit = options.onEmit
    this.primed = options.primed ?? true
  }

  onStatusChange(prevStatus: string, newStatus: string, text: string): void {
    // Cancel any pending emit when a new busy cycle starts.
    // Also prime the trigger — the user has sent a request and Claude started processing.
    if (newStatus === 'busy') {
      if (this.timer !== null) {
        clearTimeout(this.timer)
        this.timer = null
      }
      if (prevStatus === 'locked') {
        this.primed = true
      }
      return
    }

    // Schedule emit on the terminal locked/completed transition, but only after
    // the trigger has been primed (i.e. at least one locked→busy was seen).
    if ((newStatus === 'locked' || newStatus === 'completed') && prevStatus === 'busy') {
      if (!this.primed) return
      if (this.timer !== null) {
        clearTimeout(this.timer)
      }
      this.timer = setTimeout(() => {
        this.timer = null
        this.onEmit(text)
      }, this.debounceMs)
    }
  }
}
