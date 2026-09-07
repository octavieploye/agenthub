import { describe, it, expect } from 'vitest'
import { buildContinuationPrompt, stripAnsi, extractTail, MAX_CONTINUATION_PROMPT } from './buildContinuationPrompt'
import type { SBARHandoff } from '@shared/types/recovery.types'

const mockSbar: SBARHandoff = {
  id: 'sbar-1',
  agentId: 'agent-1',
  agentName: 'dev-backend',
  repoId: '/workspace/myapp',
  situation: 'Agent was implementing the commit handler in GitPanel',
  background: 'Working in src/renderer/src/widgets/git-panel/',
  assessment: 'Completed 80% — panel renders but onCommit is not wired to IPC',
  recommendation: 'Wire onCommit callback to window.agentHub.git.commit()',
  createdAt: '2026-06-15T10:00:00Z'
}

describe('stripAnsi', () => {
  it('removes ANSI escape codes', () => {
    expect(stripAnsi('\x1b[32mhello\x1b[0m world')).toBe('hello world')
  })

  it('passes plain text through unchanged', () => {
    expect(stripAnsi('plain text')).toBe('plain text')
  })
})

describe('extractTail', () => {
  it('returns last N lines of content', () => {
    const content = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n')
    const tail = extractTail(content, 50)
    const lines = tail.split('\n')
    expect(lines).toHaveLength(50)
    expect(lines[0]).toBe('line 50')
    expect(lines[49]).toBe('line 99')
  })

  it('returns all lines when content has fewer than N lines', () => {
    const content = 'line a\nline b\nline c'
    expect(extractTail(content, 50)).toBe('line a\nline b\nline c')
  })

  it('returns empty string for empty content', () => {
    expect(extractTail('', 50)).toBe('')
  })
})

describe('buildContinuationPrompt', () => {
  it('includes all SBAR fields', () => {
    const prompt = buildContinuationPrompt(mockSbar, 'last output line')
    expect(prompt).toContain(mockSbar.situation)
    expect(prompt).toContain(mockSbar.background)
    expect(prompt).toContain(mockSbar.assessment)
    expect(prompt).toContain(mockSbar.recommendation)
  })

  it('includes the tail', () => {
    const prompt = buildContinuationPrompt(mockSbar, 'last output line')
    expect(prompt).toContain('last output line')
  })

  it('repeats recommendation as the next step', () => {
    const prompt = buildContinuationPrompt(mockSbar, '')
    const count = (prompt.match(new RegExp(mockSbar.recommendation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('handles null sbar gracefully', () => {
    const prompt = buildContinuationPrompt(null, 'some tail')
    expect(prompt).toContain('some tail')
    expect(typeof prompt).toBe('string')
  })

  it('caps output at MAX_CONTINUATION_PROMPT chars', () => {
    const longTail = 'x'.repeat(5000)
    const result = buildContinuationPrompt(null, longTail)
    expect(result.length).toBeLessThanOrEqual(MAX_CONTINUATION_PROMPT)
    expect(result).toContain('[truncated for length]')
  })

  it('does not truncate short prompts', () => {
    const result = buildContinuationPrompt(null, 'short')
    expect(result).not.toContain('[truncated')
  })

  it('caps SBAR prompt with large fields', () => {
    const bigSbar = {
      ...mockSbar,
      situation: 'a'.repeat(2000),
      background: 'b'.repeat(2000),
      assessment: 'c'.repeat(2000),
      recommendation: 'd'.repeat(2000)
    }
    const result = buildContinuationPrompt(bigSbar, 'tail')
    expect(result.length).toBeLessThanOrEqual(MAX_CONTINUATION_PROMPT)
  })
})
