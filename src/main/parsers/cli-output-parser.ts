import type { AgentLifecycleStatus, StatusConfidence } from '../../shared/types/agent.types'

export interface ParsedStatus {
  status: AgentLifecycleStatus
  confidence: StatusConfidence
}

export interface CliOutputParser {
  parse(output: string): ParsedStatus | null
  getParserName(): string
}

// Strip ANSI escape sequences so patterns match the visible text.
// Claude CLI v2.x uses cursor-right movement (\x1b[nC) instead of literal
// spaces, so we replace those with the equivalent number of spaces first.
function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[(\d+)C/g, (_m, n) => ' '.repeat(Number(n)))
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
}

const PATTERNS = {
  awaiting_approval: [
    // Claude CLI tool-approval: "Do you want to create/write/read/edit/delete/run...?"
    /Do you want to (?:create|write|read|edit|delete|execute|run|update|modify|remove|install|push|overwrite)\b/i,
    // Fallback for other approval question forms
    /(?:do you (?:want to|wish to)|would you like to)\s+(?:approve|deny|allow)/i,
    /(?:approve|deny|allow)\s+this\s+(?:tool|action|operation|request)\??/i,
    // Yes/no confirmation prompts
    /\[yes\/no\]/i,
    /\(y\/n\)/i,
    // "allow X to create/write/run/execute/delete Y"
    /allow .* to .*(create|write|run|execute|delete)/i
  ],
  waiting_input: [
    /^\?\s+\S/m,
    /^❯\s/m,                              // Claude CLI v2.x prompt indicator (agent at ❯ prompt)
    /waiting for (?:input|response)/i,
    /\[Y\/n\]/,
    /press enter/i
  ],
  completed: [
    /✓.*(?:completed|done|finished)/i,
    /task completed/i,
    /all done/i,
    /session ended/i,
    /Done!/                                // Claude CLI v2.x completion message
  ],
  busy: [
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,          // Braille spinners (older CLIs)
    /[✻✳✢✺✶✽⏺]/,                         // Claude CLI v2.x decorative spinners (not · alone)
    /Bootstrapping/,
    /Brewing/,
    /Caramelizing/,
    /Crystallizing/,
    /Deciphering/,
    /Imagining/,
    /Inferring/,
    /Nesting/,
    /Spelunking/,
    /thinking\b/i
  ]
  // NOTE: error patterns removed — they match code content Claude writes
  // (e.g. "error:" in error-handling code). Error status is only set by
  // PTY non-zero exit in agent-manager.ts.
}

export class ClaudeCliOutputParser implements CliOutputParser {
  private buffer = ''
  private readonly maxBufferSize = 4096
  private statusTransitions: { status: string; timestamp: number }[] = []
  private readonly loopingThreshold = 8          // locked transitions needed to trigger looping
  private readonly loopingWindowMs = 30_000     // 30 second window

  getParserName(): string {
    return 'claude-cli-v1'
  }

  parse(output: string): ParsedStatus | null {
    this.buffer += output
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize)
    }

    const recentOutput = stripAnsi(this.buffer.slice(-1024))

    // Check for approval prompts - highest priority
    for (const pattern of PATTERNS.awaiting_approval) {
      if (pattern.test(recentOutput)) {
        this.buffer = ''
        this.statusTransitions = [] // Approval flow is not looping
        return { status: 'awaiting_approval', confidence: 'inferred' }
      }
    }

    // Check for completion BEFORE locked — "Done!" appears before the ❯ prompt
    for (const pattern of PATTERNS.completed) {
      if (pattern.test(recentOutput)) {
        this.buffer = ''
        return { status: 'completed', confidence: 'inferred' }
      }
    }

    // Check for waiting input (locked)
    for (const pattern of PATTERNS.waiting_input) {
      if (pattern.test(recentOutput)) {
        this.buffer = ''
        this.recordTransition('locked')
        if (this.isLooping()) {
          return { status: 'looping', confidence: 'inferred' }
        }
        return { status: 'locked', confidence: 'inferred' }
      }
    }

    // Check for busy indicators (spinners, action words)
    for (const pattern of PATTERNS.busy) {
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
    // Prune old transitions outside the window
    const cutoff = now - this.loopingWindowMs
    this.statusTransitions = this.statusTransitions.filter((t) => t.timestamp >= cutoff)
  }

  private isLooping(): boolean {
    const lockedCount = this.statusTransitions.filter((t) => t.status === 'locked').length
    return lockedCount >= this.loopingThreshold
  }
}

export function createParser(): CliOutputParser {
  return new ClaudeCliOutputParser()
}
