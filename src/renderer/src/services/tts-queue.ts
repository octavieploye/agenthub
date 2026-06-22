/**
 * FIFO speech queue — serializes TTS requests so agents don't cut each
 * other off. Each enqueued text waits for the previous one to finish.
 */
export class TtsQueue {
  private queue: string[] = []
  private speaking = false
  private speakFn: (text: string) => Promise<void>

  constructor(speakFn: (text: string) => Promise<void>) {
    this.speakFn = speakFn
  }

  enqueue(text: string): void {
    this.queue.push(text)
    if (!this.speaking) this.drain()
  }

  clear(): void {
    this.queue = []
  }

  get pending(): number {
    return this.queue.length
  }

  private async drain(): Promise<void> {
    if (this.speaking) return
    this.speaking = true
    while (this.queue.length > 0) {
      const text = this.queue.shift()!
      try {
        await this.speakFn(text)
      } catch (err) {
        console.warn('[TtsQueue] speak error, continuing:', err)
      }
    }
    this.speaking = false
  }
}
