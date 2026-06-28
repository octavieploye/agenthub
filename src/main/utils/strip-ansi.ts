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
    // Cursor-positioning CSI sequences → newline (preserves line structure for
    // downstream regex that uses ^ anchors).  Covers: cursor home (\x1b[H),
    // cursor up/down (\x1b[nA / \x1b[nB), cursor position (\x1b[n;mH / \x1b[n;mf),
    // cursor horizontal absolute (\x1b[nG), cursor next/prev line (\x1b[nE / \x1b[nF),
    // cursor vertical absolute (\x1b[nd).
    .replace(/\x1b\[\d*(?:;\d+)*[ABHfGEFd]/g, '\n')
    // CSI sequences: parameter bytes 0x30–0x3F (0-9 ; < = > ?), optional intermediate
    // bytes 0x20–0x2F, final byte 0x40–0x7E.  Covers SGR, DEC private modes (?),
    // kitty keyboard protocol (>), and other extended sequences.
    .replace(/\x1b\[[0-9;<=?>!]*[ -\/]*[a-zA-Z@\[\]\\^_`{|}~]/g, '')
    // Two-byte escape sequences: RIS (\x1bc), DECKPAM (\x1b=), DECKPNM (\x1b>),
    // SS2/SS3, charset designators (\x1b(, \x1b)), etc.
    .replace(/\x1b[()#=>\x60-\x7e]/g, '')
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
    // Collapse runs of 3+ newlines into exactly 2 (one blank line max)
    .replace(/\n{3,}/g, '\n\n')
}
