import { create } from 'zustand'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'
import type { ViewMode } from '@shared/types/recovery.types'

export type { ViewMode }

const SOUND_KEY = 'agenthub:soundEnabled'

function loadSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

interface ViewStore {
  viewMode: ViewMode
  focusedAgentId: string | null
  statusFilter: AgentLifecycleStatus | null
  soundEnabled: boolean
  setViewMode: (mode: ViewMode) => void
  setFocusedAgent: (id: string | null) => void
  setStatusFilter: (status: AgentLifecycleStatus | null) => void
  toggleSound: () => void
}

export const useViewStore = create<ViewStore>((set) => ({
  viewMode: 'raid',
  focusedAgentId: null,
  statusFilter: null,
  soundEnabled: loadSoundEnabled(),

  setViewMode: (mode) => set({ viewMode: mode }),
  setFocusedAgent: (id) => set({ focusedAgentId: id }),
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
    })
}))
