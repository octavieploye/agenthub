import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playAgentSound, SOUND_MAP, statusToSoundEvent, type SoundAlertDeps } from './sound-alert'
import type { AgentSoundEvent } from '@shared/types/notification.types'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

// ── Test helpers ─────────────────────────────────────────────────────────────

function createDeps(overrides: Partial<SoundAlertDeps> = {}): SoundAlertDeps {
  return {
    playSound: vi.fn(),
    isSoundEnabled: vi.fn().mockReturnValue(true),
    getMasterVolume: vi.fn().mockReturnValue(1.0),
    ...overrides
  }
}

const ALL_EVENTS: AgentSoundEvent[] = ['agent_spawned', 'agent_completed', 'user_approval']

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Sound Alert Service', () => {
  let deps: SoundAlertDeps

  beforeEach(() => {
    deps = createDeps()
  })

  // ── SOUND_MAP structure ──────────────────────────────────────────────────

  describe('SOUND_MAP', () => {
    it('has entries for all 3 event types', () => {
      for (const event of ALL_EVENTS) {
        expect(SOUND_MAP).toHaveProperty(event)
        expect(SOUND_MAP[event]).toHaveProperty('src')
        expect(SOUND_MAP[event]).toHaveProperty('volume')
      }
    })
  })

  // ── Volume hierarchy ─────────────────────────────────────────────────────

  describe('volume hierarchy', () => {
    it('agent_completed has the highest volume (0.8)', () => {
      expect(SOUND_MAP.agent_completed.volume).toBe(0.8)
    })

    it('volumes are descending: agent_completed > user_approval > agent_spawned', () => {
      expect(SOUND_MAP.agent_completed.volume).toBeGreaterThan(SOUND_MAP.user_approval.volume)
      expect(SOUND_MAP.user_approval.volume).toBeGreaterThan(SOUND_MAP.agent_spawned.volume)
    })
  })

  // ── playAgentSound: correct sound file per event ─────────────────────────

  describe('playAgentSound plays the correct sound file', () => {
    it('plays state-change.mp3 for agent_spawned', () => {
      playAgentSound('agent_spawned', deps)
      expect(deps.playSound).toHaveBeenCalledWith('sounds/state-change.mp3', expect.any(Number))
    })

    it('plays alert-yellow.wav for agent_completed', () => {
      playAgentSound('agent_completed', deps)
      expect(deps.playSound).toHaveBeenCalledWith('sounds/alert-yellow.wav', expect.any(Number))
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

    it('passes volume 0.8 for agent_completed', () => {
      playAgentSound('agent_completed', deps)
      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.8)
    })

    it('passes volume 0.7 for user_approval', () => {
      playAgentSound('user_approval', deps)
      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.7)
    })
  })

  // ── playAgentSound: return value ─────────────────────────────────────────

  describe('playAgentSound return value', () => {
    it('returns true when sound is played successfully', () => {
      const result = playAgentSound('agent_completed', deps)
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
      const result = playAgentSound('agent_completed', deps)
      expect(result).toBe(false)
    })
  })

  // ── playAgentSound: sound disabled guard ─────────────────────────────────

  describe('sound disabled guard', () => {
    it('does NOT call playSound when isSoundEnabled returns false', () => {
      deps = createDeps({ isSoundEnabled: vi.fn().mockReturnValue(false) })
      playAgentSound('agent_completed', deps)
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
      playAgentSound('user_approval', deps)
      expect(deps.isSoundEnabled).toHaveBeenCalled()
      expect(deps.playSound).not.toHaveBeenCalled()
    })
  })

  // ── statusToSoundEvent mapping ───────────────────────────────────────────

  describe('statusToSoundEvent', () => {
    it('returns user_approval for awaiting_approval status', () => {
      expect(statusToSoundEvent('awaiting_approval')).toBe('user_approval')
    })

    it('returns user_approval for locked status (user input needed)', () => {
      expect(statusToSoundEvent('locked')).toBe('user_approval')
    })

    it('returns null for completed status (handled via agentExit)', () => {
      expect(statusToSoundEvent('completed')).toBeNull()
    })

    it('returns null for error status', () => {
      expect(statusToSoundEvent('error')).toBeNull()
    })

    it('returns null for spawning status', () => {
      expect(statusToSoundEvent('spawning')).toBeNull()
    })

    it('returns null for busy status', () => {
      expect(statusToSoundEvent('busy')).toBeNull()
    })

    it('returns null for paused status', () => {
      expect(statusToSoundEvent('paused')).toBeNull()
    })

    it('returns null for interrupted status', () => {
      expect(statusToSoundEvent('interrupted')).toBeNull()
    })

    it('returns null for idle status', () => {
      expect(statusToSoundEvent('idle')).toBeNull()
    })

    it('returns null for tray_running status', () => {
      expect(statusToSoundEvent('tray_running')).toBeNull()
    })

    it('awaiting_approval and locked both return a non-null sound event', () => {
      const mappedStatuses: AgentLifecycleStatus[] = ['awaiting_approval', 'locked']
      for (const status of mappedStatuses) {
        expect(statusToSoundEvent(status)).not.toBeNull()
      }
    })
  })

  // ── master volume scaling ─────────────────────────────────────────────────

  describe('master volume scaling', () => {
    it('calls getMasterVolume when sound plays', () => {
      const getMasterVolume = vi.fn().mockReturnValue(1.0)
      deps = createDeps({ getMasterVolume })
      playAgentSound('agent_completed', deps)
      expect(getMasterVolume).toHaveBeenCalled()
    })

    it('scales playback volume by master volume (0.5 master × 0.8 base = 0.4)', () => {
      deps = createDeps({ getMasterVolume: vi.fn().mockReturnValue(0.5) })
      playAgentSound('agent_completed', deps)
      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.4)
    })

    it('master volume 0.0 results in 0 volume passed to playSound', () => {
      deps = createDeps({ getMasterVolume: vi.fn().mockReturnValue(0.0) })
      playAgentSound('agent_spawned', deps)
      expect(deps.playSound).toHaveBeenCalledWith(expect.any(String), 0.0)
    })

    it('does NOT call getMasterVolume when sound is disabled', () => {
      const getMasterVolume = vi.fn().mockReturnValue(1.0)
      deps = createDeps({ isSoundEnabled: vi.fn().mockReturnValue(false), getMasterVolume })
      playAgentSound('agent_completed', deps)
      expect(getMasterVolume).not.toHaveBeenCalled()
    })
  })

  // ── playAgentSound: calls playSound exactly once per invocation ──────────

  describe('playSound call count', () => {
    it('calls playSound exactly once per invocation', () => {
      playAgentSound('agent_completed', deps)
      expect(deps.playSound).toHaveBeenCalledOnce()
    })

    it('calls isSoundEnabled exactly once per invocation', () => {
      playAgentSound('agent_completed', deps)
      expect(deps.isSoundEnabled).toHaveBeenCalledOnce()
    })
  })
})
