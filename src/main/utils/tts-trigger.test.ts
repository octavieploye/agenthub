/**
 * TtsTrigger — controls when TTS.RESPONSE_READY should be emitted.
 *
 * The problem: Claude CLI cycles busy→locked→busy→locked multiple times
 * during tool-call sequences. Each busy→locked transition would fire TTS,
 * producing multiple announcements per response.
 *
 * The fix: debounce the emit. Only fire after the agent has been in `locked`
 * (or `completed`) for a stable window with no subsequent `busy` transition.
 *
 * These tests define the required behavior BEFORE the module exists.
 * All tests are expected to FAIL until tts-trigger.ts is implemented.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TtsTrigger } from './tts-trigger'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TtsTrigger — single response, no tool calls', () => {
  it('emits once after debounce when busy → locked with no follow-up busy', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

    trigger.onStatusChange('busy', 'locked', 'My prose response.')

    // Before debounce settles: no emit yet
    expect(emit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('My prose response.')
  })

  it('emits once after debounce when busy → completed', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

    trigger.onStatusChange('busy', 'completed', 'Final output.')

    vi.advanceTimersByTime(300)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('Final output.')
  })
})

describe('TtsTrigger — tool-call cycles (busy→locked→busy→locked)', () => {
  it('does NOT emit on intermediate locked transitions during tool calls', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

    // Tool call cycle 1: agent goes busy → locked (mid-response)
    trigger.onStatusChange('busy', 'locked', 'partial text after tool 1')

    // Within debounce window: agent resumes — timer should be cancelled
    vi.advanceTimersByTime(100)
    trigger.onStatusChange('locked', 'busy', '')

    expect(emit).not.toHaveBeenCalled()

    // Tool call cycle 2
    trigger.onStatusChange('busy', 'locked', 'text after tool 2')

    vi.advanceTimersByTime(100)
    trigger.onStatusChange('locked', 'busy', '')

    expect(emit).not.toHaveBeenCalled()

    // Final locked — agent done, waiting for user input
    trigger.onStatusChange('busy', 'locked', 'final prose text')

    vi.advanceTimersByTime(300)

    // Only fires once — on the final locked
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('final prose text')
  })

  it('emits the text from the FINAL locked transition, not an intermediate one', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

    trigger.onStatusChange('busy', 'locked', 'text after first tool')
    vi.advanceTimersByTime(50)
    trigger.onStatusChange('locked', 'busy', '')

    trigger.onStatusChange('busy', 'locked', 'text after second tool — the real response')
    vi.advanceTimersByTime(300)

    expect(emit).toHaveBeenCalledWith('text after second tool — the real response')
  })
})

describe('TtsTrigger — multiple sequential responses', () => {
  it('emits correctly for each new response after the previous completes', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

    // Response 1
    trigger.onStatusChange('busy', 'locked', 'response one')
    vi.advanceTimersByTime(300)
    expect(emit).toHaveBeenCalledTimes(1)

    // New response begins
    trigger.onStatusChange('locked', 'busy', '')
    trigger.onStatusChange('busy', 'locked', 'response two')
    vi.advanceTimersByTime(300)

    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit.mock.calls[1][0]).toBe('response two')
  })

  it('does not emit for transitions other than busy→locked or busy→completed', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

    trigger.onStatusChange('idle', 'busy', '')
    trigger.onStatusChange('locked', 'idle', '')

    vi.advanceTimersByTime(300)

    expect(emit).not.toHaveBeenCalled()
  })
})

describe('TtsTrigger — tool-only responses', () => {
  it('still emits with empty text so the completion announcement always fires', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit })

    trigger.onStatusChange('busy', 'locked', '')

    vi.advanceTimersByTime(300)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('')
  })
})

describe('TtsTrigger — interactive mode (primed: false)', () => {
  it('does NOT emit on first busy → locked before any locked → busy has been seen', () => {
    // Simulates: agent spawned in interactive mode, zsh/Claude shows ❯ before user sends anything
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit, primed: false })

    trigger.onStatusChange('busy', 'locked', '')
    vi.advanceTimersByTime(300)

    expect(emit).not.toHaveBeenCalled()
  })

  it('emits after user sends first request: locked → busy unlocks the trigger', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit, primed: false })

    // False positive at startup — should be ignored
    trigger.onStatusChange('busy', 'locked', '')
    vi.advanceTimersByTime(100)

    // User sends first message → Claude starts processing
    trigger.onStatusChange('locked', 'busy', '')

    // Claude responds → busy → locked
    trigger.onStatusChange('busy', 'locked', 'First real response.')
    vi.advanceTimersByTime(300)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('First real response.')
  })

  it('continues emitting for all subsequent responses once unlocked', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit, primed: false })

    // Unlock via first user request
    trigger.onStatusChange('busy', 'locked', '')
    trigger.onStatusChange('locked', 'busy', '')
    trigger.onStatusChange('busy', 'locked', 'response one')
    vi.advanceTimersByTime(300)
    expect(emit).toHaveBeenCalledTimes(1)

    // Second response
    trigger.onStatusChange('locked', 'busy', '')
    trigger.onStatusChange('busy', 'locked', 'response two')
    vi.advanceTimersByTime(300)
    expect(emit).toHaveBeenCalledTimes(2)
  })
})

describe('TtsTrigger — task mode (primed: true, default)', () => {
  it('emits on first busy → locked when primed: true (task was given at spawn)', () => {
    const emit = vi.fn()
    const trigger = new TtsTrigger({ debounceMs: 300, onEmit: emit, primed: true })

    trigger.onStatusChange('busy', 'locked', 'Task response.')
    vi.advanceTimersByTime(300)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('Task response.')
  })
})
