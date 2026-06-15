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

export function buildContinuationPrompt(sbar: SBARHandoff | null, tail: string): string {
  if (!sbar) {
    return [
      'Continue the work from the previous agent session.',
      '',
      '## Last terminal output (tail)',
      '',
      tail || '(no output recorded)',
    ].join('\n')
  }

  return [
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
}
