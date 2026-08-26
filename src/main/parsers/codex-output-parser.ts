import type { CliOutputParser, ParsedStatus } from './cli-output-parser'
import { stripAnsi } from '../utils/strip-ansi'

const CODEX_PATTERNS = {
  awaiting_approval: [
    /\[a\]pprove/i,
    /\[d\]eny/i,
    /approve\s*\/\s*deny/i,
    /Do you want to allow/i,
    /\(y\/n\)/i,
    /\[yes\/no\]/i,
  ],
  waiting_input: [
    /^>\s*$/m,
    /waiting for (?:input|response)/i,
    /press enter/i,
  ],
  completed: [
    /^\s*(?:Done|Completed)\.?\s*$/m,         // "Done" or "Completed" alone on a line
    /✓.*(?:completed|done|finished)/i,        // checkmark prefix (matches Claude parser)
    /\u2713/,                                 // bare checkmark ✓
    /task completed/i,
    /all done/i,
    /session ended/i,
  ],
  busy: [
    /\u28CB|\u28D9|\u28F9|\u28F8|\u28FC|\u28F4|\u28E6|\u28E7|\u28C7|\u28CF/,  // braille spinners
    /Thinking\.\.\./i,
    /Working\.\.\./i,
    /Executing\.\.\./i,
    /Processing\.\.\./i,
    /thinking\b/i,
  ],
}

export class CodexCliOutputParser implements CliOutputParser {
  private buffer = ''
  private readonly maxBufferSize = 4096
  private statusTransitions: { status: string; timestamp: number }[] = []
  private readonly loopingThreshold = 25
  private readonly loopingWindowMs = 30_000
  private readonly createdAt: number
  private readonly startupGraceMs: number

  constructor(opts?: { startupGraceMs?: number }) {
    this.createdAt = Date.now()
    this.startupGraceMs = opts?.startupGraceMs ?? 45_000
  }

  getParserName(): string {
    return 'codex-cli-v1'
  }

  parse(output: string): ParsedStatus | null {
    this.buffer += output
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize)
    }

    const recentOutput = stripAnsi(this.buffer.slice(-1024))

    // Check for approval prompts — highest priority
    for (const pattern of CODEX_PATTERNS.awaiting_approval) {
      if (pattern.test(recentOutput)) {
        this.buffer = ''
        this.statusTransitions = []
        return { status: 'awaiting_approval', confidence: 'inferred' }
      }
    }

    // Check for completion
    for (const pattern of CODEX_PATTERNS.completed) {
      if (pattern.test(recentOutput)) {
        this.buffer = ''
        return { status: 'completed', confidence: 'inferred' }
      }
    }

    // Check for waiting input (locked)
    for (const pattern of CODEX_PATTERNS.waiting_input) {
      if (pattern.test(recentOutput)) {
        this.buffer = ''
        this.recordTransition('locked')
        if (this.isLooping()) {
          return { status: 'looping', confidence: 'inferred' }
        }
        return { status: 'locked', confidence: 'inferred' }
      }
    }

    // Check for busy indicators
    for (const pattern of CODEX_PATTERNS.busy) {
      if (pattern.test(recentOutput)) {
        this.buffer = ''
        this.recordTransition('busy')
        return { status: 'busy', confidence: 'inferred' }
      }
    }

    return null
  }

  resetBuffer(): void {
    this.buffer = ''
  }

  private recordTransition(status: string): void {
    const now = Date.now()
    this.statusTransitions.push({ status, timestamp: now })
    const cutoff = now - this.loopingWindowMs
    this.statusTransitions = this.statusTransitions.filter((t) => t.timestamp >= cutoff)
  }

  private isLooping(): boolean {
    if (Date.now() - this.createdAt < this.startupGraceMs) return false
    const lockedCount = this.statusTransitions.filter((t) => t.status === 'locked').length
    return lockedCount >= this.loopingThreshold
  }
}
