import { describe, it, expect } from 'vitest'
import { filterTtsResponse } from './tts-response-filter'
import { stripAnsi } from './strip-ansi'

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

  it('removes "Thinking with high effort" extended thinking indicator', () => {
    const input = 'Thinking with high effort\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes "Thinking about this..." variant', () => {
    const input = 'Thinking about the architecture…\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes verbose Bootstrapping / Spelunking lines with trailing content', () => {
    const input = 'Bootstrapping the environment with dependencies\nHere is my answer.'
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

  // ── REMOVE: Claude CLI keyboard shortcut footer lines ────────────────
  it('removes "esc to interrupt" keyboard hint line', () => {
    const input = 'esc to interrupt\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes full Claude CLI footer: "Esc to interrupt  Ctrl+T to hide task  agent-manager.ts"', () => {
    const input = 'Esc to interrupt  Ctrl+T to hide task  agent-manager.ts\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes "esc to cancel  tab to amend" keyboard hint line', () => {
    const input = 'esc to cancel  tab to amend\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('removes "ctrl+T to hide task" keyboard hint line', () => {
    const input = 'ctrl+T to hide task in useAgentTts.ts\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('does NOT remove prose that mentions Ctrl or Esc mid-sentence', () => {
    const input = 'Press Esc to cancel is common UI advice.\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe(input)
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

  // ── PTY session noise (real data from Telegram debug logs) ──────────
  it('strips shell command lines', () => {
    expect(filterTtsResponse("clear; claude --model 'claude-sonnet-4-6' --effort low 'say hello'")).toBe('')
  })

  it('strips user@host prompt lines', () => {
    expect(filterTtsResponse('octaviesmacpro@macbookpro  ~/workspace/optimaeus  ↱ main')).toBe('')
  })

  it('strips ❯ prompt with echoed input', () => {
    expect(filterTtsResponse('❯ say hello                                         ')).toBe('')
  })

  it('strips non-SGR escape sequences from lines', () => {
    // \x1B= is DECKPAM (2 bytes), \x1B> is DECKPNM, \x1B[?1;2c is DA response
    const input = '\x1B=\x1B>Hello world\x1B[?1;2c'
    expect(filterTtsResponse(input)).toBe('Hello world')
  })

  it('extracts prose from full PTY session dump', () => {
    const input = [
      "clear; claude --model 'claude-sonnet-4-6' --effort low 'say hello'",
      '',
      'octaviesmacpro@macbookpro  ~/workspace/optimaeus  ↱ main',
      '╭─── Claude Code v2.1.83 ───╮',
      '│  Welcome back Master      │',
      '╰───────────────────────────╯',
      '',
      'Thinking…',
      '',
      'Hello! How can I help you today?',
      '',
      '❯ say hello                                              ',
      'esc to cancel  tab to amend',
    ].join('\n')
    expect(filterTtsResponse(input)).toBe('Hello! How can I help you today?')
  })

  // ── oh-my-zsh and prompt-prefixed command echoes ─────────────────────
  it('strips oh-my-zsh theme loading lines', () => {
    expect(filterTtsResponse("[oh-my-zsh] Random theme 'sunrise' loaded")).toBe('')
  })

  it('strips prompt-prefixed command echoes with clear; or claude --', () => {
    expect(filterTtsResponse(
      "--- optimaeus-projects/optimaeus ‹main*➔ ?› » cclear; claude --model 'claude-sonnet-4-6' --effort low 'say hello'"
    )).toBe('')
  })

  it('strips bare oh-my-zsh prompt lines (path + git info + prompt char)', () => {
    expect(filterTtsResponse('--- optimaeus-projects/optimaeus ‹main*➔ ?› »')).toBe('')
  })

  it('strips full oh-my-zsh startup noise and keeps only prose', () => {
    const input = [
      "[oh-my-zsh] Random theme 'sunrise' loaded",
      '',
      "--- optimaeus-projects/optimaeus ‹main*➔ ?› » cclear; claude --model 'claude-sonnet-4-6' --effort low 'say hello'",
      '',
      'Hello! I am happy to assist.',
    ].join('\n')
    expect(filterTtsResponse(input)).toBe('Hello! I am happy to assist.')
  })

  // ── CUP-separated lines (after stripAnsi converts CUP → \n) ──────
  it('extracts response when CUP sequences produced newline-separated lines', () => {
    // Simulates what stripAnsi now produces: CUP → \n gives each TUI region
    // its own line, so filterTtsResponse can classify them independently.
    // stripAnsi imported at top of file
    // Raw PTY: banner at row 1, spinner at row 5, response overwrites at row 5, prompt at row 30
    const rawPty = [
      '\x1b[1;1H\x1b[1m╭─── Claude Code ───╮\x1b[0m',
      '\x1b[2;1H\x1b[1m│ Welcome back     │\x1b[0m',
      '\x1b[3;1H\x1b[1m╰──────────────────╯\x1b[0m',
      '\x1b[5;1HThinking…',
      '\x1b[5;1HHello! I would be happy to help you today.',
      '\x1b[30;1H❯ ',
    ].join('')
    const stripped = stripAnsi(rawPty)
    const result = filterTtsResponse(stripped)
    expect(result).toBe('Hello! I would be happy to help you today.')
  })

  // ── Claude CLI search/activity lines (Bug 1 + 3) ─────────────────────

  it('filters out "Searching for N patterns, reading N files…" status line', () => {
    const input = 'Searching for 4 patterns, reading 5 files… (ctrl+o to expand)\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('filters out "Search(pattern: ...)" tool line', () => {
    const input = 'Search(pattern: "components/workflow/**/*.{ts,tsx}", path: "~/workspace")\nHere is my answer.'
    expect(filterTtsResponse(input)).toBe('Here is my answer.')
  })

  it('filters out "Reading N files…" status line', () => {
    expect(filterTtsResponse('Reading 5 files…')).toBe('')
  })

  it('filters out lines containing "(ctrl+o to expand)"', () => {
    expect(filterTtsResponse('some status (ctrl+o to expand)')).toBe('')
  })

  it('filters out thinking text mixed with terminal artifacts mid-line', () => {
    const input = 'n  n                                   thinking with high effort'
    expect(filterTtsResponse(input)).toBe('')
  })

  it('filters out "thinking with extended" anywhere in a line', () => {
    const input = '  R  n          thinking with extended thinking'
    expect(filterTtsResponse(input)).toBe('')
  })

  it('handles spinner overwrite followed by multi-line response via CUP', () => {
    // stripAnsi imported at top of file
    const rawPty = [
      '\x1b[3;1HAnalyzing…',
      '\x1b[3;1HThe root cause is in the parser.',
      '\x1b[4;1H',
      '\x1b[5;1HHere is the fix:',
      '\x1b[30;1Hesc to cancel  tab to amend',
    ].join('')
    const stripped = stripAnsi(rawPty)
    const result = filterTtsResponse(stripped)
    expect(result).toContain('The root cause is in the parser.')
    expect(result).toContain('Here is the fix:')
    expect(result).not.toContain('Analyzing')
    expect(result).not.toContain('esc to cancel')
  })
})
