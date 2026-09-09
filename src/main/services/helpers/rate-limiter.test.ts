import { describe, it, expect, vi } from 'vitest'
import { SlidingWindowLimiter } from './rate-limiter'

describe('SlidingWindowLimiter', () => {
  it('allows up to max events', () => {
    const limiter = new SlidingWindowLimiter(3, 60_000)
    expect(limiter.tryAcquire()).toBe(true)
    expect(limiter.tryAcquire()).toBe(true)
    expect(limiter.tryAcquire()).toBe(true)
  })

  it('rejects at limit', () => {
    const limiter = new SlidingWindowLimiter(2, 60_000)
    limiter.tryAcquire()
    limiter.tryAcquire()
    expect(limiter.tryAcquire()).toBe(false)
  })

  it('window expiry resets count', async () => {
    vi.useFakeTimers()
    const limiter = new SlidingWindowLimiter(2, 1_000)
    limiter.tryAcquire()
    limiter.tryAcquire()
    vi.advanceTimersByTime(1_001)
    expect(limiter.tryAcquire()).toBe(true)
    vi.useRealTimers()
  })

  it('remaining() is accurate', () => {
    const limiter = new SlidingWindowLimiter(3, 60_000)
    expect(limiter.remaining()).toBe(3)
    limiter.tryAcquire()
    expect(limiter.remaining()).toBe(2)
    limiter.tryAcquire()
    expect(limiter.remaining()).toBe(1)
  })
})
