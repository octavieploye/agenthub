import { useEffect } from 'react'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useAgentStore } from '@renderer/stores/agent-store'

/**
 * Subscribes to the agentRateLimited IPC event and shows an actionable toast
 * with "Switch to Codex" / "Dismiss" buttons. Mounts once in App.tsx.
 */
export function RateLimitPrompt(): null {
  useEffect(() => {
    const unsub = window.agentHub.on.agentRateLimited(
      (agentId, detail) => {
        const agent = useAgentStore.getState().agents.get(agentId)
        const agentName = agent?.name ?? agentId.slice(0, 8)
        const toastId = `rate-limit-${agentId}-${Date.now()}`

        const { addToast, dismissToast } = useNotificationStore.getState()

        if (detail.codexAvailable) {
          addToast({
            id: toastId,
            severity: 'warning',
            title: 'Rate limit hit',
            message: `${agentName} was rate-limited on ${detail.provider}. Codex CLI is available as a fallback.`,
            agentId,
            agentName,
            createdAt: Date.now(),
            actions: [
              {
                label: 'Switch to Codex',
                onClick: () => {
                  dismissToast(toastId)
                  window.agentHub.agents
                    .fallbackRespawn(agentId, 'openai-codex')
                    .catch((err: unknown) =>
                      console.error('Fallback respawn failed:', err)
                    )
                }
              },
              {
                label: 'Dismiss',
                onClick: () => dismissToast(toastId)
              }
            ]
          })
        } else {
          addToast({
            id: toastId,
            severity: 'error',
            title: 'Rate limit hit',
            message: `${agentName} was rate-limited on ${detail.provider}. No fallback providers available.`,
            agentId,
            agentName,
            createdAt: Date.now()
          })
        }
      }
    )

    return unsub
  }, [])

  return null
}
