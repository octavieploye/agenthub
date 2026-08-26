import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldScrape, QuotaScrapeScheduler } from './quota-scrape-scheduler'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

describe('Quota Scrape Scheduler', () => {
  describe('shouldScrape', () => {
    it('returns true when no last scrape (first run)', () => {
      expect(shouldScrape(null, Date.now())).toBe(true)
    })

    it('returns true when last scrape > 15 days ago', () => {
      const now = Date.now()
      const sixteenDaysAgo = new Date(now - 16 * 24 * 60 * 60 * 1000).toISOString()
      expect(shouldScrape(sixteenDaysAgo, now)).toBe(true)
    })

    it('returns false when last scrape 3 days ago', () => {
      const now = Date.now()
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
      expect(shouldScrape(threeDaysAgo, now)).toBe(false)
    })

    it('returns false when last scrape today', () => {
      const now = Date.now()
      const justNow = new Date(now - 1000).toISOString()
      expect(shouldScrape(justNow, now)).toBe(false)
    })

    it('returns true when last scrape exactly 15 days ago', () => {
      const now = Date.now()
      const fifteenDays = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString()
      expect(shouldScrape(fifteenDays, now)).toBe(true)
    })

    it('returns true for invalid date string', () => {
      expect(shouldScrape('not-a-date', Date.now())).toBe(true)
    })
  })

  describe('QuotaScrapeScheduler', () => {
    let mockSettings: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }
    let mockScrape: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockSettings = {
        get: vi.fn().mockReturnValue(null),
        set: vi.fn()
      }
      mockScrape = vi.fn().mockResolvedValue(undefined)
    })

    it('can be constructed', () => {
      const scheduler = new QuotaScrapeScheduler(mockSettings, mockScrape)
      expect(scheduler).toBeDefined()
    })

    it('checkAndScrape triggers scrape when shouldScrape returns true', async () => {
      mockSettings.get.mockReturnValue(null) // no last scrape
      const scheduler = new QuotaScrapeScheduler(mockSettings, mockScrape)
      await scheduler.checkAndScrape()
      expect(mockScrape).toHaveBeenCalledTimes(1)
    })

    it('checkAndScrape does not trigger when recently scraped', async () => {
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      mockSettings.get.mockReturnValue(recentDate)
      const scheduler = new QuotaScrapeScheduler(mockSettings, mockScrape)
      await scheduler.checkAndScrape()
      expect(mockScrape).not.toHaveBeenCalled()
    })

    it('checkAndScrape persists timestamp on success', async () => {
      mockSettings.get.mockReturnValue(null)
      const scheduler = new QuotaScrapeScheduler(mockSettings, mockScrape)
      await scheduler.checkAndScrape()
      expect(mockSettings.set).toHaveBeenCalledWith(
        'quota_last_scrape',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      )
    })

    it('checkAndScrape does not persist timestamp on scrape failure', async () => {
      mockSettings.get.mockReturnValue(null)
      mockScrape.mockRejectedValue(new Error('scrape failed'))
      const scheduler = new QuotaScrapeScheduler(mockSettings, mockScrape)
      await scheduler.checkAndScrape()
      expect(mockSettings.set).not.toHaveBeenCalled()
    })

    it('start sets an interval and defers first check', () => {
      vi.useFakeTimers()
      const scheduler = new QuotaScrapeScheduler(mockSettings, mockScrape)
      scheduler.start()
      // Should not trigger immediately (60s defer)
      expect(mockScrape).not.toHaveBeenCalled()
      vi.useRealTimers()
      scheduler.stop()
    })

    it('stop clears timers', () => {
      vi.useFakeTimers()
      const scheduler = new QuotaScrapeScheduler(mockSettings, mockScrape)
      scheduler.start()
      scheduler.stop()
      // Advance past defer — should not trigger
      vi.advanceTimersByTime(120000)
      expect(mockScrape).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })
})
