import { useEffect } from 'react'
import { useAgentStore } from '../stores/agent-store'
import { useProjectStore } from '../stores/project-store'
import type { AgentLifecycleStatus, StatusConfidence } from '@shared/types/agent.types'

export function useKanbanHydration() {
  const hydrateAgents = useAgentStore((s) => s.hydrateAgents)
  const updateStatus = useAgentStore((s) => s.updateStatus)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)

  useEffect(() => {
    window.agentHub.agents.list().then((response) => {
      if (response.success) hydrateAgents(response.data)
    })

    fetchProjects()

    const unsub = window.agentHub.on.agentStatusChange((agentId: string, status: AgentLifecycleStatus, confidence: StatusConfidence) => {
      updateStatus(agentId, status, confidence)
    })

    return () => unsub()
  }, [hydrateAgents, updateStatus, fetchProjects])
}
