import log from 'electron-log/main'
import type { BrowserClient, DashboardQuota, ScraperResult } from './scraper-types'

const CODEX_USAGE_URL = 'https://platform.openai.com/usage'

/**
 * Parses raw quota data extracted from OpenAI's usage dashboard.
 */
export function parseCodexQuota(raw: {
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
      // unparseable
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
 * Scrapes OpenAI/Codex usage dashboard via Chrome DevTools MCP.
 */
export async function scrapeCodexDashboard(
  browser: BrowserClient
): Promise<ScraperResult> {
  try {
    const navigated = await browser.navigate(CODEX_USAGE_URL)
    if (!navigated) {
      return { data: null, error: 'Navigation failed', fromCache: false }
    }

    const raw = await browser.evaluate<{
      used?: number | string
      limit?: number | string
      resetText?: string
      authRequired?: boolean
    }>(`() => {
      if (document.querySelector('[data-testid="login-button"]') ||
          window.location.pathname.includes('/login') ||
          window.location.pathname.includes('/auth')) {
        return { authRequired: true }
      }
      const text = document.body.innerText
      const usageMatch = text.match(/(\\d+(?:,\\d+)?)\\s*\\/\\s*(\\d+(?:,\\d+)?)\\s*(?:requests|messages|credits)/)
      if (usageMatch) {
        return {
          used: usageMatch[1].replace(/,/g, ''),
          limit: usageMatch[2].replace(/,/g, '')
        }
      }
      const dollarMatch = text.match(/\\$(\\d+(?:\\.\\d+)?)\\s*\\/\\s*\\$(\\d+(?:\\.\\d+)?)/)
      if (dollarMatch) {
        return {
          used: Math.round(parseFloat(dollarMatch[1]) * 100),
          limit: Math.round(parseFloat(dollarMatch[2]) * 100)
        }
      }
      return null
    }`)

    if (raw?.authRequired) {
      log.warn('[codex-scraper] Auth required — login page detected')
      return { data: null, error: 'Auth required', fromCache: false }
    }

    const data = parseCodexQuota(raw)
    if (!data) {
      log.warn('[codex-scraper] Could not parse quota from dashboard')
      return { data: null, error: 'Parse failed', fromCache: false }
    }

    return { data, error: null, fromCache: false }
  } catch (err) {
    log.warn('[codex-scraper] Scrape failed:', err)
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
      fromCache: false
    }
  }
}
