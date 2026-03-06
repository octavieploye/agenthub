import type { AgentLifecycleStatus, StatusConfidence } from '../../shared/types/agent.types'

export interface ParsedStatus {
  status: AgentLifecycleStatus
  confidence: StatusConfidence
}

export interface CliOutputParser {
  parse(output: string): ParsedStatus | null
  getParserName(): string
}

const PATTERNS = {
  waiting_input: [
    /\? /,
    />\s*$/m,
    /waiting for (?:input|response)/i,
    /\(y\/n\)/i,
    /\[Y\/n\]/,
    /press enter/i,
    /approve|deny|allow/i
  ],
  completed: [
    /✓.*(?:completed|done|finished)/i,
    /task completed/i,
    /all done/i,
    /session ended/i
  ],
  busy: [
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
    /thinking\.\.\./i,
    /writing\b/i,
    /reading\.\.\./i,
    /searching\.\.\./i,
    /running/i,
    /executing/i
  ],
  error: [
    /error:/i,
    /failed:/i,
    /exception/i,
    /traceback/i,
    /panic/i
  ]
}

export class ClaudeCliOutputParser implements CliOutputParser {
  private buffer = ''
  private readonly maxBufferSize = 4096

  getParserName(): string {
    return 'claude-cli-v1'
  }

  parse(output: string): ParsedStatus | null {
    this.buffer += output
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize)
    }

    const recentOutput = this.buffer.slice(-1024)

    // Check for waiting input (locked) - highest priority
    for (const pattern of PATTERNS.waiting_input) {
      if (pattern.test(recentOutput)) {
        return { status: 'locked', confidence: 'inferred' }
      }
    }

    // Check for completion
    for (const pattern of PATTERNS.completed) {
      if (pattern.test(recentOutput)) {
        return { status: 'completed', confidence: 'inferred' }
      }
    }

    // Check for busy indicators (spinners, action words)
    for (const pattern of PATTERNS.busy) {
      if (pattern.test(recentOutput)) {
        return { status: 'busy', confidence: 'inferred' }
      }
    }

    // Check for errors
    for (const pattern of PATTERNS.error) {
      if (pattern.test(recentOutput)) {
        return { status: 'busy', confidence: 'inferred' }
      }
    }

    return null
  }

  resetBuffer(): void {
    this.buffer = ''
  }
}

export function createParser(): CliOutputParser {
  return new ClaudeCliOutputParser()
}
