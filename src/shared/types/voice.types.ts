export type VoiceMode = 'off' | 'speak_up' | 'always_on'

export type VoiceStatus = 'ready' | 'busy' | 'unavailable'

export interface VoiceStatusResult {
  status: VoiceStatus
  reason?: 'model-missing' | 'binary-missing' | 'mic-denied'
}

export interface VoiceTranscribeResult {
  transcript?: string
  error?: string
}
