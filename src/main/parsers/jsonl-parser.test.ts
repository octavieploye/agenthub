import { describe, it, expect, vi } from 'vitest'
import { parseJsonlLine, parseJsonlContent, extractUsageEntries } from './jsonl-parser'
import type { SessionEntry } from '@shared/types/usage.types'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

// ── Fixtures ─────────────────────────────────────────────────────────

const VALID_ASSISTANT_LINE = JSON.stringify({
  type: 'assistant',
  timestamp: '2026-02-18T11:16:53.212Z',
  sessionId: '35300a85-abcd-1234-efgh-567890abcdef',
  message: {
    model: 'claude-opus-4-6',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello' }],
    usage: {
      input_tokens: 3,
      cache_creation_input_tokens: 6977,
      cache_read_input_tokens: 16871,
      output_tokens: 2,
      service_tier: 'standard'
    }
  }
})

const VALID_USER_LINE = JSON.stringify({
  type: 'user',
  timestamp: '2026-02-18T11:16:41.362Z',
  sessionId: '35300a85-abcd-1234-efgh-567890abcdef',
  message: {
    role: 'user',
    content: 'Write a test'
  }
})

const ASSISTANT_NO_USAGE_LINE = JSON.stringify({
  type: 'assistant',
  timestamp: '2026-02-18T11:17:00.000Z',
  sessionId: '35300a85-abcd-1234-efgh-567890abcdef',
  message: {
    model: 'claude-opus-4-6',
    role: 'assistant',
    content: [{ type: 'text', text: 'Acknowledged' }]
  }
})

const ASSISTANT_NO_CACHE_LINE = JSON.stringify({
  type: 'assistant',
  timestamp: '2026-02-18T11:18:00.000Z',
  sessionId: '35300a85-abcd-1234-efgh-567890abcdef',
  message: {
    model: 'claude-opus-4-6',
    role: 'assistant',
    content: [],
    usage: {
      input_tokens: 100,
      output_tokens: 50
    }
  }
})

// ── Tests ────────────────────────────────────────────────────────────

