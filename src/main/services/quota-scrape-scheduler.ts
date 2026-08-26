import log from 'electron-log/main'

const SCRAPE_INTERVAL_MS = 15 * 24 * 60 * 60 * 1000 // 15 days
const DEFER_MS = 60 * 1000 // 60s defer on startup
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // check every 6h
const SETTINGS_KEY = 'quota_last_scrape'

export interface SettingsAccessor {
  get(key: string): string | null
  set(key: string, value: string): void
}

/**
 * Returns true if a scrape should be triggered.
 * True when: no last scrape, invalid date, or > 15 days since last scrape.
 */
export function shouldScrape(lastScrapeIso: string | null, now: number = Date.now()): boolean {
  if (!lastScrapeIso) return true

  const lastTs = new Date(lastScrapeIso).getTime()
  if (isNaN(lastTs)) return true

  return (now - lastTs) >= SCRAPE_INTERVAL_MS
}

export class QuotaScrapeScheduler {
  private settings: SettingsAccessor
  private scrapeFn: () => Promise<void>
  private deferTimer: ReturnType<typeof setTimeout> | null = null
  private checkTimer: ReturnType<typeof setInterval> | null = null

  constructor(settings: SettingsAccessor, scrapeFn: () => Promise<void>) {
    this.settings = settings
    this.scrapeFn = scrapeFn
  }

  async checkAndScrape(): Promise<void> {
    const lastScrape = this.settings.get(SETTINGS_KEY)
    if (!shouldScrape(lastScrape)) {
      log.debug('[quota-scheduler] Scrape not due yet')
      return
    }

    log.info('[quota-scheduler] Triggering quota scrape')
    try {
      await this.scrapeFn()
      this.settings.set(SETTINGS_KEY, new Date().toISOString())
      log.info('[quota-scheduler] Scrape completed, timestamp saved')
    } catch (err) {
      log.error('[quota-scheduler] Scrape failed:', err)
    }
  }

  start(): void {
    log.info('[quota-scheduler] Starting (60s defer)')
    this.deferTimer = setTimeout(() => {
      this.checkAndScrape()
      this.checkTimer = setInterval(() => this.checkAndScrape(), CHECK_INTERVAL_MS)
    }, DEFER_MS)
  }

  stop(): void {
    if (this.deferTimer) {
      clearTimeout(this.deferTimer)
      this.deferTimer = null
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    log.info('[quota-scheduler] Stopped')
  }
}
