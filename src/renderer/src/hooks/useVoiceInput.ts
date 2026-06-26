import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AudioRecorderService } from '../services/audio-recorder'

// Trigger words per locale — Whisper could feed detected language in the future
const TRIGGER_WORDS: Record<string, string[]> = {
  en: ['send'],
  // Future: fr: ['envoie'], es: ['enviar'], it: ['invia']
}

const DEFAULT_LOCALE = 'en'

function extractTrigger(transcript: string, locale = DEFAULT_LOCALE): { cleaned: string; triggered: boolean } {
  const words = TRIGGER_WORDS[locale] ?? TRIGGER_WORDS[DEFAULT_LOCALE]
  const lower = transcript.trimEnd().toLowerCase()
  for (const trigger of words) {
    // Match trigger word at end, optionally preceded by a comma or period
    const pattern = new RegExp(`[\\s,.]${trigger}[.!]?$`, 'i')
    if (pattern.test(lower) || lower === trigger) {
      const cleaned = transcript.trimEnd().replace(new RegExp(`[\\s,.]*${trigger}[.!]?$`, 'i'), '').trim()
      return { cleaned, triggered: true }
    }
  }
  return { cleaned: transcript, triggered: false }
}

interface UseVoiceInputOptions {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  onAutoSend?: () => void
}

export function useVoiceInput({ inputRef, onAutoSend }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const recorderRef = useRef<AudioRecorderService | null>(null)
  const isListeningRef = useRef(false)

  // Cleanup on unmount — stop recording if component unmounts mid-recording
  useEffect(() => {
    return () => {
      if (isListeningRef.current && recorderRef.current) {
        recorderRef.current.stopRecording().catch(() => {})
        recorderRef.current = null
        isListeningRef.current = false
      }
    }
  }, [])

  const startListening = useCallback(async () => {
    if (isListeningRef.current || isProcessing) return
    setMicError(null)
    const recorder = new AudioRecorderService()
    recorderRef.current = recorder
    try {
      await recorder.startRecording()
      isListeningRef.current = true
      setIsListening(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Microphone access denied — check System Settings > Privacy > Microphone'
        : 'Could not access microphone'
      setMicError(msg)
      recorderRef.current = null
    }
  }, [isProcessing])

  const stopListening = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || !isListeningRef.current) return

    isListeningRef.current = false
    setIsListening(false)
    setIsProcessing(true)

    try {
      const audioBuffer = await recorder.stopRecording()
      const response = await window.agentHub.voice.transcribe(audioBuffer)

      if (response.success && response.data.transcript) {
        const el = inputRef.current
        if (el) {
          const { cleaned, triggered } = extractTrigger(response.data.transcript)
          const nativeInputValueSetter = el instanceof HTMLTextAreaElement
            ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
            : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          const currentVal = el.value
          const textToInsert = triggered ? cleaned : response.data.transcript
          const newVal = currentVal
            ? `${currentVal} ${textToInsert}`
            : textToInsert
          nativeInputValueSetter?.call(el, newVal)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.focus()
          if (triggered && onAutoSend) {
            // Let DOM update propagate before submitting
            requestAnimationFrame(() => onAutoSend())
          }
        }
      } else if (response.success && response.data.error) {
        setMicError(response.data.error)
      } else if (!response.success) {
        setMicError(response.error?.message ?? 'Transcription service error')
      }
    } catch (err) {
      console.error('Voice transcription failed:', err)
      setMicError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setIsProcessing(false)
      recorderRef.current = null
    }
  }, [inputRef, onAutoSend])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

  return { isListening, isProcessing, micError, startListening, stopListening, toggleListening }
}
