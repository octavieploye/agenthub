import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VoiceInputButton } from './VoiceInputButton'
import { useRef } from 'react'

vi.mock('../../hooks/useVoiceInput', () => ({
  useVoiceInput: vi.fn(() => ({
    isListening: false,
    isProcessing: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    toggleListening: vi.fn()
  }))
}))

function TestWrapper() {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} data-testid="test-input" />
      <VoiceInputButton inputRef={ref} />
    </>
  )
}

describe('VoiceInputButton', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders mic button', () => {
    render(<TestWrapper />)
    expect(screen.getByTestId('voice-input-button')).toBeDefined()
  })

  it('shows voice input title in idle state', () => {
    render(<TestWrapper />)
    expect(screen.getByTestId('voice-input-button').title).toContain('Voice input')
  })
})
