import type { TriageEvent } from '@shared/types/triage.types'

export interface VoiceTtsDeps {
  speak: (utterance: { text: string; volume: number }) => void
  isVoiceEnabled: () => boolean
  isFocused: (agentId: string) => boolean
}

export const DEFAULT_TTS_VOLUME = 0.7

export function formatTtsMessage(event: TriageEvent): string {
  return `${event.agentName} in ${event.repoName}: ${event.reason}`
}

export function speakTriageEvent(
  event: TriageEvent,
  deps: VoiceTtsDeps,
  volume?: number
): boolean {
  if (!deps.isVoiceEnabled()) {
    return false
  }

  if (deps.isFocused(event.agentId)) {
    return false
  }

  const text = formatTtsMessage(event)
  deps.speak({ text, volume: volume ?? DEFAULT_TTS_VOLUME })
  return true
}
