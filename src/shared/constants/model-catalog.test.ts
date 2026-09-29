import { describe, it, expect } from 'vitest'
import { CODEX_MODELS, CLAUDE_MODELS, latestClaudeModel } from './model-catalog'
import type { ModelCatalogEntry } from '../types/model.types'

describe('CODEX_MODELS', () => {
  it('has at least one entry', () => {
    expect(CODEX_MODELS.length).toBeGreaterThanOrEqual(1)
  })

  it('every entry has provider openai-codex', () => {
    for (const model of CODEX_MODELS) {
      expect(model.provider).toBe('openai-codex')
    }
  })

  it('every entry has category coding', () => {
    for (const model of CODEX_MODELS) {
      expect(model.category).toBe('coding')
    }
  })

  it('every entry has available true', () => {
    for (const model of CODEX_MODELS) {
      expect(model.available).toBe(true)
    }
  })
})

describe('latestClaudeModel', () => {
  const entry = (id: string, available = true): ModelCatalogEntry => ({
    id, name: id, provider: 'anthropic', category: 'mixed', contextWindow: 200000,
    available, supportsEffort: true, capabilityTier: 'expert', description: '',
  })

  it('returns the first available entry of the family in catalog order', () => {
    const catalog = [entry('claude-opus-9'), entry('claude-sonnet-9'), entry('claude-sonnet-8')]
    expect(latestClaudeModel('sonnet', catalog)).toBe('claude-sonnet-9')
  })

  it('falls back to the model below when the newest is unavailable', () => {
    const catalog = [entry('claude-sonnet-9', false), entry('claude-sonnet-8')]
    expect(latestClaudeModel('sonnet', catalog)).toBe('claude-sonnet-8')
  })

  it('throws when the family has no available entry instead of returning a stale id', () => {
    const catalog = [entry('claude-sonnet-9', false), entry('claude-opus-9')]
    expect(() => latestClaudeModel('sonnet', catalog)).toThrow(/sonnet/)
  })

  it('does not match a family by substring of another family', () => {
    const catalog = [entry('claude-opus-9'), entry('claude-haiku-9')]
    expect(() => latestClaudeModel('sonnet', catalog)).toThrow()
  })

  it('resolves every family used as a default against the real catalog', () => {
    for (const family of ['sonnet', 'opus', 'haiku'] as const) {
      const id = latestClaudeModel(family)
      const found = CLAUDE_MODELS.find((m) => m.id === id)
      expect(found?.available).toBe(true)
      expect(id.startsWith(`claude-${family}-`)).toBe(true)
    }
  })
})

describe('CLAUDE_MODELS ordering', () => {
  // latestClaudeModel relies on newest-first order within each family.
  // Date snapshot segments (8 digits) are ignored; missing segments count as 0.
  const versionOf = (id: string): number[] =>
    id.split('-').slice(2).filter((seg) => !/^\d{8}$/.test(seg)).map(Number)

  const compare = (a: number[], b: number[]): number => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0)
      if (diff !== 0) return diff
    }
    return 0
  }

  it('lists each family newest-first', () => {
    const byFamily = new Map<string, string[]>()
    for (const m of CLAUDE_MODELS) {
      const family = m.id.split('-')[1]
      byFamily.set(family, [...(byFamily.get(family) ?? []), m.id])
    }
    for (const [family, ids] of byFamily) {
      for (let i = 1; i < ids.length; i++) {
        expect(compare(versionOf(ids[i - 1]), versionOf(ids[i])), `${family}: ${ids[i - 1]} before ${ids[i]}`).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
