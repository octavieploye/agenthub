import { create } from 'zustand'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'
import type { ViewMode } from '@shared/types/recovery.types'

export type { ViewMode }

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
  soundEnabled: true,

  setViewMode: (mode) => set({ viewMode: mode }),
  setFocusedAgent: (id) => set({ focusedAgentId: id }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled }))
}))
