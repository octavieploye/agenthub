import { Terminal } from '@xterm/headless'

export class HeadlessTerminalBuffer {
  private terminal: Terminal

  constructor(cols = 120, rows = 30) {
    this.terminal = new Terminal({ cols, rows, scrollback: 1000 })
  }

  /** Feed raw PTY data (with ANSI sequences) into the virtual terminal */
  write(data: string): void {
    this.terminal.write(data)
  }

  /**
   * Extract all non-empty lines from the terminal buffer as clean text.
   * Reads from scrollback + active viewport.
   * xterm.js correctly handles cursor positioning, overwrites, and scrolling,
   * so the extracted text is exactly what a user would see on screen.
   */
  extractText(): string {
    const buffer = this.terminal.buffer.active
    const lines: string[] = []
    // Read from the top of scrollback through the end of the viewport
    const totalRows = buffer.length
    for (let i = 0; i < totalRows; i++) {
      const line = buffer.getLine(i)
      if (line) {
        const text = line.translateToString(true) // true = trim trailing whitespace
        lines.push(text)
      }
    }
    // Join and trim -- collapse trailing empty lines
    return lines.join('\n').replace(/\n+$/, '')
  }

  /** Resize the virtual terminal (call when the real PTY is resized) */
  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows)
  }

  /** Clean up resources */
  dispose(): void {
    this.terminal.dispose()
  }
}
