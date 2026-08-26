/**
 * Abstraction over Chrome DevTools MCP for dashboard scraping.
 * Tests mock this interface; production uses the MCP client.
 */
export interface BrowserClient {
  navigate(url: string): Promise<boolean>
  evaluate<T>(fn: string): Promise<T | null>
}

export interface DashboardQuota {
  used: number
  limit: number
  percent: number
  resetDate: string | null
  scrapedAt: string
}

export interface ScraperResult {
  data: DashboardQuota | null
  error: string | null
  fromCache: boolean
}
