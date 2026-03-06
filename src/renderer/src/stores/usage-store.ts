import { create } from 'zustand'
import type { SubscriptionPlan } from '@shared/types/usage.types'
import { PLAN_LIMITS } from '@shared/constants/plan-limits'

function computeQuotaPercent(plan: SubscriptionPlan, totalMessages: number): number {
  const limits = PLAN_LIMITS[plan]
  if (!limits) return 0
  const percent = Math.round((totalMessages / limits.messageLimit) * 100)
  return Math.min(percent, 100)
}

interface UsageStoreData {
  plan: SubscriptionPlan
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  totalMessages: number
  burnRate: number
  lastUpdated: string | null
  resetDate: string | null
  quotaPercent: number
}

interface UsageStoreActions {
  updateUsage: (data: Partial<Omit<UsageStoreData, 'quotaPercent'>>) => void
  resetUsage: () => void
  setPlan: (plan: SubscriptionPlan) => void
  fetchUsage: () => Promise<void>
}

type UsageStore = UsageStoreData & UsageStoreActions

export const useUsageStore = create<UsageStore>((set) => ({
  plan: 'pro',
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheCreationTokens: 0,
  totalCacheReadTokens: 0,
  totalMessages: 0,
  burnRate: 0,
  lastUpdated: null,
  resetDate: null,
  quotaPercent: 0,

  updateUsage: (data) =>
    set((state) => {
      const next = { ...state, ...data }
      return {
        ...data,
        quotaPercent: computeQuotaPercent(next.plan, next.totalMessages)
      }
    }),

  resetUsage: () =>
    set((state) => ({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalMessages: 0,
      burnRate: 0,
      quotaPercent: computeQuotaPercent(state.plan, 0)
    })),

  setPlan: (plan) =>
    set((state) => ({
      plan,
      quotaPercent: computeQuotaPercent(plan, state.totalMessages)
    })),

  fetchUsage: async () => {
    try {
      const response = await window.agentHub.usage.getSnapshot()
      if (response.success && response.data) {
        const d = response.data as Record<string, unknown>
        set((state) => {
          const totalMessages = (d.totalMessages as number) ?? state.totalMessages
          const plan = (d.plan as SubscriptionPlan) ?? state.plan
          return {
            plan,
            totalInputTokens: (d.totalInputTokens as number) ?? state.totalInputTokens,
            totalOutputTokens: (d.totalOutputTokens as number) ?? state.totalOutputTokens,
            totalCacheCreationTokens:
              (d.totalCacheCreationTokens as number) ?? state.totalCacheCreationTokens,
            totalCacheReadTokens: (d.totalCacheReadTokens as number) ?? state.totalCacheReadTokens,
            totalMessages,
            burnRate: (d.burnRate as number) ?? state.burnRate,
            lastUpdated: (d.lastUpdated as string) ?? state.lastUpdated,
            resetDate: (d.resetDate as string) ?? state.resetDate,
            quotaPercent: computeQuotaPercent(plan, totalMessages)
          }
        })
      }
    } catch {
      // non-critical — usage display stays stale
    }
  }
}))
