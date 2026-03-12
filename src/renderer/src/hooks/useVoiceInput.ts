import { useCallback, useRef, useState, type RefObject } from 'react'
import { AudioRecorderService } from '../services/audio-recorder'

export function useVoiceInput(inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const recorderRef = useRef<AudioRecorderService | null>(null)
  const isListeningRef = useRef(false)

  const startListening = useCallback(async () => {
    if (isListeningRef.current || isProcessing) return
    const recorder = new AudioRecorderService()
    recorderRef.current = recorder
    try {
      await recorder.startRecording()
      isListeningRef.current = true
      setIsListening(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
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
  }, [inputRef])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

  return { isListening, isProcessing, startListening, stopListening, toggleListening }
}
