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
}

export class TtsTrigger {
  private debounceMs: number
  private onEmit: (text: string) => void
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(options: TtsTriggerOptions) {
    this.debounceMs = options.debounceMs
    this.onEmit = options.onEmit
  }

  onStatusChange(prevStatus: string, newStatus: string, text: string): void {
    // Cancel any pending emit when a new busy cycle starts
    if (newStatus === 'busy') {
      if (this.timer !== null) {
        clearTimeout(this.timer)
        this.timer = null
      }
      return
    }

    // Schedule emit on the terminal locked/completed transition
    if ((newStatus === 'locked' || newStatus === 'completed') && prevStatus === 'busy') {
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
