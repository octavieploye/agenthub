import type { DesktopNotificationPayload } from '@shared/types/notification.types'

export interface DesktopNotificationDeps {
  createNotification: (options: { title: string; body: string }) => {
    on: (event: string, cb: () => void) => void
    show: () => void
  }
  isSupported: () => boolean
  focusWindow: () => void
  focusAgent: (agentId: string) => void
}

function formatNotification(payload: DesktopNotificationPayload): {
  title: string
  body: string
} {
  if (payload.status === 'locked') {
    return {
      title: 'Agent Needs Input',
      body: `${payload.agentName} (${payload.repoName}): ${payload.question ?? payload.taskDescription}`
    }
  }
  return {
    title: 'Agent Completed',
    body: `${payload.agentName} (${payload.repoName}): ${payload.taskDescription}`
  }
}

export function sendDesktopNotification(
  payload: DesktopNotificationPayload,
  deps: DesktopNotificationDeps
): boolean {
  if (!deps.isSupported()) {
    return false
  }

  const { title, body } = formatNotification(payload)
  const notification = deps.createNotification({ title, body })

  notification.on('click', () => {
    deps.focusWindow()
    deps.focusAgent(payload.agentId)
  })

  notification.show()
  return true
}
