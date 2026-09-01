import { useEffect } from 'react'
import { useAgentStore } from '../stores/agent-store'

export function useAgentHydration() {
  const hydrateAgents = useAgentStore((s) => s.hydrateAgents)

  useEffect(() => {
    window.agentHub.agents.list().then((response) => {
      if (response.success) hydrateAgents(response.data)
    })
  }, [hydrateAgents])
}
