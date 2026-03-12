import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AudioRecorderService } from '../services/audio-recorder'

export function useVoiceInput(inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const recorderRef = useRef<AudioRecorderService | null>(null)
  const keyDownTimeRef = useRef<number>(0)

  const startListening = useCallback(async () => {
    if (isListening || isProcessing) return
    const recorder = new AudioRecorderService()
    recorderRef.current = recorder
    try {
      await recorder.startRecording()
      setIsListening(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [isListening, isProcessing])

  const stopListening = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || !isListening) return

    setIsListening(false)
    setIsProcessing(true)

    try {
      const audioBuffer = await recorder.stopRecording()
      const response = await window.agentHub.voice.transcribe(audioBuffer)

      if (response.success && response.data.transcript) {
        const el = inputRef.current
        if (el) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set
          const currentVal = el.value
          const newVal = currentVal
            ? `${currentVal} ${response.data.transcript}`
            : response.data.transcript
          nativeInputValueSetter?.call(el, newVal)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } else if (response.success && response.data.error) {
        console.error('Transcription error:', response.data.error)
      }
    } catch (err) {
      console.error('Voice transcription failed:', err)
    } finally {
      setIsProcessing(false)
      recorderRef.current = null
    }
  }, [isListening, inputRef])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Keyboard shortcut: Cmd+Shift+V
  useEffect(() => {
    const HOLD_THRESHOLD_MS = 300

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'v' && !e.repeat) {
        e.preventDefault()
        keyDownTimeRef.current = Date.now()
        startListening()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        const held = Date.now() - keyDownTimeRef.current
        if (held >= HOLD_THRESHOLD_MS) {
          stopListening()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [startListening, stopListening])

  return { isListening, isProcessing, startListening, stopListening, toggleListening }
}
