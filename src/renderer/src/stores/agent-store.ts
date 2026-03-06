import { create } from 'zustand'
import type { AgentState, AgentLifecycleStatus, StatusConfidence } from '@shared/types/agent.types'

interface AgentStore {
  agents: Map<string, AgentState>
  activeAgentId: string | null
  setActiveAgent: (id: string | null) => void
  addAgent: (agent: AgentState) => void
  removeAgent: (id: string) => void
  updateStatus: (id: string, status: AgentLifecycleStatus, confidence: StatusConfidence) => void
  hydrateAgents: (agents: AgentState[]) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: new Map(),
  activeAgentId: null,

  setActiveAgent: (id) => set({ activeAgentId: id }),

  addAgent: (agent) =>
    set((state) => {
      const next = new Map(state.agents)
      next.set(agent.id, agent)
      return { agents: next, activeAgentId: agent.id }
    }),

  removeAgent: (id) =>
    set((state) => {
      const next = new Map(state.agents)
      next.delete(id)
      const activeAgentId = state.activeAgentId === id ? null : state.activeAgentId
      return { agents: next, activeAgentId }
    }),

  updateStatus: (id, status, confidence) =>
    set((state) => {
      const agent = state.agents.get(id)
      if (!agent) return state
      const next = new Map(state.agents)
      next.set(id, { ...agent, status, confidence, updatedAt: new Date().toISOString() })
      return { agents: next }
    }),

  hydrateAgents: (agents) =>
    set(() => {
      const map = new Map<string, AgentState>()
      for (const agent of agents) {
        map.set(agent.id, agent)
      }
      return { agents: map }
    })
}))
