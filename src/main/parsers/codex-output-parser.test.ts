import { describe, it, expect, beforeEach } from 'vitest'
import { CodexCliOutputParser } from './codex-output-parser'
import { createParser } from './cli-output-parser'

describe('CodexCliOutputParser', () => {
  let parser: CodexCliOutputParser

  beforeEach(() => {
    parser = new CodexCliOutputParser()
  })

  describe('approval pattern detection', () => {
    it('detects [a]pprove as awaiting_approval', () => {
      const result = parser.parse('[a]pprove')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects [d]eny as awaiting_approval', () => {
      const result = parser.parse('[d]eny')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects approve / deny as awaiting_approval', () => {
      const result = parser.parse('approve / deny')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })

    it('detects "Do you want to allow" as awaiting_approval', () => {
      const result = parser.parse('Do you want to allow this action?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })
  })

  describe('busy pattern detection', () => {
    it('detects "Thinking..." as busy', () => {
      const result = parser.parse('Thinking...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects "Working..." as busy', () => {
      const result = parser.parse('Working...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects "Executing..." as busy', () => {
      const result = parser.parse('Executing...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects braille spinner as busy', () => {
      const result = parser.parse('\u28CB processing...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })
  })

  describe('completed pattern detection', () => {
    it('detects "Done" as completed', () => {
      const result = parser.parse('Done')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })

    it('detects "Completed" as completed', () => {
      const result = parser.parse('Completed')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })

    it('detects checkmark as completed', () => {
      const result = parser.parse('\u2713 All tasks completed')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })
  })

  describe('locked (waiting input) detection', () => {
    it('detects > prompt as locked', () => {
      const result = parser.parse('> ')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects "waiting for input" as locked', () => {
      const result = parser.parse('waiting for input')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })
  })

  describe('completed pattern detection (tightened)', () => {
    it('detects "Done" alone on a line as completed', () => {
      const result = parser.parse('\nDone\n')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })

    it('does NOT false-positive on "Done" inside code output', () => {
      const result = parser.parse('console.log("Done processing items")')
      // Should not match — "Done" is mid-line inside code
      expect(result).toBeNull()
    })

    it('detects checkmark + completed as completed', () => {
      const result = parser.parse('✓ Task completed successfully')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })
  })

  describe('no match', () => {
    it('returns null for unrecognized output', () => {
      const result = parser.parse('some random text without patterns')
      expect(result).toBeNull()
    })
  })

  describe('buffer management', () => {
    it('resets buffer after match', () => {
      parser.parse('Thinking...')
      const result = parser.parse('some random text')
      expect(result).toBeNull()
    })

    it('accumulates buffer for multi-chunk patterns', () => {
      parser.parse('Do you want ')
      const result = parser.parse('to allow this?')
      expect(result).toEqual({ status: 'awaiting_approval', confidence: 'inferred' })
    })
  })

  describe('rate_limited detection', () => {
    it('detects "Usage limit exceeded" as rate_limited', () => {
      const result = parser.parse('Usage limit exceeded for this model')
      expect(result).toEqual({ status: 'rate_limited', confidence: 'confirmed' })
    })

    it('detects "Pro plan limit" as rate_limited', () => {
      const result = parser.parse('Pro plan limit reached. Try again later.')
      expect(result).toEqual({ status: 'rate_limited', confidence: 'confirmed' })
    })

    it('detects "too many requests" as rate_limited', () => {
      const result = parser.parse('Error: too many requests')
      expect(result).toEqual({ status: 'rate_limited', confidence: 'confirmed' })
    })

    it('detects "rate limit" as rate_limited', () => {
      const result = parser.parse('rate limit hit, please wait')
      expect(result).toEqual({ status: 'rate_limited', confidence: 'confirmed' })
    })

    it('detects HTTP 429 as rate_limited', () => {
      const result = parser.parse('HTTP 429')
      expect(result).toEqual({ status: 'rate_limited', confidence: 'confirmed' })
    })

    it('does NOT false-positive on normal code output', () => {
      const result = parser.parse('console.log("processing items")')
      expect(result).toBeNull()
    })
  })

  describe('parser interface', () => {
    it('returns correct parser name', () => {
      expect(parser.getParserName()).toBe('codex-cli-v1')
    })
  })
})

describe('createParser with provider', () => {
  it('returns CodexCliOutputParser for openai-codex provider', () => {
    const parser = createParser('openai-codex')
    expect(parser.getParserName()).toBe('codex-cli-v1')
  })

  it('returns ClaudeCliOutputParser for anthropic provider', () => {
    const parser = createParser('anthropic')
    expect(parser.getParserName()).toBe('claude-cli-v1')
  })

  it('returns ClaudeCliOutputParser when no provider specified', () => {
    const parser = createParser()
    expect(parser.getParserName()).toBe('claude-cli-v1')
  })

  it('returns ClaudeCliOutputParser for ollama-local provider', () => {
    const parser = createParser('ollama-local')
    expect(parser.getParserName()).toBe('claude-cli-v1')
  })
})
