import { Howl } from 'howler'
import type { AgentSoundEvent } from '@shared/types/notification.types'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

export interface SoundAlertDeps {
  playSound: (src: string, volume: number) => void
  isSoundEnabled: () => boolean
  getMasterVolume: () => number
}

export const SOUND_MAP: Record<AgentSoundEvent, { src: string; volume: number }> = {
  agent_spawned: { src: 'sounds/state-change.mp3', volume: 0.5 },
  agent_completed: { src: 'sounds/alert-yellow.wav', volume: 0.8 },
  code_blue: { src: 'sounds/code-blue.mp3', volume: 1.0 },
  mission_complete: { src: 'sounds/mission-complete.wav', volume: 0.6 },
  user_approval: { src: 'sounds/user-approval.mp3', volume: 0.7 }
}

export function statusToSoundEvent(status: AgentLifecycleStatus): AgentSoundEvent | null {
  const map: Partial<Record<AgentLifecycleStatus, AgentSoundEvent>> = {
    awaiting_approval: 'user_approval',
  }
  return map[status] ?? null
}

export function playAgentSound(event: AgentSoundEvent, deps: SoundAlertDeps): boolean {
  if (!deps.isSoundEnabled()) {
    return false
  }

  const { src, volume } = SOUND_MAP[event]
  deps.playSound(src, volume * deps.getMasterVolume())
  return true
}

// ── Howler.js-based concrete implementation ────────────────────────────────

const howlCache = new Map<string, Howl>()

function getOrCreateHowl(src: string, volume: number): Howl {
  const cached = howlCache.get(src)
  if (cached) {
    cached.volume(volume)
    return cached
  }
  const howl = new Howl({ src: [src], volume, preload: true })
  howl.on('loaderror', (_id: number, err: unknown) => {
    console.error(`[sound-alert] Failed to load ${src}:`, err)
  })
  howl.on('playerror', (_id: number, err: unknown) => {
    console.error(`[sound-alert] Failed to play ${src}:`, err)
  })
  howlCache.set(src, howl)
  return howl
}

export function playSoundHowler(src: string, volume: number): void {
  const howl = getOrCreateHowl(src, volume)
  howl.play()
}

export function createSoundAlertDeps(
  isSoundEnabled: () => boolean,
  getMasterVolume: () => number
): SoundAlertDeps {
  return {
    playSound: playSoundHowler,
    isSoundEnabled,
    getMasterVolume
  }
}
