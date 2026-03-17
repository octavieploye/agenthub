import { describe, it, expect } from 'vitest'
import { getShortModelName } from './model-utils'

describe('getShortModelName', () => {
  it('maps known Claude models', () => {
    expect(getShortModelName('claude-opus-4-6')).toBe('Opus 4.6')
    expect(getShortModelName('claude-sonnet-4-6')).toBe('Sonnet 4.6')
    expect(getShortModelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(getShortModelName('claude-3-5-sonnet-20241022')).toBe('Sonnet 3.5')
    expect(getShortModelName('claude-3-opus-20240229')).toBe('Opus 3')
  })

  it('handles ollama model:tag format', () => {
    expect(getShortModelName('llama3.3:70b')).toBe('Llama3.3 70B')
    expect(getShortModelName('deepseek-r1:32b')).toBe('Deepseek R1 32B')
    expect(getShortModelName('qwen2.5-coder:32b')).toBe('Qwen2.5 Coder 32B')
  })

  it('returns unknown models as-is', () => {
    expect(getShortModelName('gpt-4o')).toBe('gpt-4o')
  })
})
