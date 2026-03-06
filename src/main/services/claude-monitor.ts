import log from 'electron-log/main'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { SessionEntry, UsageSnapshot, SubscriptionPlan, ModelUsage } from '@shared/types/usage.types'
import { PLAN_LIMITS, USAGE_REFRESH_INTERVAL_MS, BURN_RATE_WINDOW_MINUTES } from '@shared/constants/plan-limits'
import { parseJsonlContent, extractUsageEntries } from '../parsers/jsonl-parser'

export interface ClaudeMonitorOptions {
  claudeDir?: string
  refreshIntervalMs?: number
}

export function detectPlan(totalMessages: number): SubscriptionPlan {
  if (totalMessages <= PLAN_LIMITS.pro.messageLimit) return 'pro'
  if (totalMessages <= PLAN_LIMITS.max5.messageLimit) return 'max5'
  if (totalMessages <= PLAN_LIMITS.max20.messageLimit) return 'max20'
  return 'custom'
}

export function calculateBurnRate(timestamps: string[], windowMinutes?: number): number {
  if (timestamps.length <= 1) return 0

  const windowMins = windowMinutes ?? BURN_RATE_WINDOW_MINUTES
  const now = Date.now()
  const cutoff = now - windowMins * 60 * 1000

  const recent = timestamps
    .map((t) => new Date(t).getTime())
    .filter((t) => t >= cutoff)

  if (recent.length <= 1) return 0

  const oldest = Math.min(...recent)
  const spanHours = (now - oldest) / (1000 * 60 * 60)

  if (spanHours <= 0) return 0

  return recent.length / spanHours
}

export function aggregateUsage(
  entries: SessionEntry[]
): Omit<UsageSnapshot, 'plan' | 'burnRate' | 'lastUpdated' | 'resetDate'> {
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheCreationTokens = 0
  let totalCacheReadTokens = 0
  let totalMessages = 0
  const byModel = new Map<string, ModelUsage>()

  for (const entry of entries) {
    if (entry.type !== 'assistant') continue
    if (!entry.message.usage) continue

    totalMessages++
    const usage = entry.message.usage
    totalInputTokens += usage.input_tokens ?? 0
    totalOutputTokens += usage.output_tokens ?? 0
    totalCacheCreationTokens += usage.cache_creation_input_tokens ?? 0
    totalCacheReadTokens += usage.cache_read_input_tokens ?? 0

    const model = entry.message.model ?? 'unknown'
    const existing = byModel.get(model)
    if (existing) {
      existing.inputTokens += usage.input_tokens ?? 0
      existing.outputTokens += usage.output_tokens ?? 0
      existing.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0
      existing.cacheReadTokens += usage.cache_read_input_tokens ?? 0
      existing.messageCount++
    } else {
      byModel.set(model, {
        model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        messageCount: 1
      })
    }
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCacheCreationTokens,
    totalCacheReadTokens,
    totalMessages,
    byModel
  }
}

function emptySnapshot(): UsageSnapshot {
  return {
    plan: 'pro',
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    totalMessages: 0,
    byModel: new Map(),
    burnRate: 0,
    lastUpdated: '',
    resetDate: ''
  }
}

export class ClaudeMonitor {
  private claudeDir: string
  private refreshIntervalMs: number
  private snapshot: UsageSnapshot
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor(options?: ClaudeMonitorOptions) {
    this.claudeDir = options?.claudeDir ?? join(homedir(), '.claude')
    this.refreshIntervalMs = options?.refreshIntervalMs ?? USAGE_REFRESH_INTERVAL_MS
    this.snapshot = emptySnapshot()
  }

  getSnapshot(): UsageSnapshot {
    return this.snapshot
  }

  async refresh(): Promise<void> {
    const projectsDir = join(this.claudeDir, 'projects')

    if (!fs.existsSync(projectsDir)) {
      log.debug(`Claude projects dir not found: ${projectsDir}`)
      return
    }

    try {
      const allEntries: SessionEntry[] = []
      await this.readJsonlFiles(projectsDir, allEntries)

      const usageEntries = extractUsageEntries(allEntries)
      const aggregated = aggregateUsage(usageEntries)

      const timestamps = usageEntries.map((e) => e.timestamp)
      const burnRate = calculateBurnRate(timestamps)
      const plan = detectPlan(aggregated.totalMessages)

      this.snapshot = {
        ...aggregated,
        plan,
        burnRate,
        lastUpdated: new Date().toISOString(),
        resetDate: this.computeResetDate()
      }

      log.info(`Claude Monitor refreshed: ${aggregated.totalMessages} messages, plan=${plan}`)
    } catch (err) {
      log.error('Claude Monitor refresh failed:', err)
    }
  }

  async start(): Promise<void> {
    await this.refresh()
    this.intervalId = setInterval(() => {
      this.refresh().catch((err) => log.error('Periodic refresh failed:', err))
    }, this.refreshIntervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async readJsonlFiles(dir: string, entries: SessionEntry[]): Promise<void> {
    const items = await fsp.readdir(dir)

    for (const name of items) {
      if (!name.endsWith('.jsonl')) continue
      const fullPath = join(dir, name)
      try {
        const content = await fsp.readFile(fullPath, 'utf-8')
        const parsed = parseJsonlContent(content)
        entries.push(...parsed)
      } catch (err) {
        log.debug(`Failed to read ${fullPath}:`, err)
      }
    }
  }

  private computeResetDate(): string {
    const now = new Date()
    const resetDay = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return resetDay.toISOString()
  }
}
