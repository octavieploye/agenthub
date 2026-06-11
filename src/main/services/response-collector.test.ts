import { describe, it, expect } from 'vitest'
import { parseStreamJsonLine } from './response-collector'

describe('parseStreamJsonLine', () => {
  it('extracts text from content_block_delta with text_delta', () => {
    const line = JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello world' }
    })
    expect(parseStreamJsonLine(line)).toBe('Hello world')
  })

  it('returns null for tool use deltas', () => {
    const line = JSON.stringify({
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '{"f' }
    })
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('returns null for message_start events', () => {
    const line = JSON.stringify({ type: 'message_start', message: { id: 'msg_1' } })
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('returns null for empty or non-JSON lines', () => {
    expect(parseStreamJsonLine('')).toBeNull()
    expect(parseStreamJsonLine('not json')).toBeNull()
  })
})
