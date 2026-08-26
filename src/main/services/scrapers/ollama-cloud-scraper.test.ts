import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseOllamaQuota,
  scrapeOllamaCloud,
  clearCache,
  isCacheValid,
  getCachedData
} from './ollama-cloud-scraper'
import type { BrowserClient } from './scraper-types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

function createMockBrowser(overrides: Partial<BrowserClient> = {}): BrowserClient {
  return {
    navigate: vi.fn().mockResolvedValue(true),
    evaluate: vi.fn().mockResolvedValue(null),
    ...overrides
  }
}

beforeEach(() => {
  clearCache()
})

describe('Ollama Cloud Scraper', () => {
  describe('parseOllamaQuota', () => {
    it('parses numeric values', () => {
      const result = parseOllamaQuota({ used: 50, limit: 200 })
      expect(result).not.toBeNull()
      expect(result!.used).toBe(50)
      expect(result!.limit).toBe(200)
      expect(result!.percent).toBe(25)
    })

    it('returns null for null input', () => {
      expect(parseOllamaQuota(null)).toBeNull()
    })

    it('returns null for missing fields', () => {
      expect(parseOllamaQuota({ used: 10 })).toBeNull()
    })
  })

  describe('cooldown cache', () => {
    it('first call scrapes (not from cache)', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ used: 100, limit: 500 })
      })
      const result = await scrapeOllamaCloud(browser, 1000000)
      expect(result.fromCache).toBe(false)
      expect(result.data).not.toBeNull()
      expect(result.data!.used).toBe(100)
    })

    it('second call within 24h returns cached data', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ used: 100, limit: 500 })
      })
      const baseTime = 1000000
      await scrapeOllamaCloud(browser, baseTime)

      // Second call 1 hour later — should use cache
      const result = await scrapeOllamaCloud(browser, baseTime + 3600000)
      expect(result.fromCache).toBe(true)
      expect(result.data!.used).toBe(100)
      // navigate should only have been called once
      expect(browser.navigate).toHaveBeenCalledTimes(1)
    })

    it('call after 24h scrapes fresh', async () => {
      const evaluate = vi.fn().mockResolvedValue({ used: 100, limit: 500 })
      const browser = createMockBrowser({ evaluate })
      const baseTime = 1000000
      await scrapeOllamaCloud(browser, baseTime)

      // 25 hours later — past cooldown
      const laterTime = baseTime + 25 * 60 * 60 * 1000
      evaluate.mockResolvedValue({ used: 150, limit: 500 })
      const result = await scrapeOllamaCloud(browser, laterTime)
      expect(result.fromCache).toBe(false)
      expect(result.data!.used).toBe(150)
      expect(browser.navigate).toHaveBeenCalledTimes(2)
    })

    it('isCacheValid returns false when no cache', () => {
      expect(isCacheValid()).toBe(false)
    })

    it('clearCache resets the cache', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ used: 10, limit: 100 })
      })
      await scrapeOllamaCloud(browser, 1000000)
      expect(getCachedData()).not.toBeNull()
      clearCache()
      expect(getCachedData()).toBeNull()
    })
  })

  describe('error handling', () => {
    it('returns error when navigation fails', async () => {
      const browser = createMockBrowser({
        navigate: vi.fn().mockResolvedValue(false)
      })
      const result = await scrapeOllamaCloud(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Navigation failed')
    })

    it('returns error when auth required', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ authRequired: true })
      })
      const result = await scrapeOllamaCloud(browser)
      expect(result.error).toBe('Auth required')
    })

    it('returns error when parse fails', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue(null)
      })
      const result = await scrapeOllamaCloud(browser)
      expect(result.error).toBe('Parse failed')
    })
  })
})
