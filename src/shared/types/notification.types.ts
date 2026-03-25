import type { TriageEvent } from './triage.types'

export type ToastSeverity = 'info' | 'warning' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastNotification {
  id: string
  severity: ToastSeverity
  title: string
  message: string
  agentId?: string
  agentName?: string
  actions?: ToastAction[]
  createdAt: number
}

export type AgentSoundEvent =
  | 'agent_completed'
  | 'agent_locked'
  | 'code_blue'
  | 'mission_complete'
  | 'user_approval'

export interface DesktopNotificationPayload {
  agentId: string
  agentName: string
  repoName: string
  taskDescription: string
  status: 'locked' | 'completed'
  question?: string
}

// ─── Notification Router Types (Story 5.5) ──────────────────────────────────

export type NotificationLayer = 'toast' | 'desktop' | 'sound' | 'voice' | 'telegram'

export interface NotificationRouterConfig {
  desktopEnabled: boolean
  soundEnabled: boolean
  voiceEnabled: boolean
  telegramEnabled: boolean
}

export interface RoutingResult {
  layers: NotificationLayer[]
  triageEvent: TriageEvent
}
