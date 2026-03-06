import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionEntry, UsageSnapshot } from '@shared/types/usage.types'

// Mock electron-log before importing the module under test
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

// Mock node:fs and node:fs/promises for file system operations
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    default: { ...actual, existsSync: vi.fn() }
  }
})

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    default: { ...actual, readdir: vi.fn(), readFile: vi.fn() }
  }
})

import { detectPlan, calculateBurnRate, aggregateUsage, ClaudeMonitor } from './claude-monitor'
import fs from 'node:fs'
import fsp from 'node:fs/promises'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    type: 'assistant',
    timestamp: new Date().toISOString(),
    sessionId: 'session-1',
    message: {
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5
      }
    },
    ...overrides
  }
}

function makeTimestamp(minutesAgo: number): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - minutesAgo)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// detectPlan
// ---------------------------------------------------------------------------

describe('detectPlan', () => {
  it('returns "pro" when messages <= 250', () => {
    expect(detectPlan(100)).toBe('pro')
  })

  it('returns "max5" when messages > 250 and <= 1000', () => {
    expect(detectPlan(500)).toBe('max5')
  })

  it('returns "max20" when messages > 1000 and <= 2000', () => {
    expect(detectPlan(1500)).toBe('max20')
  })

  it('returns "custom" when messages > 2000', () => {
    expect(detectPlan(3000)).toBe('custom')
  })

  it('returns "pro" for 0 messages', () => {
    expect(detectPlan(0)).toBe('pro')
  })

  it('returns "pro" for exactly 250 messages (boundary)', () => {
    expect(detectPlan(250)).toBe('pro')
  })

  it('returns "max5" for exactly 251 messages (boundary)', () => {
    expect(detectPlan(251)).toBe('max5')
  })

  it('returns "max20" for exactly 1001 messages (boundary)', () => {
    expect(detectPlan(1001)).toBe('max20')
  })
})

// ---------------------------------------------------------------------------
// calculateBurnRate
// ---------------------------------------------------------------------------

describe('calculateBurnRate', () => {
  it('returns 0 for empty timestamps array', () => {
    expect(calculateBurnRate([])).toBe(0)
  })

  it('returns 0 for single timestamp', () => {
    expect(calculateBurnRate([new Date().toISOString()])).toBe(0)
  })

  it('calculates correct rate for evenly spaced messages', () => {
    // 6 messages, each 12 minutes apart = 60 minutes total span
    // 6 messages in 1 hour = 6 messages/hr
    const timestamps = Array.from({ length: 6 }, (_, i) => makeTimestamp(60 - i * 12))
    const rate = calculateBurnRate(timestamps)
    expect(rate).toBeCloseTo(6, 0)
  })

  it('uses only timestamps within the window (default 60 min)', () => {
    const recent = [makeTimestamp(10), makeTimestamp(20), makeTimestamp(30)]
    const old = [makeTimestamp(120), makeTimestamp(180)]
    const all = [...old, ...recent]
    const rate = calculateBurnRate(all)
    // Only the 3 recent timestamps should count
    expect(rate).toBeGreaterThan(0)
    // The rate should be based on 3 messages within 30 minutes => 6/hr
    expect(rate).toBeCloseTo(6, 0)
  })

  it('ignores timestamps older than window', () => {
    const oldOnly = [makeTimestamp(120), makeTimestamp(180)]
    const rate = calculateBurnRate(oldOnly)
    expect(rate).toBe(0)
  })

  it('accepts custom window in minutes', () => {
    // All timestamps within 30 min, but outside a 10-min window
    const timestamps = [makeTimestamp(25), makeTimestamp(20), makeTimestamp(15)]
    const rateWide = calculateBurnRate(timestamps, 30)
    const rateNarrow = calculateBurnRate(timestamps, 10)
    expect(rateWide).toBeGreaterThan(0)
    expect(rateNarrow).toBe(0)
  })

  it('returns messages per hour', () => {
    // 4 messages in 30 minutes = 8 messages/hr
    const timestamps = [
      makeTimestamp(30),
      makeTimestamp(20),
      makeTimestamp(10),
      makeTimestamp(0)
    ]
    const rate = calculateBurnRate(timestamps, 60)
    expect(rate).toBeCloseTo(8, 0)
  })
})

