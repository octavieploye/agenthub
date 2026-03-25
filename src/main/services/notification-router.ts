import type { TriageEvent, TriageLevel } from '@shared/types/triage.types'
import type {
  NotificationLayer,
  NotificationRouterConfig,
  RoutingResult
} from '@shared/types/notification.types'
import { TRIAGE_LEVEL_ORDER } from './auto-triage'

export const DEFAULT_CONFIG: NotificationRouterConfig = {
  desktopEnabled: true,
  soundEnabled: true,
  voiceEnabled: false,
  telegramEnabled: false
}

const LAYER_RULES: {
  layer: NotificationLayer
  minLevel: TriageLevel
  configKey: keyof NotificationRouterConfig | null
}[] = [
  { layer: 'toast', minLevel: 'low', configKey: null },
  { layer: 'desktop', minLevel: 'medium', configKey: 'desktopEnabled' },
  { layer: 'voice', minLevel: 'critical', configKey: 'voiceEnabled' },
  { layer: 'telegram', minLevel: 'critical', configKey: 'telegramEnabled' }
]

export function routeNotification(
  event: TriageEvent,
  config: NotificationRouterConfig
): RoutingResult {
  const eventOrder = TRIAGE_LEVEL_ORDER[event.triageLevel]

  const layers: NotificationLayer[] = LAYER_RULES.filter((rule) => {
    if (eventOrder < TRIAGE_LEVEL_ORDER[rule.minLevel]) return false
    if (rule.configKey !== null && !config[rule.configKey]) return false
    return true
  }).map((rule) => rule.layer)

  if (config.soundEnabled && (event.requiresUserAction || event.isTaskCompleted)) {
    layers.push('sound')
  }

  return { layers, triageEvent: event }
}
