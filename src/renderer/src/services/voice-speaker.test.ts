import { describe, it, expect } from 'vitest'
import { isReadableParagraph } from './voice-speaker'

describe('isReadableParagraph', () => {
  // UI chrome fragments that must be blocked
  it('rejects Claude CLI keyboard hint line (too short)', () => {
    expect(isReadableParagraph('esc to cancel tab to amend')).toBe(false)
  })

  it('rejects a 7-word sentence fragment', () => {
    expect(isReadableParagraph('string to write the filter against precisely.')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isReadableParagraph('')).toBe(false)
  })

  it('rejects whitespace-only', () => {
    expect(isReadableParagraph('   \n  ')).toBe(false)
  })

  it('rejects very short UI chrome (fewer than 10 words)', () => {
    expect(isReadableParagraph('ask to cancel')).toBe(false)
    expect(isReadableParagraph('tab to amend response')).toBe(false)
  })

  // Real prose that must pass
  it('accepts a full sentence with 10+ words', () => {
    expect(isReadableParagraph('The root cause is that cleanTextBuffer accumulates all PTY output across sessions.')).toBe(true)
  })

  it('accepts a paragraph with multiple sentences', () => {
    const text = 'I found the bug. The buffer reset check used the debounced status instead of the real-time one.'
    expect(isReadableParagraph(text)).toBe(true)
  })

  it('accepts exactly 10 words', () => {
    expect(isReadableParagraph('one two three four five six seven eight nine ten')).toBe(true)
  })

  it('rejects exactly 9 words', () => {
    expect(isReadableParagraph('one two three four five six seven eight nine')).toBe(false)
  })
})
