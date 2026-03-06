import type { PlanLimits } from '@shared/types/usage.types'

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  pro: {
    name: 'pro',
    label: 'Pro',
    tokenLimit: 19000,
    messageLimit: 250
  },
  max5: {
    name: 'max5',
    label: 'Max 5x',
    tokenLimit: 88000,
    messageLimit: 1000
  },
  max20: {
    name: 'max20',
    label: 'Max 20x',
    tokenLimit: 220000,
    messageLimit: 2000
  }
} as const

export const DEFAULT_PLAN: PlanLimits = PLAN_LIMITS.pro

export const USAGE_REFRESH_INTERVAL_MS = 30000
export const BURN_RATE_WINDOW_MINUTES = 60
