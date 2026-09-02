import { describe, it, expect, vi } from 'vitest'
import {
  getQuotaZone,
  assessComplexity,
  recommend,
  buildSpawnEnv,
  recommendForPhase,
  checkOllamaCloudHealth,
  getUnifiedQuota,
  type TaskComplexity,
  type QuotaZone,
  type ModelRecommendation,
  type SpawnEnv,
  type ProviderQuotaState
} from './model-dispatcher'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

describe('Model Dispatcher', () => {
  // ─── getQuotaZone ───────────────────────────────────────────────────

  describe('getQuotaZone', () => {
    it('returns healthy for quotaPercent < 60', () => {
      const result: QuotaZone = getQuotaZone(45)
      expect(result).toBe('healthy')
    })

    it('returns healthy for 0', () => {
      const result: QuotaZone = getQuotaZone(0)
      expect(result).toBe('healthy')
    })

    it('returns moderate for 60', () => {
      const result: QuotaZone = getQuotaZone(60)
      expect(result).toBe('moderate')
    })

    it('returns moderate for 79', () => {
      const result: QuotaZone = getQuotaZone(79)
      expect(result).toBe('moderate')
    })

    it('returns hot for 80', () => {
      const result: QuotaZone = getQuotaZone(80)
      expect(result).toBe('hot')
    })

    it('returns hot for 100', () => {
      const result: QuotaZone = getQuotaZone(100)
      expect(result).toBe('hot')
    })
  })

  // ─── assessComplexity ───────────────────────────────────────────────

  describe('assessComplexity', () => {
    it('returns complex for task containing "refactor"', () => {
      const result: TaskComplexity = assessComplexity('Refactor the auth module')
      expect(result).toBe('complex')
    })

    it('returns complex for task containing "architecture"', () => {
      const result: TaskComplexity = assessComplexity('Review the architecture of the system')
      expect(result).toBe('complex')
    })

    it('returns complex for task containing "migrate"', () => {
      const result: TaskComplexity = assessComplexity('Migrate database to PostgreSQL')
      expect(result).toBe('complex')
    })

    it('returns complex for task containing "redesign"', () => {
      const result: TaskComplexity = assessComplexity('Redesign the payment flow')
      expect(result).toBe('complex')
    })

    it('returns simple for task containing "fix"', () => {
      const result: TaskComplexity = assessComplexity('Fix the login button')
      expect(result).toBe('simple')
    })

    it('returns simple for task containing "bug"', () => {
      const result: TaskComplexity = assessComplexity('Bug in the sidebar rendering')
      expect(result).toBe('simple')
    })

    it('returns simple for task containing "typo"', () => {
      const result: TaskComplexity = assessComplexity('Fix typo in README')
      expect(result).toBe('simple')
    })

    it('returns simple for task containing "lint"', () => {
      const result: TaskComplexity = assessComplexity('Run lint and fix warnings')
      expect(result).toBe('simple')
    })

    it('returns simple for task containing "update"', () => {
      const result: TaskComplexity = assessComplexity('Update the version number')
      expect(result).toBe('simple')
    })

    it('returns moderate for generic task description', () => {
      const result: TaskComplexity = assessComplexity('Implement user profile page')
      expect(result).toBe('moderate')
    })

    it('is case-insensitive', () => {
      const result: TaskComplexity = assessComplexity('REFACTOR the entire codebase')
      expect(result).toBe('complex')
    })
  })

  // ─── recommend ──────────────────────────────────────────────────────

  describe('recommend', () => {
    // ── healthy zone (<60%) ──

    describe('healthy zone (<60%)', () => {
      it('recommends Claude for simple task', () => {
        const result: ModelRecommendation = recommend(30, 'fix a typo')
        expect(result.provider).toBe('anthropic')
        expect(result.model).toContain('sonnet')
      })

      it('recommends Claude opus for complex task', () => {
        const result: ModelRecommendation = recommend(30, 'refactor the entire auth system')
        expect(result.provider).toBe('anthropic')
        expect(result.model).toContain('opus')
      })

      it('returns empty warnings array', () => {
        const result: ModelRecommendation = recommend(30, 'fix a typo')
        expect(result.warnings).toEqual([])
      })

      it('returns empty alternatives when Ollama not available', () => {
        const result: ModelRecommendation = recommend(30, 'fix a typo', false)
        expect(result.alternatives).toEqual([])
      })
    })

    // ── moderate zone (60-80%) ──

    describe('moderate zone (60-80%)', () => {
      it('recommends Claude for complex task', () => {
        const result: ModelRecommendation = recommend(70, 'refactor the auth module')
        expect(result.provider).toBe('anthropic')
      })

      it('includes Ollama alternatives when ollamaAvailable is true', () => {
        const result: ModelRecommendation = recommend(70, 'implement a feature', true)
        expect(result.alternatives.length).toBeGreaterThan(0)
      })

      it('no Ollama alternatives when ollamaAvailable is false', () => {
        const result: ModelRecommendation = recommend(70, 'implement a feature', false)
        expect(result.alternatives).toEqual([])
      })
    })

    // ── hot zone (>80%) ──

    describe('hot zone (>80%)', () => {
      it('recommends Ollama for simple task when ollamaAvailable', () => {
        const result: ModelRecommendation = recommend(90, 'fix a typo', true)
        expect(result.provider).not.toBe('anthropic')
      })

      it('recommends Claude for complex task even when hot', () => {
        const result: ModelRecommendation = recommend(90, 'refactor the entire codebase', true)
        expect(result.provider).toBe('anthropic')
      })

      it('includes quota warning for Claude recommendation in hot zone', () => {
        const result: ModelRecommendation = recommend(90, 'refactor the entire codebase', true)
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings.some((w: string) => w.toLowerCase().includes('quota'))).toBe(true)
      })

      it('falls back to Claude when Ollama not available even in hot zone', () => {
        const result: ModelRecommendation = recommend(90, 'fix a typo', false)
        expect(result.provider).toBe('anthropic')
      })

      it('includes context window warning when recommending Ollama', () => {
        const result: ModelRecommendation = recommend(90, 'fix a typo', true)
        expect(result.warnings.some((w: string) => w.toLowerCase().includes('context'))).toBe(true)
      })
    })
  })

  // ─── buildSpawnEnv ──────────────────────────────────────────────────

  describe('buildSpawnEnv', () => {
    // ── anthropic provider ──

    it('returns no ANTHROPIC_BASE_URL for anthropic provider', () => {
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-6', 'anthropic')
      expect(result.ANTHROPIC_BASE_URL).toBeUndefined()
    })

    it('returns no ANTHROPIC_AUTH_TOKEN for anthropic provider', () => {
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-6', 'anthropic')
      expect(result.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    })

    it('sets modelFlag to model name for anthropic', () => {
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-6', 'anthropic')
      expect(result.modelFlag).toBe('claude-sonnet-4-6')
    })

    // ── ollama-local provider ──

    it('sets ANTHROPIC_BASE_URL to localhost:11434 for ollama-local', () => {
      const result: SpawnEnv = buildSpawnEnv('llama3', 'ollama-local')
      expect(result.ANTHROPIC_BASE_URL).toBe('http://localhost:11434')
    })

    it('sets ANTHROPIC_AUTH_TOKEN to ollama for ollama-local', () => {
      const result: SpawnEnv = buildSpawnEnv('llama3', 'ollama-local')
      expect(result.ANTHROPIC_AUTH_TOKEN).toBe('ollama')
    })

    it('sets modelFlag to model name for ollama-local', () => {
      const result: SpawnEnv = buildSpawnEnv('llama3', 'ollama-local')
      expect(result.modelFlag).toBe('llama3')
    })

    // ── ollama-cloud provider ──

    it('sets ANTHROPIC_BASE_URL to localhost for ollama-cloud (proxied through local Ollama)', () => {
      const result: SpawnEnv = buildSpawnEnv('llama3', 'ollama-cloud')
      expect(result.ANTHROPIC_BASE_URL).toBe('http://localhost:11434')
    })

    it('sets ANTHROPIC_AUTH_TOKEN to ollama for ollama-cloud', () => {
      const result: SpawnEnv = buildSpawnEnv('llama3', 'ollama-cloud')
      expect(result.ANTHROPIC_AUTH_TOKEN).toBe('ollama')
    })

    it('sets ANTHROPIC_API_KEY to empty string for ollama-cloud', () => {
      const result: SpawnEnv = buildSpawnEnv('llama3', 'ollama-cloud')
      expect(result.ANTHROPIC_API_KEY).toBe('')
    })

    it('sets ANTHROPIC_API_KEY to empty string for ollama-local', () => {
      const result: SpawnEnv = buildSpawnEnv('llama3', 'ollama-local')
      expect(result.ANTHROPIC_API_KEY).toBe('')
    })

    it('does not set ANTHROPIC_API_KEY for anthropic provider', () => {
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-6', 'anthropic')
      expect(result.ANTHROPIC_API_KEY).toBeUndefined()
    })

    // ── openai-codex provider ──

    it('returns empty modelFlag for openai-codex with no model', () => {
      const result: SpawnEnv = buildSpawnEnv('', 'openai-codex')
      expect(result.modelFlag).toBe('')
    })

    it('returns model as modelFlag for openai-codex with a model', () => {
      const result: SpawnEnv = buildSpawnEnv('o3-mini', 'openai-codex')
      expect(result.modelFlag).toBe('o3-mini')
    })

    it('does not set ANTHROPIC_BASE_URL for openai-codex', () => {
      const result: SpawnEnv = buildSpawnEnv('', 'openai-codex')
      expect(result.ANTHROPIC_BASE_URL).toBeUndefined()
    })

    it('does not set ANTHROPIC_AUTH_TOKEN for openai-codex', () => {
      const result: SpawnEnv = buildSpawnEnv('', 'openai-codex')
      expect(result.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    })

    it('does not set ANTHROPIC_API_KEY for openai-codex', () => {
      const result: SpawnEnv = buildSpawnEnv('', 'openai-codex')
      expect(result.ANTHROPIC_API_KEY).toBeUndefined()
    })
  })

  // ─── recommendForPhase ────────────────────────────────────────────

  describe('recommendForPhase', () => {
    it('returns Anthropic provider for dev phase', () => {
      const result: ModelRecommendation = recommendForPhase('dev', 'implement a feature', false)
      expect(result.provider).toBe('anthropic')
      expect(result.model).toContain('sonnet')
    })

    it('returns Opus for complex dev tasks', () => {
      const result: ModelRecommendation = recommendForPhase('dev', 'refactor the auth module', false)
      expect(result.provider).toBe('anthropic')
      expect(result.model).toContain('opus')
      expect(result.rationale).toContain('Opus')
    })

    it('includes cloud alternative for dev phase when cloud available', () => {
      const result: ModelRecommendation = recommendForPhase('dev', 'implement a feature', true)
      expect(result.provider).toBe('anthropic')
      expect(result.alternatives.length).toBeGreaterThan(0)
    })

    it('returns cloud model for review phase when cloud available', () => {
      const result: ModelRecommendation = recommendForPhase('review', 'review code changes', true)
      expect(result.provider).toBe('ollama-cloud')
      expect(result.model).toBe('deepseek-v4-pro:0813:cloud')
      expect(result.alternatives).toContain('claude-sonnet-4-6')
    })

    it('returns cloud model for security phase when cloud available', () => {
      const result: ModelRecommendation = recommendForPhase('security', 'security audit', true)
      expect(result.provider).toBe('ollama-cloud')
      expect(result.model).toBe('deepseek-v4-pro:0813:cloud')
    })

    it('falls back to Sonnet for review phase when cloud unavailable', () => {
      const result: ModelRecommendation = recommendForPhase('review', 'review code changes', false)
      expect(result.provider).toBe('anthropic')
      expect(result.model).toContain('sonnet')
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some((w: string) => w.toLowerCase().includes('ollama cloud not available'))).toBe(true)
    })

    it('falls back to Sonnet for security phase when cloud unavailable', () => {
      const result: ModelRecommendation = recommendForPhase('security', 'security scan', false)
      expect(result.provider).toBe('anthropic')
      expect(result.model).toContain('sonnet')
    })

    it('returns empty model for commit phase', () => {
      const result: ModelRecommendation = recommendForPhase('commit', 'commit changes', false)
      expect(result.model).toBe('')
      expect(result.rationale).toContain('GitService directly')
    })

    it('returns empty model for push phase', () => {
      const result: ModelRecommendation = recommendForPhase('push', 'push to remote', true)
      expect(result.model).toBe('')
      expect(result.rationale).toContain('GitService directly')
    })
  })

  // ─── recommend with RecommendOptions (Codex fallback) ────────────

  describe('recommend with RecommendOptions', () => {
    it('Claude hot + Codex healthy → suggests Codex', () => {
      const result = recommend(90, 'fix a typo', {
        ollamaAvailable: false,
        codexAvailable: true,
        codexQuotaPercent: 20
      })
      expect(result.provider).toBe('openai-codex')
      expect(result.model).toBe('o3-mini')
    })

    it('Claude hot + Codex hot → falls through to Ollama for simple task', () => {
      const result = recommend(90, 'fix a typo', {
        ollamaAvailable: true,
        codexAvailable: true,
        codexQuotaPercent: 85
      })
      expect(result.provider).toBe('ollama-local')
    })

    it('Claude hot + Codex hot + no Ollama → falls back to Claude', () => {
      const result = recommend(90, 'fix a typo', {
        ollamaAvailable: false,
        codexAvailable: true,
        codexQuotaPercent: 85
      })
      expect(result.provider).toBe('anthropic')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('all healthy → prefers Claude', () => {
      const result = recommend(30, 'implement a feature', {
        ollamaAvailable: true,
        codexAvailable: true,
        codexQuotaPercent: 20
      })
      expect(result.provider).toBe('anthropic')
    })

    it('moderate zone + Codex healthy → lists Codex as alternative', () => {
      const result = recommend(70, 'implement a feature', {
        ollamaAvailable: false,
        codexAvailable: true,
        codexQuotaPercent: 20
      })
      expect(result.provider).toBe('anthropic')
      expect(result.alternatives).toContain('o3-mini')
    })

    it('moderate zone + Codex hot → does not list Codex as alternative', () => {
      const result = recommend(70, 'implement a feature', {
        ollamaAvailable: false,
        codexAvailable: true,
        codexQuotaPercent: 85
      })
      expect(result.provider).toBe('anthropic')
      expect(result.alternatives).not.toContain('o3-mini')
    })

    it('backward compatible — boolean true still works', () => {
      const result = recommend(90, 'fix a typo', true)
      expect(result.provider).toBe('ollama-local')
    })

    it('backward compatible — boolean false still works', () => {
      const result = recommend(90, 'fix a typo', false)
      expect(result.provider).toBe('anthropic')
    })

    it('hot zone + Codex available → Codex alternatives include Ollama when available', () => {
      const result = recommend(90, 'fix a typo', {
        ollamaAvailable: true,
        codexAvailable: true,
        codexQuotaPercent: 20
      })
      expect(result.provider).toBe('openai-codex')
      expect(result.alternatives).toContain('llama3')
    })

    it('complex task in hot zone + Codex healthy → uses Codex (preserves Claude quota)', () => {
      const result = recommend(90, 'refactor the auth system', {
        ollamaAvailable: true,
        codexAvailable: true,
        codexQuotaPercent: 20
      })
      expect(result.provider).toBe('openai-codex')
      expect(result.model).toBe('o3-mini')
    })

    it('complex task in hot zone + no Codex + Ollama → falls to Claude (Ollama skips complex)', () => {
      const result = recommend(90, 'refactor the auth system', {
        ollamaAvailable: true,
        codexAvailable: false,
        codexQuotaPercent: 0
      })
      expect(result.provider).toBe('anthropic')
      expect(result.model).toContain('opus')
    })
  })

  // ─── getUnifiedQuota ──────────────────────────────────────────────

  describe('getUnifiedQuota', () => {
    it('always includes anthropic provider', () => {
      const states: ProviderQuotaState[] = getUnifiedQuota({})
      expect(states.length).toBe(1)
      expect(states[0].provider).toBe('anthropic')
      expect(states[0].quotaPercent).toBe(0)
      expect(states[0].zone).toBe('healthy')
      expect(states[0].available).toBe(true)
    })

    it('includes claude quota when provided', () => {
      const states = getUnifiedQuota({
        claude: { quotaPercent: 75, lastUpdated: '2026-08-26T12:00:00Z' }
      })
      expect(states[0].quotaPercent).toBe(75)
      expect(states[0].zone).toBe('moderate')
      expect(states[0].lastUpdated).toBe('2026-08-26T12:00:00Z')
    })

    it('includes codex when provided', () => {
      const states = getUnifiedQuota({
        codex: { quotaPercent: 40, available: true, lastUpdated: '2026-08-26T10:00:00Z' }
      })
      const codex = states.find(s => s.provider === 'openai-codex')
      expect(codex).toBeDefined()
      expect(codex!.quotaPercent).toBe(40)
      expect(codex!.zone).toBe('healthy')
      expect(codex!.available).toBe(true)
    })

    it('includes ollama-cloud when provided', () => {
      const states = getUnifiedQuota({
        ollamaCloud: { quotaPercent: 85, available: true }
      })
      const cloud = states.find(s => s.provider === 'ollama-cloud')
      expect(cloud).toBeDefined()
      expect(cloud!.zone).toBe('hot')
    })

    it('includes ollama-local with zero quota and healthy zone', () => {
      const states = getUnifiedQuota({
        ollamaLocal: { available: true }
      })
      const local = states.find(s => s.provider === 'ollama-local')
      expect(local).toBeDefined()
      expect(local!.quotaPercent).toBe(0)
      expect(local!.zone).toBe('healthy')
      expect(local!.available).toBe(true)
      expect(local!.lastUpdated).toBeNull()
    })

    it('merges all four providers', () => {
      const states = getUnifiedQuota({
        claude: { quotaPercent: 50 },
        codex: { quotaPercent: 30, available: true },
        ollamaCloud: { quotaPercent: 60, available: true },
        ollamaLocal: { available: false }
      })
      expect(states).toHaveLength(4)
      const providers = states.map(s => s.provider)
      expect(providers).toContain('anthropic')
      expect(providers).toContain('openai-codex')
      expect(providers).toContain('ollama-cloud')
      expect(providers).toContain('ollama-local')
    })

    it('unavailable codex is tracked', () => {
      const states = getUnifiedQuota({
        codex: { quotaPercent: 0, available: false }
      })
      const codex = states.find(s => s.provider === 'openai-codex')
      expect(codex!.available).toBe(false)
    })
  })

  // ─── checkOllamaCloudHealth ───────────────────────────────────────

  describe('checkOllamaCloudHealth', () => {
    it('returns false when fetch fails (network error)', async () => {
      // Uses the real fetch — no server on localhost:11434 in test env → should fail gracefully
      const result = await checkOllamaCloudHealth('nonexistent-model')
      expect(result).toBe(false)
    })
  })
})
