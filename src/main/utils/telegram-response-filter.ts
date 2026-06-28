/**
 * Filters terminal text for Telegram notifications.
 * More permissive than the TTS filter — keeps tool calls, results, and code
 * blocks so the user sees what the agent actually did, not just spoken prose.
 *
 * Input: clean text extracted from HeadlessTerminalBuffer (no raw ANSI).
 */

// Duplicated from tts-response-filter.ts (not exported there)
const BRAILLE_SPINNER_RE = /^[\u2800-\u28FF\s]+$/
const DECORATIVE_SPINNER_RE = /^[✻✳✢✺✶✽·\s]+$|^[✻✳✢✺✶✽·]\s+\S/
const BOX_DRAWING_RE = /^[╭╮╰╯│─]/
const BLOCK_ELEMENT_BANNER_RE = /^[\u2580-\u259F\s]+$/
const PROMPT_CHROME_RE = /^❯(\s|$)/
const APPROVAL_PROMPT_RE = /^\?\s/
const UPDATE_BANNER_RE = /update available/i
const SHELL_COMMAND_RE = /^(clear\s*;|claude\s+--|[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\s)/
const OH_MY_ZSH_RE = /^\[oh-my-zsh\]/i
const COMMAND_ANYWHERE_RE = /clear\s*;|claude\s+--/
const SHELL_PROMPT_RE = /[»›❯%\$#]\s*(clear|claude|cd|npm|git|ls|cat|echo)\b/
const BARE_PROMPT_RE = /^[\s\-─═~]*[\w\/.@:-]*\s*[‹«\[({].*[›»\])}]\s*[»›❯%\$#]\s*$/
const THINKING_LINE_RE = /^(Thinking|Bootstrapping|Brewing|Caramelizing|Crystallizing|Deciphering|Imagining|Inferring|Nesting|Spelunking|Reticulating|Pondering|Conjuring|Synthesizing|Analyzing|Processing|Generating|Formulating|Composing|Evaluating|Computing|Rendering|Compiling)\b/i
const KEYBOARD_HINT_RE = /^[·•]?\s*(esc|ctrl\+\w+|shift\+\w+|tab)\s+to\s+/i
const PERMISSION_PROMPT_RE = /bypass permissions|shift\+tab to cycle/i
const SINGLE_WORD_ELLIPSIS_RE = /^[A-Z]\w+…$/
const RESIDUAL_ESCAPE_RE = /^\x1b/

type LineKind = 'prose' | 'tool' | 'spinner' | 'banner' | 'prompt' | 'empty'

function classifyLine(line: string, inFencedBlock: boolean): LineKind {
  if (inFencedBlock) return 'prose'

  const trimmed = line.trim()

  if (trimmed === '') return 'empty'
  if (RESIDUAL_ESCAPE_RE.test(trimmed)) return 'banner'
  if (BRAILLE_SPINNER_RE.test(trimmed) || DECORATIVE_SPINNER_RE.test(trimmed)) return 'spinner'
  if (THINKING_LINE_RE.test(trimmed)) return 'spinner'
  if (BOX_DRAWING_RE.test(trimmed)) return 'banner'
  if (BLOCK_ELEMENT_BANNER_RE.test(trimmed)) return 'banner'
  if (UPDATE_BANNER_RE.test(trimmed)) return 'banner'
  if (KEYBOARD_HINT_RE.test(trimmed)) return 'prompt'
  if (PROMPT_CHROME_RE.test(line)) return 'prompt'
  if (APPROVAL_PROMPT_RE.test(trimmed)) return 'prompt'
  if (PERMISSION_PROMPT_RE.test(trimmed)) return 'prompt'
  if (SHELL_COMMAND_RE.test(trimmed)) return 'prompt'
  if (OH_MY_ZSH_RE.test(trimmed)) return 'prompt'
  if (COMMAND_ANYWHERE_RE.test(trimmed)) return 'prompt'
  if (SHELL_PROMPT_RE.test(trimmed)) return 'prompt'
  if (BARE_PROMPT_RE.test(trimmed)) return 'prompt'
  if (SINGLE_WORD_ELLIPSIS_RE.test(trimmed)) return 'spinner'
  // Short fragments (< 4 word-chars) with no real words — corrupted terminal output
  if (trimmed.replace(/[^a-zA-Z0-9]/g, '').length < 4 && !/\b\w{3,}\b/.test(trimmed)) return 'banner'

  return 'prose'
}

export function filterTelegramResponse(text: string): string {
  // Strip non-SGR escape sequences that may survive headless extraction
  const cleaned = text
    .replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '')
    .replace(/\x1b[()][A-Z0-9]/g, '')
    .replace(/\x1b[=><!]/g, '')
    .replace(/\x1b./g, '')
    .replace(/\x07/g, '')
    .replace(/\x08/g, '')

  const lines = cleaned.split('\n')
  const output: string[] = []
  let inFencedBlock = false
  let consecutiveBlanks = 0

  for (const line of lines) {
    const isFenceMarker = /^```/.test(line.trim())
    if (isFenceMarker) {
      inFencedBlock = !inFencedBlock
      output.push(line)
      consecutiveBlanks = 0
      continue
    }

    const kind = classifyLine(line, inFencedBlock)

    if (kind === 'empty') {
      consecutiveBlanks++
      if (consecutiveBlanks === 1 && output.length > 0) {
        output.push('')
      }
      continue
    }

    // Keep prose AND tool lines — only strip spinners, banners, prompts
    if (kind === 'prose' || kind === 'tool') {
      consecutiveBlanks = 0
      output.push(line)
    }
    // spinner, banner, prompt → discard without resetting consecutiveBlanks
    // so blank lines around skipped content still collapse correctly
  }

  while (output.length > 0 && output[output.length - 1] === '') {
    output.pop()
  }

  return output.join('\n')
}
