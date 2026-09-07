import type { SBARHandoff } from '@shared/types/recovery.types'

// Strips ANSI escape codes from terminal output
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
}

// Returns the last `n` lines of `content` as a single string
export function extractTail(content: string, n: number): string {
  if (!content) return ''
  const lines = content.split('\n')
  return lines.slice(Math.max(0, lines.length - n)).join('\n')
}

export const MAX_CONTINUATION_PROMPT = 4000

export function buildContinuationPrompt(sbar: SBARHandoff | null, tail: string): string {
  if (!sbar) {
    const raw = [
      'Continue the work from the previous agent session.',
      '',
      '## Last terminal output (tail)',
      '',
      tail || '(no output recorded)',
    ].join('\n')
    return truncatePrompt(raw)
  }

  const raw = [
    'Continue the work from the previous agent session.',
    '',
    '## Summary of where we left off',
    '',
    `**Situation:** ${sbar.situation}`,
    `**Background:** ${sbar.background}`,
    `**Assessment:** ${sbar.assessment}`,
    `**Recommendation:** ${sbar.recommendation}`,
    '',
    '## Last terminal output (tail)',
    '',
    tail || '(no output recorded)',
    '',
    '## Next step',
    '',
    sbar.recommendation,
  ].join('\n')
  return truncatePrompt(raw)
}

const TRUNCATION_SUFFIX = '\n... [truncated for length]'

function truncatePrompt(text: string): string {
  if (text.length <= MAX_CONTINUATION_PROMPT) return text
  return text.slice(0, MAX_CONTINUATION_PROMPT - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX
}
