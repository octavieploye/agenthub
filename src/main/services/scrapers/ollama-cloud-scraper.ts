import log from 'electron-log/main'
import type { BrowserClient, DashboardQuota, ScraperResult } from './scraper-types'

const OLLAMA_USAGE_URL = 'https://ollama.com/settings/billing'
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface OllamaScraperCache {
  data: DashboardQuota
  cachedAt: number
}

let cache: OllamaScraperCache | null = null

/**
 * Parses raw quota data from Ollama Cloud billing page.
 */
export function parseOllamaQuota(raw: {
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
 * Returns true if the cache is still valid (within cooldown window).
 */
export function isCacheValid(now: number = Date.now()): boolean {
  if (!cache) return false
  return (now - cache.cachedAt) < COOLDOWN_MS
}

/**
 * Clears the internal cache. Useful for testing.
 */
export function clearCache(): void {
  cache = null
}

/**
 * Returns the cached data if available.
 */
export function getCachedData(): OllamaScraperCache | null {
  return cache
}

/**
 * Scrapes Ollama Cloud billing page with 24h cooldown.
 * Returns cached data within the cooldown window.
 */
export async function scrapeOllamaCloud(
  browser: BrowserClient,
  now: number = Date.now()
): Promise<ScraperResult> {
  // Return cached data if within cooldown
  if (cache && isCacheValid(now)) {
    return { data: cache.data, error: null, fromCache: true }
  }

  try {
    const navigated = await browser.navigate(OLLAMA_USAGE_URL)
    if (!navigated) {
      return { data: null, error: 'Navigation failed', fromCache: false }
    }

    const raw = await browser.evaluate<{
      used?: number | string
      limit?: number | string
      resetText?: string
      authRequired?: boolean
    }>(`() => {
      if (window.location.pathname.includes('/login') ||
          window.location.pathname.includes('/signin')) {
        return { authRequired: true }
      }
      const text = document.body.innerText
      const usageMatch = text.match(/(\\d+(?:,\\d+)?)\\s*\\/\\s*(\\d+(?:,\\d+)?)\\s*(?:requests|tokens|credits)/)
      if (usageMatch) {
        return {
          used: usageMatch[1].replace(/,/g, ''),
          limit: usageMatch[2].replace(/,/g, '')
        }
      }
      return null
    }`)

    if (raw?.authRequired) {
      log.warn('[ollama-scraper] Auth required')
      return { data: null, error: 'Auth required', fromCache: false }
    }

    const data = parseOllamaQuota(raw)
    if (!data) {
      log.warn('[ollama-scraper] Could not parse quota')
      return { data: null, error: 'Parse failed', fromCache: false }
    }

    // Update cache
    cache = { data, cachedAt: now }

    return { data, error: null, fromCache: false }
  } catch (err) {
    log.warn('[ollama-scraper] Scrape failed:', err)
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
      fromCache: false
    }
  }
}