// ---------------------------------------------------------------------------
// aggregateUsage
// ---------------------------------------------------------------------------

describe('aggregateUsage', () => {
  it('sums input tokens across all entries', () => {
    const entries: SessionEntry[] = [
      makeEntry({ message: { role: 'assistant', model: 'claude-sonnet-4-20250514', usage: { input_tokens: 100, output_tokens: 0 } } }),
      makeEntry({ message: { role: 'assistant', model: 'claude-sonnet-4-20250514', usage: { input_tokens: 200, output_tokens: 0 } } })
    ]
    const result = aggregateUsage(entries)
    expect(result.totalInputTokens).toBe(300)
  })

  it('sums output tokens across all entries', () => {
    const entries: SessionEntry[] = [
      makeEntry({ message: { role: 'assistant', model: 'claude-sonnet-4-20250514', usage: { input_tokens: 0, output_tokens: 50 } } }),
      makeEntry({ message: { role: 'assistant', model: 'claude-sonnet-4-20250514', usage: { input_tokens: 0, output_tokens: 75 } } })
    ]
    const result = aggregateUsage(entries)
    expect(result.totalOutputTokens).toBe(125)
  })

  it('sums cache creation tokens (defaulting to 0 when absent)', () => {
    const entries: SessionEntry[] = [
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 30 }
        }
      }),
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 0, output_tokens: 0 }
          // no cache_creation_input_tokens => should default to 0
        }
      })
    ]
    const result = aggregateUsage(entries)
    expect(result.totalCacheCreationTokens).toBe(30)
  })

  it('sums cache read tokens (defaulting to 0 when absent)', () => {
    const entries: SessionEntry[] = [
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 20 }
        }
      }),
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      })
    ]
    const result = aggregateUsage(entries)
    expect(result.totalCacheReadTokens).toBe(20)
  })

  it('counts total messages (assistant entries only)', () => {
    const entries: SessionEntry[] = [
      makeEntry({ type: 'assistant' }),
      makeEntry({ type: 'user', message: { role: 'user' } }),
      makeEntry({ type: 'assistant' }),
      makeEntry({ type: 'user', message: { role: 'user' } })
    ]
    const result = aggregateUsage(entries)
    expect(result.totalMessages).toBe(2)
  })

  it('groups usage by model in byModel Map', () => {
    const entries: SessionEntry[] = [
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 100, output_tokens: 50 }
        }
      }),
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-opus-4-20250514',
          usage: { input_tokens: 200, output_tokens: 80 }
        }
      })
    ]
    const result = aggregateUsage(entries)
    expect(result.byModel).toBeInstanceOf(Map)
    expect(result.byModel.size).toBe(2)
    expect(result.byModel.has('claude-sonnet-4-20250514')).toBe(true)
    expect(result.byModel.has('claude-opus-4-20250514')).toBe(true)
  })

  it('returns zeros for empty entries array', () => {
    const result = aggregateUsage([])
    expect(result.totalInputTokens).toBe(0)
    expect(result.totalOutputTokens).toBe(0)
    expect(result.totalCacheCreationTokens).toBe(0)
    expect(result.totalCacheReadTokens).toBe(0)
    expect(result.totalMessages).toBe(0)
    expect(result.byModel.size).toBe(0)
  })

  it('handles entries with same model correctly (accumulates)', () => {
    const entries: SessionEntry[] = [
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 100, output_tokens: 50 }
        }
      }),
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 150, output_tokens: 70 }
        }
      })
    ]
    const result = aggregateUsage(entries)
    const sonnet = result.byModel.get('claude-sonnet-4-20250514')
    expect(sonnet).toBeDefined()
    expect(sonnet!.inputTokens).toBe(250)
    expect(sonnet!.outputTokens).toBe(120)
    expect(sonnet!.messageCount).toBe(2)
  })

  it('handles entries with different models (separate buckets)', () => {
    const entries: SessionEntry[] = [
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 100, output_tokens: 50 }
        }
      }),
      makeEntry({
        message: {
          role: 'assistant',
          model: 'claude-opus-4-20250514',
          usage: { input_tokens: 300, output_tokens: 200 }
        }
      })
    ]
    const result = aggregateUsage(entries)
    const sonnet = result.byModel.get('claude-sonnet-4-20250514')
    const opus = result.byModel.get('claude-opus-4-20250514')
    expect(sonnet!.inputTokens).toBe(100)
    expect(opus!.inputTokens).toBe(300)
    expect(sonnet!.messageCount).toBe(1)
    expect(opus!.messageCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// ClaudeMonitor
// ---------------------------------------------------------------------------

describe('ClaudeMonitor', () => {
  const mockedExistsSync = vi.mocked(fs.existsSync)
  const mockedReaddir = vi.mocked(fsp.readdir)
  const mockedReadFile = vi.mocked(fsp.readFile)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockedExistsSync.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Sample JSONL content for mocking file reads
  const sampleJsonlLine = (overrides: Partial<SessionEntry> = {}): string => {
    const entry: SessionEntry = {
      type: 'assistant',
      timestamp: new Date().toISOString(),
      sessionId: 'sess-abc',
      message: {
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 500,
          output_tokens: 200,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 5
        }
      },
      ...overrides
    }
    return JSON.stringify(entry)
  }

  // -------------------------------------------------------------------------
  // constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates instance with default options', () => {
      const monitor = new ClaudeMonitor()
      expect(monitor).toBeInstanceOf(ClaudeMonitor)
    })

    it('accepts custom claudeDir', () => {
      const monitor = new ClaudeMonitor({ claudeDir: '/custom/.claude' })
      expect(monitor).toBeInstanceOf(ClaudeMonitor)
    })

    it('accepts custom refreshIntervalMs', () => {
      const monitor = new ClaudeMonitor({ refreshIntervalMs: 5000 })
      expect(monitor).toBeInstanceOf(ClaudeMonitor)
    })
  })

  // -------------------------------------------------------------------------
  // getSnapshot
  // -------------------------------------------------------------------------

  describe('getSnapshot', () => {
    it('returns initial empty snapshot before refresh', () => {
      const monitor = new ClaudeMonitor()
      const snapshot = monitor.getSnapshot()
      expect(snapshot.totalMessages).toBe(0)
      expect(snapshot.totalInputTokens).toBe(0)
      expect(snapshot.totalOutputTokens).toBe(0)
      expect(snapshot.totalCacheCreationTokens).toBe(0)
      expect(snapshot.totalCacheReadTokens).toBe(0)
      expect(snapshot.byModel.size).toBe(0)
      expect(snapshot.burnRate).toBe(0)
      expect(snapshot.plan).toBe('pro')
    })

    it('returns correct plan after refresh', async () => {
      // Create enough assistant entries to push past the pro tier (>250)
      const lines: string[] = []
      for (let i = 0; i < 300; i++) {
        lines.push(sampleJsonlLine({ timestamp: makeTimestamp(i) }))
      }
      const fileContent = lines.join('\n')

      mockedReaddir.mockResolvedValue(['session1.jsonl'] as unknown as Awaited<ReturnType<typeof readdir>>)
      mockedReadFile.mockResolvedValue(fileContent)

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/test-claude' })
      await monitor.refresh()
      const snapshot = monitor.getSnapshot()
      expect(snapshot.plan).toBe('max5')
    })

    it('returns aggregated usage data after refresh', async () => {
      const lines = [
        sampleJsonlLine({
          message: {
            role: 'assistant',
            model: 'claude-sonnet-4-20250514',
            usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 10, cache_read_input_tokens: 5 }
          }
        }),
        sampleJsonlLine({
          message: {
            role: 'assistant',
            model: 'claude-sonnet-4-20250514',
            usage: { input_tokens: 200, output_tokens: 80, cache_creation_input_tokens: 20, cache_read_input_tokens: 15 }
          }
        })
      ]

      mockedReaddir.mockResolvedValue(['session1.jsonl'] as unknown as Awaited<ReturnType<typeof readdir>>)
      mockedReadFile.mockResolvedValue(lines.join('\n'))

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/test-claude' })
      await monitor.refresh()
      const snapshot = monitor.getSnapshot()
      expect(snapshot.totalInputTokens).toBe(300)
      expect(snapshot.totalOutputTokens).toBe(130)
      expect(snapshot.totalCacheCreationTokens).toBe(30)
      expect(snapshot.totalCacheReadTokens).toBe(20)
      expect(snapshot.totalMessages).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // refresh
  // -------------------------------------------------------------------------

  describe('refresh', () => {
    it('reads JSONL files from claudeDir', async () => {
      mockedReaddir.mockResolvedValue(['a.jsonl', 'b.jsonl'] as unknown as Awaited<ReturnType<typeof readdir>>)
      mockedReadFile.mockResolvedValue(sampleJsonlLine())

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/test-claude' })
      await monitor.refresh()

      expect(mockedReaddir).toHaveBeenCalled()
      expect(mockedReadFile).toHaveBeenCalledTimes(2)
    })

    it('updates snapshot with aggregated data', async () => {
      const line = sampleJsonlLine({
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 999, output_tokens: 444 }
        }
      })
      mockedReaddir.mockResolvedValue(['s.jsonl'] as unknown as Awaited<ReturnType<typeof readdir>>)
      mockedReadFile.mockResolvedValue(line)

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/test-claude' })
      await monitor.refresh()
      const snapshot = monitor.getSnapshot()
      expect(snapshot.totalInputTokens).toBe(999)
      expect(snapshot.totalOutputTokens).toBe(444)
      expect(snapshot.lastUpdated).toBeTruthy()
    })

    it('handles missing claudeDir gracefully (no throw)', async () => {
      mockedExistsSync.mockReturnValue(false)

      const monitor = new ClaudeMonitor({ claudeDir: '/nonexistent/.claude' })
      await expect(monitor.refresh()).resolves.not.toThrow()
    })

    it('handles empty directory gracefully', async () => {
      mockedReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>)

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/empty-claude' })
      await monitor.refresh()
      const snapshot = monitor.getSnapshot()
      expect(snapshot.totalMessages).toBe(0)
    })

    it('handles malformed JSONL files without crashing', async () => {
      const malformedContent = '{"valid": true}\nnot-json-at-all\n{broken'
      mockedReaddir.mockResolvedValue(['bad.jsonl'] as unknown as Awaited<ReturnType<typeof readdir>>)
      mockedReadFile.mockResolvedValue(malformedContent)

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/test-claude' })
      await expect(monitor.refresh()).resolves.not.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // start / stop
  // -------------------------------------------------------------------------

  describe('start / stop', () => {
    it('starts periodic refresh', async () => {
      mockedReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>)

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/test-claude', refreshIntervalMs: 5000 })
      await monitor.start()

      // Should have called refresh once on start
      expect(mockedReaddir).toHaveBeenCalledTimes(1)

      // Advance time by one interval
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockedReaddir).toHaveBeenCalledTimes(2)

      // Advance again
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockedReaddir).toHaveBeenCalledTimes(3)

      monitor.stop()
    })

    it('stop cancels periodic refresh', async () => {
      mockedReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof readdir>>)

      const monitor = new ClaudeMonitor({ claudeDir: '/tmp/test-claude', refreshIntervalMs: 5000 })
      await monitor.start()

      const callsAfterStart = mockedReaddir.mock.calls.length

      monitor.stop()

      // Advancing time should NOT trigger more refreshes
      await vi.advanceTimersByTimeAsync(15000)
      expect(mockedReaddir).toHaveBeenCalledTimes(callsAfterStart)
    })
  })
})
