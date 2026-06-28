import { describe, it, expect } from 'vitest'
import { filterTelegramResponse } from './telegram-response-filter'

describe('filterTelegramResponse', () => {
  // ── KEEP: prose ───────────────────────────────────────────────────
  it('keeps plain prose paragraphs', () => {
    const input = 'The issue is in the agent manager.\n\nYou need to reset the buffer.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps markdown headings', () => {
    const input = '## Summary\n\nHere is what I found.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps markdown bullet lists', () => {
    const input = '- First point\n- Second point\n- Third point'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps bold and inline code', () => {
    const input = 'The **cleanTextBuffer** is reset when `status` becomes `busy`.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  // ── KEEP: fenced code blocks ──────────────────────────────────────
  it('keeps LLM-written fenced code blocks', () => {
    const input = 'Use this pattern:\n\n```typescript\nconst x = 1\n```'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps spinner-like content inside fenced code blocks', () => {
    const input = '```\nThinking…\n⠋ loading\n```'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  // ── KEEP: tool call and result lines (unlike TTS) ─────────────────
  it('keeps tool call lines starting with ●', () => {
    const input = '● Read(src/main/services/agent-manager.ts)\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps tool continuation lines starting with ⎿', () => {
    const input = '⎿  42 lines\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps tool status lines starting with ✓', () => {
    const input = '✓ Completed\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps tool status lines starting with ✗', () => {
    const input = '✗ Failed with error\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps tool lines starting with ⏺', () => {
    const input = '⏺ Running bash command\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  it('keeps indented tool result blocks', () => {
    const input = [
      '● Read(src/foo.ts)',
      '  const x = 1',
      '  const y = 2',
      '',
      'Here is my answer.',
    ].join('\n')
    expect(filterTelegramResponse(input)).toBe(input)
  })

  // ── REMOVE: spinners ──────────────────────────────────────────────
  it('removes braille spinner lines', () => {
    const input = '⠋\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes thinking indicator lines', () => {
    const input = 'Thinking…\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes extended thinking lines', () => {
    const input = 'Thinking with high effort\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes decorative spinner-only lines', () => {
    const input = '✻ \nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes single-word ellipsis spinners', () => {
    const input = 'Reticulating…\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  // ── REMOVE: banners ───────────────────────────────────────────────
  it('removes box-drawing banner lines', () => {
    const input = '╭─── Claude Code ───╮\n│ Welcome back │\n╰──────────────────╯\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes update available banners', () => {
    const input = 'Update available! Run: brew upgrade claude-code\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes block element banner lines', () => {
    const input = '▐▛▜▌▝▘█\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  // ── REMOVE: prompts ───────────────────────────────────────────────
  it('removes keyboard hint lines', () => {
    const input = 'esc to interrupt\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes full keyboard footer', () => {
    const input = 'Esc to interrupt  Ctrl+T to hide task  agent-manager.ts\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes ❯ prompt line', () => {
    const input = '❯ \nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes approval prompt lines', () => {
    const input = '? Do you want to proceed (y/n)\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  it('removes shell command echoes', () => {
    expect(filterTelegramResponse("clear; claude --model 'claude-sonnet-4-6' 'say hello'")).toBe('')
  })

  it('removes oh-my-zsh lines', () => {
    expect(filterTelegramResponse("[oh-my-zsh] Random theme 'sunrise' loaded")).toBe('')
  })

  it('removes bare prompt lines', () => {
    expect(filterTelegramResponse('--- optimaeus-projects/optimaeus ‹main*➔ ?› »')).toBe('')
  })

  it('removes permission prompt lines', () => {
    const input = 'bypass permissions for this session\nHere is my answer.'
    expect(filterTelegramResponse(input)).toBe('Here is my answer.')
  })

  // ── REMOVE: ANSI residue ──────────────────────────────────────────
  it('strips residual escape sequences', () => {
    const input = '\x1B=\x1B>Hello world\x1B[?1;2c'
    expect(filterTelegramResponse(input)).toBe('Hello world')
  })

  it('strips BEL and backspace characters', () => {
    const input = 'Hello\x07 world\x08!'
    expect(filterTelegramResponse(input)).toBe('Hello world!')
  })

  // ── EDGE CASES ────────────────────────────────────────────────────
  it('returns empty string for empty input', () => {
    expect(filterTelegramResponse('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(filterTelegramResponse('   \n  \n   ')).toBe('')
  })

  it('returns empty string when everything is filtered', () => {
    const input = '⠋\n❯ \nesc to cancel'
    expect(filterTelegramResponse(input)).toBe('')
  })

  it('collapses multiple blank lines into a single blank line', () => {
    const input = 'First paragraph.\n\n\n\nSecond paragraph.'
    expect(filterTelegramResponse(input)).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('does NOT filter ● mid-line in prose', () => {
    const input = 'The ● symbol is used as a bullet.'
    expect(filterTelegramResponse(input)).toBe(input)
  })

  // ── REALISTIC MIXED CONTENT ───────────────────────────────────────
  it('handles a realistic agent response with tools + prose + code', () => {
    const input = [
      '⠋',
      '● Read(src/main/services/agent-manager.ts)',
      '⎿  276 lines',
      '',
      'Thinking…',
      '',
      '● Edit(src/main/services/agent-manager.ts)',
      '⎿  Updated 2 lines',
      '✓ Completed',
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
      'esc to cancel  tab to amend',
    ].join('\n')

    const expected = [
      '● Read(src/main/services/agent-manager.ts)',
      '⎿  276 lines',
      '',
      '● Edit(src/main/services/agent-manager.ts)',
      '⎿  Updated 2 lines',
      '✓ Completed',
      '',
      'The root cause is that `cleanTextBuffer` accumulates all PTY output.',
      '',
      'Here is what I changed:',
      '',
      '```typescript',
      'if (newStatus === \'completed\' && current.cleanTextBuffer.trim()) {',
      '}',
      '```',
    ].join('\n')

    expect(filterTelegramResponse(input)).toBe(expected)
  })

  it('keeps full PTY session prose with tool context', () => {
    const input = [
      "[oh-my-zsh] Random theme 'sunrise' loaded",
      '',
      "--- optimaeus-projects/optimaeus ‹main*➔ ?› » cclear; claude --model 'claude-sonnet-4-6' 'fix the bug'",
      '',
      '╭─── Claude Code v2.1.83 ───╮',
      '│  Welcome back Master      │',
      '╰───────────────────────────╯',
      '',
      'Thinking…',
      '',
      '● Read(src/bug.ts)',
      '⎿  50 lines',
      '',
      'I found the issue. The variable is undefined on line 42.',
      '',
      '● Edit(src/bug.ts)',
      '⎿  Fixed 1 line',
      '✓ Done',
      '',
      '❯ ',
      'esc to cancel  tab to amend',
    ].join('\n')

    const result = filterTelegramResponse(input)
    expect(result).toContain('● Read(src/bug.ts)')
    expect(result).toContain('⎿  50 lines')
    expect(result).toContain('I found the issue.')
    expect(result).toContain('● Edit(src/bug.ts)')
    expect(result).toContain('✓ Done')
    expect(result).not.toContain('oh-my-zsh')
    expect(result).not.toContain('Claude Code')
    expect(result).not.toContain('Thinking')
    expect(result).not.toContain('esc to cancel')
  })
})
