import { describe, it, expect, vi } from 'vitest'
import {
  runPipeline,
  type PipelineInput,
  type PipelineResult
} from './pre-launch-pipeline'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

function createInput(overrides: Partial<PipelineInput> = {}): PipelineInput {
  return {
    taskDescription: 'Fix the login button',
    repoId: 'repo-1',
    quotaPercent: 45,
    quotaUsed: 112,
    quotaLimit: 250,
    burnRate: 8,
    ollamaAvailable: true,
    ...overrides
  }
}

describe('Pre-Launch Pipeline', () => {
  // ─── complexity assessment ────────────────────────────────────────

  describe('complexity assessment', () => {
    it('returns "simple" for simple task descriptions', () => {
      const input = createInput({ taskDescription: 'Fix the login button' })
      const result: PipelineResult = runPipeline(input)
      expect(result.complexity).toBe('simple')
    })

    it('returns "moderate" for moderate tasks', () => {
      const input = createInput({ taskDescription: 'Implement user profile page with avatar upload' })
      const result: PipelineResult = runPipeline(input)
      expect(result.complexity).toBe('moderate')
    })

    it('returns "complex" for complex tasks', () => {
      const input = createInput({ taskDescription: 'Refactor the entire authentication module' })
      const result: PipelineResult = runPipeline(input)
      expect(result.complexity).toBe('complex')
    })
  })

  // ─── triage level ─────────────────────────────────────────────────

  describe('triage level', () => {
    it('assigns "low" triage for simple tasks', () => {
      const input = createInput({ taskDescription: 'Fix a typo in the readme', quotaPercent: 30 })
      const result: PipelineResult = runPipeline(input)
      expect(result.triageLevel).toBe('low')
    })

    it('assigns "medium" triage for moderate tasks', () => {
      const input = createInput({ taskDescription: 'Implement user settings page', quotaPercent: 30 })
      const result: PipelineResult = runPipeline(input)
      expect(result.triageLevel).toBe('medium')
    })

    it('assigns "high" triage for complex tasks', () => {
      const input = createInput({ taskDescription: 'Refactor the data layer', quotaPercent: 50 })
      const result: PipelineResult = runPipeline(input)
      expect(result.triageLevel).toBe('high')
    })

    it('assigns "critical" when complex task AND quota >80%', () => {
      const input = createInput({ taskDescription: 'Refactor the entire codebase', quotaPercent: 85 })
      const result: PipelineResult = runPipeline(input)
      expect(result.triageLevel).toBe('critical')
    })

    it('does NOT assign critical for simple task even when quota >80%', () => {
      const input = createInput({ taskDescription: 'Fix a typo', quotaPercent: 90 })
      const result: PipelineResult = runPipeline(input)
      expect(result.triageLevel).not.toBe('critical')
      expect(result.triageLevel).toBe('low')
    })
  })

  // ─── model recommendation ─────────────────────────────────────────

  describe('model recommendation', () => {
    it('recommends Claude in healthy zone', () => {
      const input = createInput({ quotaPercent: 30, taskDescription: 'Fix a bug' })
      const result: PipelineResult = runPipeline(input)
      expect(result.recommendation.provider).toBe('anthropic')
    })

    it('recommends Ollama in hot zone for simple tasks when available', () => {
      const input = createInput({
        quotaPercent: 90,
        taskDescription: 'Fix a typo',
        ollamaAvailable: true
      })
      const result: PipelineResult = runPipeline(input)
      expect(result.recommendation.provider).not.toBe('anthropic')
    })

    it('includes quota warning in hot zone', () => {
      const input = createInput({
        quotaPercent: 90,
        taskDescription: 'Refactor the auth module',
        ollamaAvailable: true
      })
      const result: PipelineResult = runPipeline(input)
      expect(result.recommendation.warnings.length).toBeGreaterThan(0)
      expect(
        result.recommendation.warnings.some((w: string) => w.toLowerCase().includes('quota'))
      ).toBe(true)
    })

    it('falls back to Claude when Ollama unavailable', () => {
      const input = createInput({
        quotaPercent: 90,
        taskDescription: 'Fix a typo',
        ollamaAvailable: false
      })
      const result: PipelineResult = runPipeline(input)
      expect(result.recommendation.provider).toBe('anthropic')
    })
  })

  // ─── estimated impact ─────────────────────────────────────────────

  describe('estimated impact', () => {
    it('estimates 5 messages for simple tasks', () => {
      const input = createInput({ taskDescription: 'Fix a typo' })
      const result: PipelineResult = runPipeline(input)
      expect(result.estimatedImpact).toBe(5)
    })

    it('estimates 15 messages for moderate tasks', () => {
      const input = createInput({ taskDescription: 'Implement user profile page' })
      const result: PipelineResult = runPipeline(input)
      expect(result.estimatedImpact).toBe(15)
    })

    it('estimates 35 messages for complex tasks', () => {
      const input = createInput({ taskDescription: 'Refactor the entire auth system' })
      const result: PipelineResult = runPipeline(input)
      expect(result.estimatedImpact).toBe(35)
    })
  })

  // ─── performance ──────────────────────────────────────────────────

  describe('performance', () => {
    it('returns durationMs as a number', () => {
      const input = createInput()
      const result: PipelineResult = runPipeline(input)
      expect(typeof result.durationMs).toBe('number')
    })

    it('pipeline completes in under 500ms', () => {
      const input = createInput({ taskDescription: 'Refactor the entire architecture' })
      const result: PipelineResult = runPipeline(input)
      expect(result.durationMs).toBeLessThan(500)
    })

    it('durationMs is greater than 0', () => {
      const input = createInput()
      const result: PipelineResult = runPipeline(input)
      expect(result.durationMs).toBeGreaterThan(0)
    })
  })
})
