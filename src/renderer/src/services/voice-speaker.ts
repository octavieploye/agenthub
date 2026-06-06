// Strips ANSI escape sequences and normalises line endings
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[@-Z\\-_]|\x0f|\x0e/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Returns the last non-empty paragraph (blocks separated by two or more newlines).
 * Falls back to the full text if there is only one paragraph.
 */
export function extractLastParagraph(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  return paragraphs.at(-1) ?? text.trim()
}

export interface SpeakOptions {
  volume?: number
  rate?: number
  voiceURI?: string
}

/**
 * Cancels any in-progress speech and speaks new text.
 * Does nothing if text is blank.
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!text.trim()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.volume = opts.volume ?? 0.8
  utterance.rate = opts.rate ?? 1.0
  if (opts.voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === opts.voiceURI)
    if (voice) utterance.voice = voice
  }
  window.speechSynthesis.speak(utterance)
}

/**
 * Queues text after any currently-speaking utterance (does NOT cancel first).
 */
export function speakQueued(text: string, opts: SpeakOptions = {}): void {
  if (!text.trim()) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.volume = opts.volume ?? 0.8
  utterance.rate = opts.rate ?? 1.0
  if (opts.voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === opts.voiceURI)
    if (voice) utterance.voice = voice
  }
  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech(): void {
  window.speechSynthesis.cancel()
}
