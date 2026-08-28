import { describe, it, expect } from 'vitest'
import { CODEX_MODELS } from './model-catalog'

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
