import { useCallback, useRef, useState, type RefObject } from 'react'
import { AudioRecorderService } from '../services/audio-recorder'

export function useVoiceInput(inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const recorderRef = useRef<AudioRecorderService | null>(null)
  const isListeningRef = useRef(false)

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
          const nativeInputValueSetter = el instanceof HTMLTextAreaElement
            ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
            : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          const currentVal = el.value
          const newVal = currentVal
            ? `${currentVal} ${response.data.transcript}`
            : response.data.transcript
          nativeInputValueSetter?.call(el, newVal)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.focus()
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
  }, [inputRef])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

  return { isListening, isProcessing, micError, startListening, stopListening, toggleListening }
}
