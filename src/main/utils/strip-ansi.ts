// src/main/utils/strip-ansi.ts

/**
 * Strips ANSI escape sequences from PTY output.
 * Handles cursor-right movements (\x1b[nC) by replacing with equivalent spaces
 * so word-wrapped lines stay readable after stripping.
 */
export function stripAnsi(text: string): string {
  return text
    // Cursor-right (\x1b[nC) → equivalent spaces so word-wrapped lines stay readable
    .replace(/\x1b\[(\d+)C/g, (_m, n) => ' '.repeat(Number(n)))
    // CSI sequences: parameter bytes 0x30–0x3F (0-9 ; < = > ?), optional intermediate
    // bytes 0x20–0x2F, final byte 0x40–0x7E.  Covers SGR, DEC private modes (?),
    // kitty keyboard protocol (>), and other extended sequences.
    .replace(/\x1b\[[0-9;<=?>!]*[ -\/]*[a-zA-Z@\[\]\\^_`{|}~]/g, '')
    // OSC sequences (e.g. window title)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Shift-in / Shift-out charset switching
    .replace(/\x0f|\x0e/g, '')
    // Backspace characters (terminal echo artefacts like c\bclaude)
    .replace(/\x08/g, '')
    // Bare BEL character (terminal bell — not part of prose)
    .replace(/\x07/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}
