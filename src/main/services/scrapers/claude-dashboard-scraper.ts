import log from 'electron-log/main'
import type { BrowserClient, DashboardQuota, ScraperResult } from './scraper-types'

const CLAUDE_USAGE_URL = 'https://claude.ai/settings/usage'

/**
 * Parses raw quota data extracted from Claude's usage dashboard.
 * Expects { used, limit, resetText } from the evaluate script.
 */
export function parseClaudeQuota(raw: {
  used?: number | string
  limit?: number | string
  resetText?: string
} | null): DashboardQuota | null {
  if (!raw) return null

  const used = typeof raw.used === 'string' ? parseInt(raw.used, 10) : raw.used
  const limit = typeof raw.limit === 'string' ? parseInt(raw.limit, 10) : raw.limit

  if (used == null || limit == null || isNaN(used) || isNaN(limit) || limit <= 0) {
    return null
  }

  let resetDate: string | null = null
  if (raw.resetText) {
    try {
      const parsed = new Date(raw.resetText)
      if (!isNaN(parsed.getTime())) {
        resetDate = parsed.toISOString()
      }
    } catch {
      // unparseable reset date — leave null
    }
  }

  return {
    used,
    limit,
    percent: Math.round((used / limit) * 100),
    resetDate,
    scrapedAt: new Date().toISOString()
  }
}

/**
 * Scrapes Claude usage dashboard via Chrome DevTools MCP.
 * Returns null on failure (auth expired, page changed, Chrome not running).
 */
export async function scrapeClaudeDashboard(
  browser: BrowserClient
): Promise<ScraperResult> {
  try {
    const navigated = await browser.navigate(CLAUDE_USAGE_URL)
    if (!navigated) {
      return { data: null, error: 'Navigation failed', fromCache: false }
    }

    // Extract quota data from the dashboard DOM
    const raw = await browser.evaluate<{
      used?: number | string
      limit?: number | string
      resetText?: string
      authRequired?: boolean
    }>(`() => {
      // Detect login page
      if (document.querySelector('[data-testid="login-form"]') ||
          window.location.pathname.includes('/login')) {
        return { authRequired: true }
      }
      // Look for usage indicators on the settings/usage page
      const text = document.body.innerText
      const usageMatch = text.match(/(\\d+)\\s*\\/\\s*(\\d+)\\s*messages/)
      if (usageMatch) {
        return { used: usageMatch[1], limit: usageMatch[2] }
      }
      const percentMatch = text.match(/(\\d+)%\\s*(?:of|used)/)
      if (percentMatch) {
        return { used: parseInt(percentMatch[1]), limit: 100 }
      }
      return null
    }`)

    if (raw?.authRequired) {
      log.warn('[claude-scraper] Auth required — login page detected')
      return { data: null, error: 'Auth required', fromCache: false }
    }

    const data = parseClaudeQuota(raw)
    if (!data) {
      log.warn('[claude-scraper] Could not parse quota from dashboard')
      return { data: null, error: 'Parse failed', fromCache: false }
    }

    return { data, error: null, fromCache: false }
  } catch (err) {
    log.warn('[claude-scraper] Scrape failed:', err)
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
      fromCache: false
    }
  }
}
