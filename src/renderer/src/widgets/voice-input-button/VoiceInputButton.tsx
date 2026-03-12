import { type RefObject, useId, useEffect } from 'react'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useVoiceInputContext } from '../../contexts/VoiceInputContext'

interface VoiceInputButtonProps {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  className?: string
}

export function VoiceInputButton({ inputRef, className = '' }: VoiceInputButtonProps) {
  const id = useId()
  const { isListening, isProcessing, toggleListening } = useVoiceInput(inputRef)
  const { register, unregister } = useVoiceInputContext()

  useEffect(() => {
    register(id, inputRef, toggleListening)
    return () => unregister(id)
  }, [id, inputRef, toggleListening, register, unregister])

  const title = isProcessing
    ? 'Transcribing...'
    : isListening
      ? 'Listening — click or Cmd+E to stop'
      : 'Voice input (Cmd+E)'

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={isProcessing}
      title={title}
      data-testid="voice-input-button"
      className={`btn btn-ghost btn-xs ${className}`}
    >
      {isProcessing ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`w-4 h-4 ${isListening ? 'text-red-500 animate-pulse' : 'opacity-50'}`}
        >
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
        </svg>
      )}
    </button>
  )
}
