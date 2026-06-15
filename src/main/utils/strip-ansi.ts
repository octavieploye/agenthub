// src/main/utils/strip-ansi.ts

/**
 * Strips ANSI escape sequences from PTY output.
 * Handles cursor-right movements (\x1b[nC) by replacing with equivalent spaces
 * so word-wrapped lines stay readable after stripping.
 */
export function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[(\d+)C/g, (_m, n) => ' '.repeat(Number(n)))
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x0f|\x0e/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}
