import { describe, it, expect } from 'vitest'
import { shouldResetTtsBuffer } from './tts-buffer-reset'

describe('shouldResetTtsBuffer', () => {
  it('resets when data contains \\r and ttsStatus is locked', () => {
    expect(shouldResetTtsBuffer('\r', 'locked')).toBe(true)
  })

  it('resets when data contains \\r mid-string and ttsStatus is locked', () => {
    expect(shouldResetTtsBuffer('hello\r', 'locked')).toBe(true)
  })

  it('does NOT reset when ttsStatus is busy (even if \\r present)', () => {
    // This was the bug: state.status lagged 4s and was still 'busy'
    // when user typed \r — so the buffer was never cleared.
    expect(shouldResetTtsBuffer('\r', 'busy')).toBe(false)
  })

  it('does NOT reset when ttsStatus is locked but no \\r in data', () => {
    expect(shouldResetTtsBuffer('hello', 'locked')).toBe(false)
  })

  it('does NOT reset for any non-locked status', () => {
    expect(shouldResetTtsBuffer('\r', 'awaiting_approval')).toBe(false)
    expect(shouldResetTtsBuffer('\r', 'completed')).toBe(false)
    expect(shouldResetTtsBuffer('\r', 'idle')).toBe(false)
  })
})
