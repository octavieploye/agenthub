/**
 * Filters raw PTY text (ANSI already stripped) down to only the LLM's prose
 * response to the human, removing tool calls, spinners, system banners, and
 * prompt chrome.
 *
 * Called once per response at the TTS.RESPONSE_READY emission point.
 */

// Unicode ranges and symbols used by Claude CLI scaffolding (not LLM prose)
const BRAILLE_SPINNER_RE = /^[\u2800-\u28FF\s]+$/
// Spinner chars alone on a line, OR spinner char + space + description text
// e.g. "✻ Implementing free-text categories…" (Claude CLI tool-call progress lines)
const DECORATIVE_SPINNER_RE = /^[✻✳✢✺✶✽·\s]+$|^[✻✳✢✺✶✽·]\s+\S/
const TOOL_CALL_START_RE = /^[●○]/
const TOOL_CONTINUATION_RE = /^[⎿├└]/
const TOOL_STATUS_RE = /^[✓✗⏺]/
const BOX_DRAWING_RE = /^[╭╮╰╯│─]/
// Block-element characters used in Claude Code startup banner (▐▛▜▌▝▘█ etc.)
const BLOCK_ELEMENT_BANNER_RE = /^[\u2580-\u259F\s]+$/
const PROMPT_CHROME_RE = /^❯\s*$/
const APPROVAL_PROMPT_RE = /^\?\s/
const UPDATE_BANNER_RE = /update available/i
const THINKING_LINE_RE = /^(Thinking|Bootstrapping|Brewing|Caramelizing|Crystallizing|Deciphering|Imagining|Inferring|Nesting|Spelunking)[…\.]*\s*$/i
// Safety net: any line that still begins with an escape character after stripAnsi
const RESIDUAL_ESCAPE_RE = /^\x1b/

type LineKind = 'prose' | 'tool_call' | 'tool_result' | 'spinner' | 'banner' | 'prompt' | 'empty'

function classifyLine(line: string, prevKind: LineKind, inFencedBlock: boolean): LineKind {
  // Inside LLM fenced code block — always prose
  if (inFencedBlock) return 'prose'

  const trimmed = line.trim()

  if (trimmed === '') return 'empty'
  if (RESIDUAL_ESCAPE_RE.test(trimmed)) return 'banner'
  if (BRAILLE_SPINNER_RE.test(trimmed) || DECORATIVE_SPINNER_RE.test(trimmed)) return 'spinner'
  if (THINKING_LINE_RE.test(trimmed)) return 'spinner'
  if (TOOL_CALL_START_RE.test(trimmed)) return 'tool_call'
  if (TOOL_CONTINUATION_RE.test(trimmed)) return 'tool_call'
  if (TOOL_STATUS_RE.test(trimmed)) return 'tool_call'
  if (BOX_DRAWING_RE.test(trimmed)) return 'banner'
  if (BLOCK_ELEMENT_BANNER_RE.test(trimmed)) return 'banner'
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
      // After a double blank line (strong paragraph break) the tool_result
      // context ends — indented prose after the gap must not be dropped.
      if (consecutiveBlanks >= 2) {
        prevKind = 'empty'
      }
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
