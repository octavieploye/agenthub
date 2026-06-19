import { describe, it, expect } from 'vitest'
import { filterTtsResponse } from './tts-response-filter'

describe('filterTtsResponse', () => {
  // ── KEEP: plain prose ───────────────────────────────────────────────
  it('keeps plain prose paragraphs', () => {
    const input = 'The issue is in the agent manager.\n\nYou need to reset the buffer on each busy transition.'
    expect(filterTtsResponse(input)).toBe(input)
  })

  it('keeps markdown headings', () => {
    const input = '## Summary\n\nHere is what I found.'
    expect(filterTtsResponse(input)).toBe(input)
  })

  it('keeps markdown bullet lists', () => {
    const input = '- First point\n- Second point\n- Third point'
    expect(filterTtsResponse(input)).toBe(input)
  })

  it('keeps LLM-written fenced code blocks', () => {
    const input = 'Use this pattern:\n\n```typescript\nconst x = 1\n```'
    expect(filterTtsResponse(input)).toBe(input)
  })

  it('keeps bold and inline code', () => {
    const input = 'The **cleanTextBuffer** is reset when `status` becomes `busy`.'
    expect(filterTtsResponse(input)).toBe(input)
  })

  // ── REMOVE: spinner / thinking animation ────────────────────────────
  it('removes lines that are only braille spinner chars', () => {
    const input = '⠋\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes lines with thinking words emitted by Claude CLI', () => {
    const input = 'Thinking…\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes lines with decorative spinner chars only', () => {
    const input = '✻ \nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  // ── REMOVE: tool call lines ─────────────────────────────────────────
  it('removes tool call lines starting with ●', () => {
    const input = '● Read(src/main/services/agent-manager.ts)\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes tool continuation lines starting with ⎿', () => {
    const input = '⎿  42 lines\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes tool status lines starting with ✓', () => {
    const input = '✓ Completed\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes lines starting with ⏺', () => {
    const input = '⏺ Running bash command\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  // ── REMOVE: tool result blocks (indented after tool line) ────────────
  it('removes indented lines that follow a tool call line', () => {
    const input = [
      '● Read(src/foo.ts)',
      '  const x = 1',
      '  const y = 2',
      '',
      'Here is my answer.',
    ].join('\n')
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('does NOT remove indented lines that are part of LLM fenced code block', () => {
    const input = 'Here is the fix:\n\n```typescript\n  const x = 1\n  const y = 2\n```'
    expect(filterTtsResponse(input)).toBe(input)
  })

  // ── REMOVE: system banners / notifications ───────────────────────────
  it('removes lines containing box-drawing characters', () => {
    const input = '╭─ Update available! ─╮\n│ Run: brew upgrade claude-code │\n╰──────────────────────╯\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes "Update available" notification lines', () => {
    const input = 'Update available! Run: brew upgrade claude-code\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  // ── REMOVE: prompt chrome ────────────────────────────────────────────
  it('removes the ❯ prompt line', () => {
    const input = '❯ \nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes approval prompt lines', () => {
    const input = '? Do you want to proceed (y/n)\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  // ── REMOVE: empty / whitespace-only lines between paragraphs ─────────
  it('collapses multiple blank lines into a single blank line', () => {
    const input = 'First paragraph.\n\n\n\nSecond paragraph.'
    expect(filterTtsResponse(input)).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('returns empty string if everything is filtered', () => {
    const input = '● Read(foo.ts)\n⎿  10 lines\n⠋\n❯ '
    expect(filterTtsResponse(input)).toBe('')
  })

  // ── EDGE CASES ────────────────────────────────────────────────────────
  it('does NOT filter ● that appears mid-line in LLM prose', () => {
    const input = 'The ● symbol is used as a bullet in some CLIs.'
    expect(filterTtsResponse(input)).toBe(input)
  })

  it('does NOT drop prose lines that contain a box-drawing char mid-line', () => {
    // BOX_DRAWING_RE must be anchored to line-start; mid-line occurrences in prose
    // (e.g. describing the │ character) must be preserved.
    const input = 'The │ character is used for vertical borders in terminal UIs.'
    expect(filterTtsResponse(input)).toBe(input)
  })

  it('does NOT drop indented prose after a double blank line following a tool result', () => {
    // After 2+ blank lines the tool_result context must be reset so indented
    // LLM prose (e.g. a preformatted paragraph) is kept.
    const input = [
      '● Read(src/foo.ts)',
      '  file content line 1',
      '  file content line 2',
      '',
      '',
      '  This indented prose comes after a paragraph break and must be kept.',
    ].join('\n')
    expect(filterTtsResponse(input)).toBe('  This indented prose comes after a paragraph break and must be kept.')
  })

  it('handles a realistic mixed response', () => {
    const input = [
      '⠋',
      '● Read(src/main/services/agent-manager.ts)',
      '⎿  276 lines',
      '  import * as pty from \'node-pty\'',
      '  import { BrowserWindow } from \'electron\'',
      '',
      'Thinking…',
      '',
      '● Update(src/main/services/agent-manager.ts)',
      '⎿  Updated 2 lines',
      '',
      'The root cause is that `cleanTextBuffer` accumulates all PTY output.',
      '',
      'Here is what I changed:',
      '',
      '```typescript',
      'if (newStatus === \'completed\' && current.cleanTextBuffer.trim()) {',
      '}',
      '```',
      '',
      '❯ ',
    ].join('\n')

    const expected = [
      'The root cause is that `cleanTextBuffer` accumulates all PTY output.',
      '',
      'Here is what I changed:',
      '',
      '```typescript',
      'if (newStatus === \'completed\' && current.cleanTextBuffer.trim()) {',
      '}',
      '```',
    ].join('\n')

    expect(filterTtsResponse(input)).toBe(expected)
  })
})
