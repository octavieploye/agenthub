import { describe, it, expect, vi } from 'vitest'
import { parseCodexQuota, scrapeCodexDashboard } from './codex-dashboard-scraper'
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

describe('Codex Dashboard Scraper', () => {
  describe('parseCodexQuota', () => {
    it('parses numeric used and limit', () => {
      const result = parseCodexQuota({ used: 500, limit: 1000 })
      expect(result).not.toBeNull()
      expect(result!.used).toBe(500)
      expect(result!.limit).toBe(1000)
      expect(result!.percent).toBe(50)
    })

    it('parses string used and limit', () => {
      const result = parseCodexQuota({ used: '200', limit: '500' })
      expect(result!.used).toBe(200)
      expect(result!.limit).toBe(500)
    })

    it('returns null for null input', () => {
      expect(parseCodexQuota(null)).toBeNull()
    })

    it('returns null when limit is 0', () => {
      expect(parseCodexQuota({ used: 10, limit: 0 })).toBeNull()
    })

    it('returns null when fields are missing', () => {
      expect(parseCodexQuota({ used: 10 })).toBeNull()
    })

    it('parses valid reset date', () => {
      const result = parseCodexQuota({ used: 10, limit: 100, resetText: '2026-10-01T00:00:00Z' })
      expect(result!.resetDate).toBe('2026-10-01T00:00:00.000Z')
    })

    it('sets scrapedAt', () => {
      const result = parseCodexQuota({ used: 10, limit: 100 })
      expect(result!.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('scrapeCodexDashboard', () => {
    it('returns data when browser returns valid quota', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ used: 300, limit: 1000 })
      })
      const result = await scrapeCodexDashboard(browser)
      expect(result.data).not.toBeNull()
      expect(result.data!.used).toBe(300)
      expect(result.error).toBeNull()
    })

    it('returns error when navigation fails', async () => {
      const browser = createMockBrowser({
        navigate: vi.fn().mockResolvedValue(false)
      })
      const result = await scrapeCodexDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Navigation failed')
    })

    it('returns error when auth required', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ authRequired: true })
      })
      const result = await scrapeCodexDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Auth required')
    })

    it('returns error when parse fails', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue(null)
      })
      const result = await scrapeCodexDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Parse failed')
    })

    it('navigates to OpenAI usage URL', async () => {
      const navigate = vi.fn().mockResolvedValue(true)
      const browser = createMockBrowser({ navigate })
      await scrapeCodexDashboard(browser)
      expect(navigate).toHaveBeenCalledWith('https://platform.openai.com/usage')
    })

    it('handles thrown errors gracefully', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockRejectedValue(new Error('timeout'))
      })
      const result = await scrapeCodexDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('timeout')
    })
  })
})
