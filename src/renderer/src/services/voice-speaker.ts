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
  piperVoiceId?: string
}

type AgentHubTts = {
  speak: (o: { text: string; voiceId: string; rate: number; volume: number }) => Promise<{ data?: ArrayBuffer; error?: string }>
}

function getTts(): AgentHubTts | undefined {
  return (window as Window & typeof globalThis & { agentHub?: { tts?: AgentHubTts } }).agentHub?.tts
}

/**
 * Speaks text via Piper TTS (IPC → main process → piper binary → WAV → Web Audio).
 * Falls back silently if IPC is unavailable.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text.trim()) return
  const tts = getTts()
  if (!tts) return

  const result = await tts.speak({
    text,
    voiceId: opts.piperVoiceId ?? 'en_US-amy-medium',
    rate: opts.rate ?? 1.0,
    volume: opts.volume ?? 0.8,
  })

  if (result?.error) {
    console.warn('[voice-speaker] TTS error:', result.error)
    return
  }

  if (result?.data) {
    const { playWav } = await import('./tts-player')
    await playWav(result.data, opts.volume ?? 0.8)
  }
}

export function cancelSpeech(): void {
  import('./tts-player').then(({ stopPlayback }) => stopPlayback()).catch(() => {})
}
