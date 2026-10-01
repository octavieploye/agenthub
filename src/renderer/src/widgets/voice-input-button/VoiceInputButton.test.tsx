import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VoiceInputButton } from './VoiceInputButton'
import { useRef, type ReactElement } from 'react'
import { VoiceInputProvider } from '../../contexts/VoiceInputContext'

const mockToggleListening = vi.fn()

vi.mock('../../hooks/useVoiceInput', () => ({
  useVoiceInput: vi.fn(() => ({
    isListening: false,
    isProcessing: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    toggleListening: mockToggleListening
  }))
}))

function TestWrapper({
  inputDisabled = false,
  canDictate = true
}: {
  inputDisabled?: boolean
  canDictate?: boolean
}): ReactElement {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <VoiceInputProvider>
      <input ref={ref} data-testid="test-input" disabled={inputDisabled} />
      <VoiceInputButton inputRef={ref} canDictate={canDictate} />
    </VoiceInputProvider>
  )
}

describe('VoiceInputButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders mic button', () => {
    render(<TestWrapper />)
    expect(screen.getByTestId('voice-input-button')).toBeDefined()
  })

  it('shows voice input title in idle state', () => {
    render(<TestWrapper />)
    expect(screen.getByTestId('voice-input-button').title).toContain('Voice input')
  })

  it('keeps click and Cmd+E available when only the text input is disabled', () => {
    render(<TestWrapper inputDisabled />)

    fireEvent.keyDown(window, { key: 'e', metaKey: true })
    fireEvent.click(screen.getByTestId('voice-input-button'))

    expect(mockToggleListening).toHaveBeenCalledTimes(2)
  })

  it('disables both click and Cmd+E when dictation is explicitly unavailable', () => {
    render(<TestWrapper canDictate={false} />)

    fireEvent.keyDown(window, { key: 'e', metaKey: true })
    fireEvent.click(screen.getByTestId('voice-input-button'))

    expect(screen.getByTestId('voice-input-button')).toBeDisabled()
    expect(mockToggleListening).not.toHaveBeenCalled()
  })
})
