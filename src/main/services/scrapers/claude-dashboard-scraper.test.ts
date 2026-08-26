import { describe, it, expect, vi } from 'vitest'
import { parseClaudeQuota, scrapeClaudeDashboard } from './claude-dashboard-scraper'
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

describe('Claude Dashboard Scraper', () => {
  describe('parseClaudeQuota', () => {
    it('parses numeric used and limit', () => {
      const result = parseClaudeQuota({ used: 147, limit: 250 })
      expect(result).not.toBeNull()
      expect(result!.used).toBe(147)
      expect(result!.limit).toBe(250)
      expect(result!.percent).toBe(59)
    })

    it('parses string used and limit', () => {
      const result = parseClaudeQuota({ used: '50', limit: '200' })
      expect(result).not.toBeNull()
      expect(result!.used).toBe(50)
      expect(result!.limit).toBe(200)
      expect(result!.percent).toBe(25)
    })

    it('returns null for null input', () => {
      expect(parseClaudeQuota(null)).toBeNull()
    })

    it('returns null when limit is 0', () => {
      expect(parseClaudeQuota({ used: 10, limit: 0 })).toBeNull()
    })

    it('returns null when used is NaN', () => {
      expect(parseClaudeQuota({ used: 'abc', limit: 100 })).toBeNull()
    })

    it('returns null when limit is missing', () => {
      expect(parseClaudeQuota({ used: 10 })).toBeNull()
    })

    it('parses valid reset date', () => {
      const result = parseClaudeQuota({ used: 10, limit: 100, resetText: '2026-09-01T00:00:00Z' })
      expect(result!.resetDate).toBe('2026-09-01T00:00:00.000Z')
    })

    it('leaves resetDate null for unparseable date', () => {
      const result = parseClaudeQuota({ used: 10, limit: 100, resetText: 'not a date' })
      expect(result!.resetDate).toBeNull()
    })

    it('sets scrapedAt to current ISO timestamp', () => {
      const result = parseClaudeQuota({ used: 10, limit: 100 })
      expect(result!.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('scrapeClaudeDashboard', () => {
    it('returns data when browser returns valid quota', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ used: 147, limit: 250 })
      })
      const result = await scrapeClaudeDashboard(browser)
      expect(result.data).not.toBeNull()
      expect(result.data!.used).toBe(147)
      expect(result.data!.limit).toBe(250)
      expect(result.error).toBeNull()
      expect(result.fromCache).toBe(false)
    })

    it('returns error when navigation fails', async () => {
      const browser = createMockBrowser({
        navigate: vi.fn().mockResolvedValue(false)
      })
      const result = await scrapeClaudeDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Navigation failed')
    })

    it('returns error when auth required', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue({ authRequired: true })
      })
      const result = await scrapeClaudeDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Auth required')
    })

    it('returns error when evaluate returns null', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockResolvedValue(null)
      })
      const result = await scrapeClaudeDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Parse failed')
    })

    it('returns error when evaluate throws', async () => {
      const browser = createMockBrowser({
        evaluate: vi.fn().mockRejectedValue(new Error('Chrome disconnected'))
      })
      const result = await scrapeClaudeDashboard(browser)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Chrome disconnected')
    })

    it('navigates to Claude usage URL', async () => {
      const navigate = vi.fn().mockResolvedValue(true)
      const browser = createMockBrowser({ navigate })
      await scrapeClaudeDashboard(browser)
      expect(navigate).toHaveBeenCalledWith('https://claude.ai/settings/usage')
    })
  })
})
