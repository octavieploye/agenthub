import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  playAgentSound,
  SOUND_MAP,
  type SoundAlertDeps
} from './sound-alert'
import type { AgentSoundEvent } from '@shared/types/notification.types'

// ── Test helpers ─────────────────────────────────────────────────────────────

function createDeps(
  overrides: Partial<SoundAlertDeps> = {}
): SoundAlertDeps {
  return {
    playSound: vi.fn(),
    isSoundEnabled: vi.fn().mockReturnValue(true),
    ...overrides
  }
}

const ALL_EVENTS: AgentSoundEvent[] = [
  'agent_spawned',
  'agent_completed',
  'agent_locked',
  'agent_looping',
  'code_blue',
  'mission_complete',
  'user_approval'
]

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Sound Alert Service', () => {
  let deps: SoundAlertDeps

  beforeEach(() => {
    deps = createDeps()
  })

  // ── SOUND_MAP structure ──────────────────────────────────────────────────

  describe('SOUND_MAP', () => {
    it('has entries for all 7 event types', () => {
      for (const event of ALL_EVENTS) {
        expect(SOUND_MAP).toHaveProperty(event)
        expect(SOUND_MAP[event]).toHaveProperty('src')
        expect(SOUND_MAP[event]).toHaveProperty('volume')
      }
    })

    it('code_blue has the highest volume (1.0)', () => {
      expect(SOUND_MAP.code_blue.volume).toBe(1.0)

      for (const event of ALL_EVENTS) {
        expect(SOUND_MAP[event].volume).toBeLessThanOrEqual(1.0)
      }
    })

    it('agent_locked volume is greater than agent_spawned volume (attention > click sfx)', () => {
      expect(SOUND_MAP.agent_locked.volume).toBeGreaterThan(SOUND_MAP.agent_spawned.volume)
    })

    it('agent_locked volume is greater than agent_completed volume', () => {
      expect(SOUND_MAP.agent_locked.volume).toBeGreaterThan(SOUND_MAP.agent_completed.volume)
    })
  })

  // ── Volume hierarchy ─────────────────────────────────────────────────────

  describe('volume hierarchy', () => {
    it('code_blue (1.0) > agent_locked (0.8) > agent_looping (0.7) > mission_complete (0.6) > agent_spawned (0.5)', () => {
      expect(SOUND_MAP.code_blue.volume).toBe(1.0)
      expect(SOUND_MAP.agent_locked.volume).toBe(0.8)
      expect(SOUND_MAP.agent_looping.volume).toBe(0.7)
      expect(SOUND_MAP.mission_complete.volume).toBe(0.6)
      expect(SOUND_MAP.agent_spawned.volume).toBe(0.5)
    })

    it('agent_completed shares the same volume as agent_spawned (0.5)', () => {
      expect(SOUND_MAP.agent_completed.volume).toBe(0.5)
    })

    it('volumes are strictly descending: code_blue > agent_locked > agent_looping > mission_complete > agent_spawned', () => {
      expect(SOUND_MAP.code_blue.volume).toBeGreaterThan(SOUND_MAP.agent_locked.volume)
      expect(SOUND_MAP.agent_locked.volume).toBeGreaterThan(SOUND_MAP.agent_looping.volume)
      expect(SOUND_MAP.agent_looping.volume).toBeGreaterThan(SOUND_MAP.mission_complete.volume)
      expect(SOUND_MAP.mission_complete.volume).toBeGreaterThan(SOUND_MAP.agent_spawned.volume)
    })
  })

  // ── playAgentSound: correct sound file per event ─────────────────────────

  describe('playAgentSound plays the correct sound file', () => {
    it('plays state-change.mp3 for agent_spawned', () => {
      playAgentSound('agent_spawned', deps)

      expect(deps.playSound).toHaveBeenCalledWith('sounds/state-change.mp3', expect.any(Number))
    })

    it('plays bridge-beep.wav for agent_completed', () => {
      playAgentSound('agent_completed', deps)

      expect(deps.playSound).toHaveBeenCalledWith('sounds/bridge-beep.wav', expect.any(Number))
    })

    it('plays alert-yellow.wav for agent_locked', () => {
      playAgentSound('agent_locked', deps)

      expect(deps.playSound).toHaveBeenCalledWith('sounds/alert-yellow.wav', expect.any(Number))
    })

    it('plays alert-orange.mp3 for agent_looping', () => {
      playAgentSound('agent_looping', deps)

      expect(deps.playSound).toHaveBeenCalledWith('sounds/alert-orange.mp3', expect.any(Number))
    })

    it('plays code-blue.mp3 for code_blue', () => {
      playAgentSound('code_blue', deps)

      expect(deps.playSound).toHaveBeenCalledWith('sounds/code-blue.mp3', expect.any(Number))
    })

    it('plays mission-complete.wav for mission_complete', () => {
      playAgentSound('mission_complete', deps)

      expect(deps.playSound).toHaveBeenCalledWith('sounds/mission-complete.wav', expect.any(Number))
    })

    it('plays user-approval.mp3 for user_approval', () => {
      playAgentSound('user_approval', deps)

      expect(deps.playSound).toHaveBeenCalledWith('sounds/user-approval.mp3', expect.any(Number))
    })
  })

  // ── playAgentSound: correct volume per event ─────────────────────────────

  describe('playAgentSound passes the correct volume', () => {
    it('passes volume 0.5 for agent_spawned', () => {
      playAgentSound('agent_spawned', deps)

      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.5)
    })

    it('passes volume 0.5 for agent_completed', () => {
      playAgentSound('agent_completed', deps)

      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.5)
    })

    it('passes volume 0.8 for agent_locked', () => {
      playAgentSound('agent_locked', deps)

      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.8)
    })

    it('passes volume 0.7 for agent_looping', () => {
      playAgentSound('agent_looping', deps)

      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.7)
    })

    it('passes volume 1.0 for code_blue', () => {
      playAgentSound('code_blue', deps)

      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 1.0)
    })

    it('passes volume 0.6 for mission_complete', () => {
      playAgentSound('mission_complete', deps)

      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.6)
    })

    it('passes volume 0.7 for user_approval', () => {
      playAgentSound('user_approval', deps)

      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.7)
    })
  })

  // ── playAgentSound: return value ─────────────────────────────────────────

  describe('playAgentSound return value', () => {
    it('returns true when sound is played successfully', () => {
      const result = playAgentSound('agent_spawned', deps)

      expect(result).toBe(true)
    })

    it('returns true for each event type when sound is enabled', () => {
      for (const event of ALL_EVENTS) {
        const result = playAgentSound(event, deps)
        expect(result).toBe(true)
      }
    })

    it('returns false when sound is disabled', () => {
      deps = createDeps({ isSoundEnabled: vi.fn().mockReturnValue(false) })

      const result = playAgentSound('agent_spawned', deps)

      expect(result).toBe(false)
    })
  })

  // ── playAgentSound: sound disabled guard ─────────────────────────────────

  describe('sound disabled guard', () => {
    it('does NOT call playSound when isSoundEnabled returns false', () => {
      deps = createDeps({ isSoundEnabled: vi.fn().mockReturnValue(false) })

      playAgentSound('agent_spawned', deps)

      expect(deps.playSound).not.toHaveBeenCalled()
    })

    it('does NOT play any event sound when globally disabled', () => {
      deps = createDeps({ isSoundEnabled: vi.fn().mockReturnValue(false) })

      for (const event of ALL_EVENTS) {
        playAgentSound(event, deps)
      }

      expect(deps.playSound).not.toHaveBeenCalled()
    })

    it('checks isSoundEnabled before attempting to play', () => {
      deps = createDeps({ isSoundEnabled: vi.fn().mockReturnValue(false) })

      playAgentSound('code_blue', deps)

      expect(deps.isSoundEnabled).toHaveBeenCalled()
      expect(deps.playSound).not.toHaveBeenCalled()
    })
  })

  // ── playAgentSound: calls playSound exactly once per invocation ──────────

  describe('playSound call count', () => {
    it('calls playSound exactly once per invocation', () => {
      playAgentSound('agent_locked', deps)

      expect(deps.playSound).toHaveBeenCalledOnce()
    })

    it('calls isSoundEnabled exactly once per invocation', () => {
      playAgentSound('agent_completed', deps)

      expect(deps.isSoundEnabled).toHaveBeenCalledOnce()
    })
  })
})
