import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatTtsMessage,
  speakTriageEvent,
  DEFAULT_TTS_VOLUME,
  type VoiceTtsDeps
} from './voice-tts'
import type { TriageEvent } from '@shared/types/triage.types'

// -- Test helpers -------------------------------------------------------------

function createDeps(overrides: Partial<VoiceTtsDeps> = {}): VoiceTtsDeps {
  return {
    speak: vi.fn(),
    isVoiceEnabled: vi.fn().mockReturnValue(true),
    isFocused: vi.fn().mockReturnValue(false),
    ...overrides
  }
}

function createTriageEvent(overrides: Partial<TriageEvent> = {}): TriageEvent {
  return {
    agentId: 'agent-1',
    agentName: 'BuildBot',
    repoName: 'my-repo',
    taskDescription: 'Run integration tests',
    previousStatus: 'busy',
    currentStatus: 'idle',
    triageLevel: 'critical',
    timestamp: Date.now(),
    reason: 'Agent needs user input',
    ...overrides
  }
}

// -- Tests --------------------------------------------------------------------

describe('Voice TTS Service', () => {
  let deps: VoiceTtsDeps

  beforeEach(() => {
    deps = createDeps()
  })

  // -- formatTtsMessage -------------------------------------------------------

  describe('formatTtsMessage', () => {
    it('formats message as "{agentName} in {repoName}: {reason}"', () => {
      const event = createTriageEvent({
        agentName: 'BuildBot',
        repoName: 'my-repo',
        reason: 'Agent needs user input'
      })

      const message = formatTtsMessage(event)

      expect(message).toBe('BuildBot in my-repo: Agent needs user input')
    })

    it('uses the event reason, not a hardcoded string', () => {
      const event1 = createTriageEvent({ reason: 'Build failed with exit code 1' })
      const event2 = createTriageEvent({ reason: 'Permission denied on deploy' })

      const msg1 = formatTtsMessage(event1)
      const msg2 = formatTtsMessage(event2)

      expect(msg1).toContain('Build failed with exit code 1')
      expect(msg2).toContain('Permission denied on deploy')
      expect(msg1).not.toBe(msg2)
    })

    it('handles long agent names and repo names', () => {
      const event = createTriageEvent({
        agentName: 'VeryLongAgentNameThatExceedsNormalLength',
        repoName: 'my-extremely-long-repository-name-that-goes-on-and-on',
        reason: 'Quota exceeded'
      })

      const message = formatTtsMessage(event)

      expect(message).toBe(
        'VeryLongAgentNameThatExceedsNormalLength in my-extremely-long-repository-name-that-goes-on-and-on: Quota exceeded'
      )
    })
  })

  // -- speakTriageEvent: voice disabled guard ---------------------------------

  describe('speakTriageEvent — voice disabled guard', () => {
    it('returns false when voice is disabled', () => {
      deps = createDeps({ isVoiceEnabled: vi.fn().mockReturnValue(false) })
      const event = createTriageEvent()

      const result = speakTriageEvent(event, deps)

      expect(result).toBe(false)
    })

    it('does NOT call speak when voice is disabled', () => {
      deps = createDeps({ isVoiceEnabled: vi.fn().mockReturnValue(false) })
      const event = createTriageEvent()

      speakTriageEvent(event, deps)

      expect(deps.speak).not.toHaveBeenCalled()
    })

    it('checks isVoiceEnabled before anything else', () => {
      deps = createDeps({ isVoiceEnabled: vi.fn().mockReturnValue(false) })
      const event = createTriageEvent()

      speakTriageEvent(event, deps)

      expect(deps.isVoiceEnabled).toHaveBeenCalled()
      expect(deps.isFocused).not.toHaveBeenCalled()
      expect(deps.speak).not.toHaveBeenCalled()
    })
  })

  // -- speakTriageEvent: focused agent guard ----------------------------------

  describe('speakTriageEvent — focused agent guard', () => {
    it('returns false when the agent terminal is currently focused', () => {
      deps = createDeps({ isFocused: vi.fn().mockReturnValue(true) })
      const event = createTriageEvent({ agentId: 'agent-1' })

      const result = speakTriageEvent(event, deps)

      expect(result).toBe(false)
    })

    it('does NOT call speak when agent is focused', () => {
      deps = createDeps({ isFocused: vi.fn().mockReturnValue(true) })
      const event = createTriageEvent({ agentId: 'agent-1' })

      speakTriageEvent(event, deps)

      expect(deps.speak).not.toHaveBeenCalled()
    })

    it('returns true when a DIFFERENT agent is focused (not the event agent)', () => {
      deps = createDeps({
        isFocused: vi.fn().mockImplementation((id: string) => id === 'agent-2')
      })
      const event = createTriageEvent({ agentId: 'agent-1' })

      const result = speakTriageEvent(event, deps)

      expect(result).toBe(true)
    })
  })

  // -- speakTriageEvent: successful speech ------------------------------------

  describe('speakTriageEvent — successful speech', () => {
    it('returns true when speech is triggered', () => {
      const event = createTriageEvent()

      const result = speakTriageEvent(event, deps)

      expect(result).toBe(true)
    })

    it('calls speak with the formatted message text', () => {
      const event = createTriageEvent({
        agentName: 'BuildBot',
        repoName: 'my-repo',
        reason: 'Agent needs user input'
      })

      speakTriageEvent(event, deps)

      expect(deps.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'BuildBot in my-repo: Agent needs user input'
        })
      )
    })

    it('calls speak with DEFAULT_TTS_VOLUME when no volume override', () => {
      const event = createTriageEvent()

      speakTriageEvent(event, deps)

      expect(deps.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          volume: DEFAULT_TTS_VOLUME
        })
      )
    })

    it('calls speak with custom volume when override provided', () => {
      const event = createTriageEvent()

      speakTriageEvent(event, deps, 0.5)

      expect(deps.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          volume: 0.5
        })
      )
    })

    it('calls speak exactly once per invocation', () => {
      const event = createTriageEvent()

      speakTriageEvent(event, deps)

      expect(deps.speak).toHaveBeenCalledOnce()
    })
  })

  // -- speakTriageEvent: volume control ---------------------------------------

  describe('speakTriageEvent — volume control', () => {
    it('DEFAULT_TTS_VOLUME is 0.7', () => {
      expect(DEFAULT_TTS_VOLUME).toBe(0.7)
    })

    it('volume override of 0.3 is passed to speak', () => {
      const event = createTriageEvent()

      speakTriageEvent(event, deps, 0.3)

      expect(deps.speak).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 0.3 })
      )
    })

    it('volume override of 1.0 is passed to speak', () => {
      const event = createTriageEvent()

      speakTriageEvent(event, deps, 1.0)

      expect(deps.speak).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 1.0 })
      )
    })

    it('volume is independent from sound effects (uses its own deps.speak)', () => {
      const event = createTriageEvent()

      speakTriageEvent(event, deps, 0.4)

      // The speak dep is TTS-specific, not the same as playSound from SoundAlertDeps
      expect(deps.speak).toHaveBeenCalledWith({ text: expect.any(String), volume: 0.4 })
      // Verify it uses the VoiceTtsDeps.speak interface, not a shared sound function
      expect(deps.speak).toHaveBeenCalledTimes(1)
    })
  })

  // -- speakTriageEvent: guard ordering ---------------------------------------

  describe('speakTriageEvent — guard ordering', () => {
    it('checks isVoiceEnabled before isFocused', () => {
      const callOrder: string[] = []

      deps = createDeps({
        isVoiceEnabled: vi.fn().mockImplementation(() => {
          callOrder.push('isVoiceEnabled')
          return true
        }),
        isFocused: vi.fn().mockImplementation(() => {
          callOrder.push('isFocused')
          return false
        })
      })

      const event = createTriageEvent()
      speakTriageEvent(event, deps)

      expect(callOrder.indexOf('isVoiceEnabled')).toBeLessThan(
        callOrder.indexOf('isFocused')
      )
    })

    it('does not check isFocused if voice is disabled', () => {
      deps = createDeps({
        isVoiceEnabled: vi.fn().mockReturnValue(false)
      })

      const event = createTriageEvent()
      speakTriageEvent(event, deps)

      expect(deps.isVoiceEnabled).toHaveBeenCalled()
      expect(deps.isFocused).not.toHaveBeenCalled()
    })
  })
})