describe('jsonl-parser', () => {
  describe('parseJsonlLine', () => {
    it('parses a valid assistant entry with usage data', () => {
      const result = parseJsonlLine(VALID_ASSISTANT_LINE)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('assistant')
      expect(result!.timestamp).toBe('2026-02-18T11:16:53.212Z')
      expect(result!.sessionId).toBe('35300a85-abcd-1234-efgh-567890abcdef')
      expect(result!.message.role).toBe('assistant')
      expect(result!.message.model).toBe('claude-opus-4-6')
      expect(result!.message.usage).toBeDefined()
      expect(result!.message.usage!.input_tokens).toBe(3)
      expect(result!.message.usage!.output_tokens).toBe(2)
    })

    it('parses a valid user entry', () => {
      const result = parseJsonlLine(VALID_USER_LINE)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('user')
      expect(result!.timestamp).toBe('2026-02-18T11:16:41.362Z')
      expect(result!.sessionId).toBe('35300a85-abcd-1234-efgh-567890abcdef')
      expect(result!.message.role).toBe('user')
      expect(result!.message.model).toBeUndefined()
      expect(result!.message.usage).toBeUndefined()
    })

    it('returns null for empty string', () => {
      const result = parseJsonlLine('')
      expect(result).toBeNull()
    })

    it('returns null for malformed JSON', () => {
      const result = parseJsonlLine('{ this is not valid json }}}')
      expect(result).toBeNull()
    })

    it('returns null for JSON missing required type field', () => {
      const lineWithoutType = JSON.stringify({
        timestamp: '2026-02-18T11:16:53.212Z',
        sessionId: 'abc-123',
        message: { role: 'assistant' }
      })
      const result = parseJsonlLine(lineWithoutType)
      expect(result).toBeNull()
    })

    it('returns null for JSON missing message field', () => {
      const lineWithoutMessage = JSON.stringify({
        type: 'assistant',
        timestamp: '2026-02-18T11:16:53.212Z',
        sessionId: 'abc-123'
      })
      const result = parseJsonlLine(lineWithoutMessage)
      expect(result).toBeNull()
    })

    it('handles entry with no usage data (user type)', () => {
      const result = parseJsonlLine(VALID_USER_LINE)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('user')
      expect(result!.message.usage).toBeUndefined()
    })

    it('preserves optional cache token fields when present', () => {
      const result = parseJsonlLine(VALID_ASSISTANT_LINE)

      expect(result).not.toBeNull()
      expect(result!.message.usage!.cache_creation_input_tokens).toBe(6977)
      expect(result!.message.usage!.cache_read_input_tokens).toBe(16871)
    })

    it('defaults cache tokens to 0 when absent', () => {
      const result = parseJsonlLine(ASSISTANT_NO_CACHE_LINE)

      expect(result).not.toBeNull()
      expect(result!.message.usage).toBeDefined()
      expect(result!.message.usage!.input_tokens).toBe(100)
      expect(result!.message.usage!.output_tokens).toBe(50)
      expect(result!.message.usage!.cache_creation_input_tokens).toBe(0)
      expect(result!.message.usage!.cache_read_input_tokens).toBe(0)
    })
  })

  describe('parseJsonlContent', () => {
    it('parses multiple lines into array of SessionEntry', () => {
      const content = [VALID_ASSISTANT_LINE, VALID_USER_LINE].join('\n')
      const result = parseJsonlContent(content)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('assistant')
      expect(result[1].type).toBe('user')
    })

    it('skips empty lines', () => {
      const content = [VALID_USER_LINE, '', '', VALID_ASSISTANT_LINE].join('\n')
      const result = parseJsonlContent(content)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('user')
      expect(result[1].type).toBe('assistant')
    })

    it('skips malformed lines and continues parsing', () => {
      const content = [
        VALID_USER_LINE,
        '{ broken json {{{{',
        VALID_ASSISTANT_LINE
      ].join('\n')
      const result = parseJsonlContent(content)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('user')
      expect(result[1].type).toBe('assistant')
    })

    it('returns empty array for empty string', () => {
      const result = parseJsonlContent('')
      expect(result).toEqual([])
    })

    it('handles file with only one line', () => {
      const result = parseJsonlContent(VALID_ASSISTANT_LINE)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('assistant')
    })

    it('handles mixed valid and invalid lines', () => {
      const content = [
        '!@#$%^',
        VALID_USER_LINE,
        'null',
        JSON.stringify({ random: 'object' }),
        VALID_ASSISTANT_LINE,
        '',
        '{ "type": "assistant" }' // missing message field
      ].join('\n')
      const result = parseJsonlContent(content)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('user')
      expect(result[1].type).toBe('assistant')
    })
  })

  describe('extractUsageEntries', () => {
    const assistantWithUsage: SessionEntry = {
      type: 'assistant',
      timestamp: '2026-02-18T11:16:53.212Z',
      sessionId: 'session-1',
      message: {
        role: 'assistant',
        model: 'claude-opus-4-6',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 200,
          cache_read_input_tokens: 300
        }
      }
    }

    const assistantWithoutUsage: SessionEntry = {
      type: 'assistant',
      timestamp: '2026-02-18T11:17:00.000Z',
      sessionId: 'session-1',
      message: {
        role: 'assistant',
        model: 'claude-opus-4-6'
      }
    }

    const userEntry: SessionEntry = {
      type: 'user',
      timestamp: '2026-02-18T11:16:41.362Z',
      sessionId: 'session-1',
      message: {
        role: 'user'
      }
    }

    it('returns only assistant entries with usage data', () => {
      const entries = [assistantWithUsage, userEntry, assistantWithoutUsage]
      const result = extractUsageEntries(entries)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('assistant')
      expect(result[0].message.usage).toBeDefined()
    })

    it('filters out user entries', () => {
      const entries = [userEntry, userEntry, assistantWithUsage]
      const result = extractUsageEntries(entries)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(assistantWithUsage)
    })

    it('filters out assistant entries without usage', () => {
      const entries = [assistantWithoutUsage, assistantWithoutUsage]
      const result = extractUsageEntries(entries)

      expect(result).toHaveLength(0)
    })

    it('returns empty array when no matching entries', () => {
      const entries = [userEntry, assistantWithoutUsage]
      const result = extractUsageEntries(entries)

      expect(result).toEqual([])
    })

    it('preserves all usage fields in returned entries', () => {
      const entries = [assistantWithUsage]
      const result = extractUsageEntries(entries)

      expect(result).toHaveLength(1)
      const usage = result[0].message.usage!
      expect(usage.input_tokens).toBe(100)
      expect(usage.output_tokens).toBe(50)
      expect(usage.cache_creation_input_tokens).toBe(200)
      expect(usage.cache_read_input_tokens).toBe(300)
    })
  })
})
