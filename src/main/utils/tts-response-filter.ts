/**
 * Filters raw PTY text (ANSI already stripped) down to only the LLM's prose
 * response to the human, removing tool calls, spinners, system banners, and
 * prompt chrome.
 *
 * Called once per response at the TTS.RESPONSE_READY emission point.
 */

// Unicode ranges and symbols used by Claude CLI scaffolding (not LLM prose)
const BRAILLE_SPINNER_RE = /^[\u2800-\u28FF\s]+$/
const DECORATIVE_SPINNER_RE = /^[✻✳✢✺✶✽·\s]+$/
const TOOL_CALL_START_RE = /^[●○]/
const TOOL_CONTINUATION_RE = /^[⎿├└]/
const TOOL_STATUS_RE = /^[✓✗⏺]/
const BOX_DRAWING_RE = /[╭╮╰╯│─]/
const PROMPT_CHROME_RE = /^❯\s*$/
const APPROVAL_PROMPT_RE = /^\?\s/
const UPDATE_BANNER_RE = /update available/i
const THINKING_LINE_RE = /^(Thinking|Bootstrapping|Brewing|Caramelizing|Crystallizing|Deciphering|Imagining|Inferring|Nesting|Spelunking)[…\.]*\s*$/i

type LineKind = 'prose' | 'tool_call' | 'tool_result' | 'spinner' | 'banner' | 'prompt' | 'empty'

function classifyLine(line: string, prevKind: LineKind, inFencedBlock: boolean): LineKind {
  // Inside LLM fenced code block — always prose
  if (inFencedBlock) return 'prose'

  const trimmed = line.trim()

  if (trimmed === '') return 'empty'
  if (BRAILLE_SPINNER_RE.test(trimmed) || DECORATIVE_SPINNER_RE.test(trimmed)) return 'spinner'
  if (THINKING_LINE_RE.test(trimmed)) return 'spinner'
  if (TOOL_CALL_START_RE.test(trimmed)) return 'tool_call'
  if (TOOL_CONTINUATION_RE.test(trimmed)) return 'tool_call'
  if (TOOL_STATUS_RE.test(trimmed)) return 'tool_call'
  if (BOX_DRAWING_RE.test(trimmed)) return 'banner'
  if (UPDATE_BANNER_RE.test(trimmed)) return 'banner'
  if (PROMPT_CHROME_RE.test(line)) return 'prompt'
  if (APPROVAL_PROMPT_RE.test(trimmed)) return 'prompt'

  // Indented line immediately following a tool call → tool result block
  if ((prevKind === 'tool_call' || prevKind === 'tool_result') && /^\s{2,}/.test(line)) {
    return 'tool_result'
  }

  return 'prose'
}

export function filterTtsResponse(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let prevKind: LineKind = 'empty'
  let inFencedBlock = false
  let consecutiveBlanks = 0

  for (const line of lines) {
    // Track fenced code block boundaries (``` at line start)
    const isFenceMarker = /^```/.test(line.trim())
    if (isFenceMarker) {
      inFencedBlock = !inFencedBlock
      // Fenced markers are part of the LLM's prose output
      output.push(line)
      prevKind = 'prose'
      consecutiveBlanks = 0
      continue
    }

    const kind = classifyLine(line, prevKind, inFencedBlock)

    if (kind === 'empty') {
      consecutiveBlanks++
      // Preserve paragraph breaks (single blank line max)
      if (consecutiveBlanks === 1 && output.length > 0) {
        output.push('')
      }
      // Don't update prevKind on blank lines — keep context for tool_result detection
      continue
    }

    consecutiveBlanks = 0

    if (kind === 'prose') {
      output.push(line)
    }
    // tool_call, tool_result, spinner, banner, prompt → discard

    prevKind = kind
  }

  // Trim trailing blank lines
  while (output.length > 0 && output[output.length - 1] === '') {
    output.pop()
  }

  return output.join('\n')
}
