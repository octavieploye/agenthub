import { create } from 'zustand'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'
import type { ViewMode } from '@shared/types/recovery.types'

export type { ViewMode }

const SOUND_KEY = 'agenthub:soundEnabled'
const VOICE_KEY = 'agenthub:voiceEnabled'
const TTS_VOLUME_KEY = 'agenthub:ttsVolume'
const TTS_RATE_KEY = 'agenthub:ttsRate'
const TTS_VOICE_ID_KEY = 'agenthub:piperVoiceId'

function loadSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

function loadVoiceEnabled(): boolean {
  try {
    const stored = localStorage.getItem(VOICE_KEY)
    return stored === null ? false : stored === 'true'
  } catch {
    return false
  }
}

function loadTtsVolume(): number {
  try {
    const stored = localStorage.getItem(TTS_VOLUME_KEY)
    if (stored === null) return 0.7
    const parsed = parseFloat(stored)
    return isNaN(parsed) ? 0.7 : Math.min(1, Math.max(0, parsed))
  } catch {
    return 0.7
  }
}

function loadTtsRate(): number {
  try {
    const stored = localStorage.getItem(TTS_RATE_KEY)
    if (stored === null) return 1.0
    const parsed = parseFloat(stored)
    return isNaN(parsed) ? 1.0 : Math.min(2, Math.max(0.5, parsed))
  } catch {
    return 1.0
  }
}

function loadPiperVoiceId(): string {
  try {
    return localStorage.getItem(TTS_VOICE_ID_KEY) ?? ''
  } catch {
    return ''
  }
}

interface ViewStore {
  viewMode: ViewMode
  focusedAgentId: string | null
  selectedRepoId: string | null
  statusFilter: AgentLifecycleStatus | null
  soundEnabled: boolean
  voiceEnabled: boolean
  ttsVolume: number
  ttsRate: number
  piperVoiceId: string
  expandedRepoFileTree: string | null
  setViewMode: (mode: ViewMode) => void
  setFocusedAgent: (id: string | null) => void
  setSelectedRepoId: (id: string | null) => void
  setStatusFilter: (status: AgentLifecycleStatus | null) => void
  toggleSound: () => void
  toggleVoice: () => void
  setTtsVolume: (volume: number) => void
  setTtsRate: (rate: number) => void
  setPiperVoiceId: (id: string) => void
  setExpandedRepoFileTree: (repoId: string | null) => void
}

export const useViewStore = create<ViewStore>((set) => ({
  viewMode: 'raid',
  focusedAgentId: null,
  selectedRepoId: null,
  statusFilter: null,
  soundEnabled: loadSoundEnabled(),
  voiceEnabled: loadVoiceEnabled(),
  ttsVolume: loadTtsVolume(),
  ttsRate: loadTtsRate(),
  piperVoiceId: loadPiperVoiceId(),
  expandedRepoFileTree: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setFocusedAgent: (id) => set({ focusedAgentId: id }),
  setSelectedRepoId: (id) => set({ selectedRepoId: id }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  toggleSound: () =>
    set((state) => {
      const next = !state.soundEnabled
      try {
        localStorage.setItem(SOUND_KEY, String(next))
      } catch {
        // ignore
      }
      return { soundEnabled: next }
    }),
  toggleVoice: () =>
    set((state) => {
      const next = !state.voiceEnabled
      try {
        localStorage.setItem(VOICE_KEY, String(next))
      } catch {
        // ignore
      }
      return { voiceEnabled: next }
    }),
  setExpandedRepoFileTree: (repoId) => set({ expandedRepoFileTree: repoId }),
  setTtsVolume: (volume) =>
    set(() => {
      const clamped = Math.min(1, Math.max(0, volume))
      try {
        localStorage.setItem(TTS_VOLUME_KEY, String(clamped))
      } catch {
        // ignore
      }
      return { ttsVolume: clamped }
    }),
  setTtsRate: (rate) =>
    set(() => {
      const clamped = Math.min(2, Math.max(0.5, rate))
      try {
        localStorage.setItem(TTS_RATE_KEY, String(clamped))
      } catch {
        // ignore
      }
      return { ttsRate: clamped }
    }),
  setPiperVoiceId: (id) =>
    set(() => {
      try {
        localStorage.setItem(TTS_VOICE_ID_KEY, id)
      } catch {
        // ignore
      }
      return { piperVoiceId: id }
    })
}))
