export class SlidingWindowLimiter {
  private timestamps: number[] = []

  constructor(
    private readonly maxEvents: number,
    private readonly windowMs: number
  ) {}

  tryAcquire(): boolean {
    const now = Date.now()
    this.prune(now)
    if (this.timestamps.length >= this.maxEvents) return false
    this.timestamps.push(now)
    return true
  }

  remaining(): number {
    this.prune(Date.now())
    return Math.max(0, this.maxEvents - this.timestamps.length)
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs
    this.timestamps = this.timestamps.filter((t) => t > cutoff)
  }
}
