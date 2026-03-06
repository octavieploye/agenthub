import { describe, it, expect, beforeEach } from 'vitest'
import { ClaudeCliOutputParser } from './cli-output-parser'

describe('ClaudeCliOutputParser', () => {
  let parser: ClaudeCliOutputParser

  beforeEach(() => {
    parser = new ClaudeCliOutputParser()
  })

  describe('locked state detection', () => {
    it('detects prompt character as locked', () => {
      const result = parser.parse('? Do you want to proceed?')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects y/n prompt as locked', () => {
      const result = parser.parse('Continue? (y/n)')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })

    it('detects approve/deny prompt as locked', () => {
      const result = parser.parse('Do you want to approve this action?')
      expect(result).toEqual({ status: 'locked', confidence: 'inferred' })
    })
  })

  describe('completed state detection', () => {
    it('detects task completed', () => {
      const result = parser.parse('task completed successfully')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })

    it('detects checkmark completion', () => {
      const result = parser.parse('✓ All tasks completed')
      expect(result).toEqual({ status: 'completed', confidence: 'inferred' })
    })
  })

  describe('busy state detection', () => {
    it('detects spinner as busy', () => {
      const result = parser.parse('⠋ Processing...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects thinking indicator as busy', () => {
      const result = parser.parse('thinking...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })

    it('detects writing indicator as busy', () => {
      const result = parser.parse('writing file...')
      expect(result).toEqual({ status: 'busy', confidence: 'inferred' })
    })
  })

  describe('no match', () => {
    it('returns null for unrecognized output', () => {
      const result = parser.parse('some random text')
      expect(result).toBeNull()
    })
  })

  describe('buffer management', () => {
    it('maintains buffer across calls', () => {
      parser.parse('some earlier output\n')
      const result = parser.parse('? Do you approve?')
      expect(result?.status).toBe('locked')
    })

    it('resets buffer', () => {
      parser.parse('? prompt')
      parser.resetBuffer()
      const result = parser.parse('some random text')
      expect(result).toBeNull()
    })
  })

  describe('parser interface', () => {
    it('returns parser name', () => {
      expect(parser.getParserName()).toBe('claude-cli-v1')
    })
  })
})
