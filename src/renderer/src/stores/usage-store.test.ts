import { describe, it, expect, beforeEach } from 'vitest'
import { useUsageStore } from './usage-store'

const DEFAULT_STATE = {
  plan: 'pro' as const,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheCreationTokens: 0,
  totalCacheReadTokens: 0,
  totalMessages: 0,
  burnRate: 0,
  lastUpdated: null,
  resetDate: null,
  quotaPercent: 0
}

describe('useUsageStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useUsageStore.setState(DEFAULT_STATE)
  })

  describe('defaults', () => {
    it('plan defaults to pro', () => {
      const { plan } = useUsageStore.getState()
      expect(plan).toBe('pro')
    })

    it('totalInputTokens defaults to 0', () => {
      const { totalInputTokens } = useUsageStore.getState()
      expect(totalInputTokens).toBe(0)
    })

    it('totalOutputTokens defaults to 0', () => {
      const { totalOutputTokens } = useUsageStore.getState()
      expect(totalOutputTokens).toBe(0)
    })

    it('totalCacheCreationTokens defaults to 0', () => {
      const { totalCacheCreationTokens } = useUsageStore.getState()
      expect(totalCacheCreationTokens).toBe(0)
    })

    it('totalCacheReadTokens defaults to 0', () => {
      const { totalCacheReadTokens } = useUsageStore.getState()
      expect(totalCacheReadTokens).toBe(0)
    })

    it('totalMessages defaults to 0', () => {
      const { totalMessages } = useUsageStore.getState()
      expect(totalMessages).toBe(0)
    })

    it('burnRate defaults to 0', () => {
      const { burnRate } = useUsageStore.getState()
      expect(burnRate).toBe(0)
    })

    it('lastUpdated defaults to null', () => {
      const { lastUpdated } = useUsageStore.getState()
      expect(lastUpdated).toBeNull()
    })

    it('resetDate defaults to null', () => {
      const { resetDate } = useUsageStore.getState()
      expect(resetDate).toBeNull()
    })

    it('quotaPercent defaults to 0', () => {
      const { quotaPercent } = useUsageStore.getState()
      expect(quotaPercent).toBe(0)
    })
  })

  describe('updateUsage', () => {
    it('updates totalMessages', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 50 })
      expect(useUsageStore.getState().totalMessages).toBe(50)
    })

    it('updates totalInputTokens and totalOutputTokens', () => {
      useUsageStore.getState().updateUsage({
        totalInputTokens: 5000,
        totalOutputTokens: 3000
      })
      const state = useUsageStore.getState()
      expect(state.totalInputTokens).toBe(5000)
      expect(state.totalOutputTokens).toBe(3000)
    })

    it('updates burnRate', () => {
      useUsageStore.getState().updateUsage({ burnRate: 12.5 })
      expect(useUsageStore.getState().burnRate).toBe(12.5)
    })

    it('updates lastUpdated', () => {
      const timestamp = '2026-03-06T14:30:00Z'
      useUsageStore.getState().updateUsage({ lastUpdated: timestamp })
      expect(useUsageStore.getState().lastUpdated).toBe(timestamp)
    })

    it('partial update preserves other fields', () => {
      useUsageStore.getState().updateUsage({
        totalInputTokens: 8000,
        totalOutputTokens: 4000,
        totalMessages: 75
      })
      useUsageStore.getState().updateUsage({ burnRate: 5.2 })

      const state = useUsageStore.getState()
      expect(state.totalInputTokens).toBe(8000)
      expect(state.totalOutputTokens).toBe(4000)
      expect(state.totalMessages).toBe(75)
      expect(state.burnRate).toBe(5.2)
    })

    it('recalculates quotaPercent when totalMessages changes (pro plan: 100/250 = 40%)', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 100 })
      expect(useUsageStore.getState().quotaPercent).toBe(40)
    })

    it('recalculates quotaPercent when plan changes (max5: 100/1000 = 10%)', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 100 })
      useUsageStore.getState().setPlan('max5')
      expect(useUsageStore.getState().quotaPercent).toBe(10)
    })
  })

  describe('setPlan', () => {
    it('changes plan to max5', () => {
      useUsageStore.getState().setPlan('max5')
      expect(useUsageStore.getState().plan).toBe('max5')
    })

    it('changes plan to max20', () => {
      useUsageStore.getState().setPlan('max20')
      expect(useUsageStore.getState().plan).toBe('max20')
    })

    it('changes plan to custom', () => {
      useUsageStore.getState().setPlan('custom')
      expect(useUsageStore.getState().plan).toBe('custom')
    })

    it('recalculates quotaPercent on plan change', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 200 })
      // pro: 200/250 = 80%
      expect(useUsageStore.getState().quotaPercent).toBe(80)

      useUsageStore.getState().setPlan('max5')
      // max5: 200/1000 = 20%
      expect(useUsageStore.getState().quotaPercent).toBe(20)

      useUsageStore.getState().setPlan('max20')
      // max20: 200/2000 = 10%
      expect(useUsageStore.getState().quotaPercent).toBe(10)
    })
  })

  describe('resetUsage', () => {
    it('resets all token counts to 0', () => {
      useUsageStore.getState().updateUsage({
        totalInputTokens: 10000,
        totalOutputTokens: 8000,
        totalCacheCreationTokens: 500,
        totalCacheReadTokens: 300
      })
      useUsageStore.getState().resetUsage()

      const state = useUsageStore.getState()
      expect(state.totalInputTokens).toBe(0)
      expect(state.totalOutputTokens).toBe(0)
      expect(state.totalCacheCreationTokens).toBe(0)
      expect(state.totalCacheReadTokens).toBe(0)
    })

    it('resets totalMessages to 0', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 150 })
      useUsageStore.getState().resetUsage()
      expect(useUsageStore.getState().totalMessages).toBe(0)
    })

    it('resets burnRate to 0', () => {
      useUsageStore.getState().updateUsage({ burnRate: 7.3 })
      useUsageStore.getState().resetUsage()
      expect(useUsageStore.getState().burnRate).toBe(0)
    })

    it('preserves plan after reset', () => {
      useUsageStore.getState().setPlan('max20')
      useUsageStore.getState().updateUsage({ totalMessages: 500 })
      useUsageStore.getState().resetUsage()
      expect(useUsageStore.getState().plan).toBe('max20')
    })

    it('sets quotaPercent to 0', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 100 })
      expect(useUsageStore.getState().quotaPercent).toBe(40) // 100/250
      useUsageStore.getState().resetUsage()
      expect(useUsageStore.getState().quotaPercent).toBe(0)
    })
  })

  describe('quotaPercent computation', () => {
    it('calculates correctly for pro plan (250 msg limit)', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 125 })
      expect(useUsageStore.getState().quotaPercent).toBe(50) // 125/250 = 50%
    })

    it('calculates correctly for max5 plan (1000 msg limit)', () => {
      useUsageStore.getState().setPlan('max5')
      useUsageStore.getState().updateUsage({ totalMessages: 500 })
      expect(useUsageStore.getState().quotaPercent).toBe(50) // 500/1000 = 50%
    })

    it('calculates correctly for max20 plan (2000 msg limit)', () => {
      useUsageStore.getState().setPlan('max20')
      useUsageStore.getState().updateUsage({ totalMessages: 1000 })
      expect(useUsageStore.getState().quotaPercent).toBe(50) // 1000/2000 = 50%
    })

    it('caps at 100 when messages exceed limit', () => {
      useUsageStore.getState().updateUsage({ totalMessages: 300 })
      // pro: 300/250 = 120%, capped at 100
      expect(useUsageStore.getState().quotaPercent).toBe(100)
    })

    it('returns 0 for custom plan (no defined limit)', () => {
      useUsageStore.getState().setPlan('custom')
      useUsageStore.getState().updateUsage({ totalMessages: 500 })
      expect(useUsageStore.getState().quotaPercent).toBe(0)
    })
  })
})
