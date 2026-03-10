import { describe, it, expect, vi } from 'vitest'
import {
  getQuotaZone,
  assessComplexity,
  recommend,
  buildSpawnEnv,
  type TaskComplexity,
  type QuotaZone,
  type ModelRecommendation,
  type SpawnEnv
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
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-20250514', 'anthropic')
      expect(result.ANTHROPIC_BASE_URL).toBeUndefined()
    })

    it('returns no ANTHROPIC_AUTH_TOKEN for anthropic provider', () => {
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-20250514', 'anthropic')
      expect(result.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    })

    it('sets modelFlag to model name for anthropic', () => {
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-20250514', 'anthropic')
      expect(result.modelFlag).toBe('claude-sonnet-4-20250514')
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
      const result: SpawnEnv = buildSpawnEnv('claude-sonnet-4-20250514', 'anthropic')
      expect(result.ANTHROPIC_API_KEY).toBeUndefined()
    })
  })
})
