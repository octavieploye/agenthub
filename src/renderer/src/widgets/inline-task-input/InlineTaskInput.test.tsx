import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import InlineTaskInput from './InlineTaskInput'

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic' as ModelProvider,
    effortLevel: 'medium',
    taskDescription: 'Fix the login bug',
    pid: 1234,
    ptyFd: null,
    cwd: '/Users/dev/project',
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    progress: 0.5,
    color: '#3B82F6',
    ...overrides
  }
}

describe('InlineTaskInput', () => {
  const mockOnSendInput = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders input and send button', () => {
    render(<InlineTaskInput agent={createMockAgent()} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).toBeInTheDocument()
    expect(screen.getByTestId('inline-send-button')).toBeInTheDocument()
  })

  it('disables input when agent is busy', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'busy' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).toBeDisabled()
    expect(screen.getByTestId('inline-send-button')).toBeDisabled()
  })

  it('enables input when agent is idle', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).not.toBeDisabled()
  })

  it('enables input when agent is locked', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'locked' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).not.toBeDisabled()
  })

  it('enables input when agent is completed', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'completed' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).not.toBeDisabled()
  })

  it('disables input when agent is paused', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'paused' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).toBeDisabled()
  })

  it('calls onSendInput with text + carriage return on Enter', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    const input = screen.getByTestId('inline-input-field')
    fireEvent.change(input, { target: { value: 'fix the bug' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSendInput).toHaveBeenCalledWith('agent-1', 'fix the bug\r')
  })

  it('calls onSendInput on Send button click', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    const input = screen.getByTestId('inline-input-field')
    fireEvent.change(input, { target: { value: 'run tests' } })
    fireEvent.click(screen.getByTestId('inline-send-button'))
    expect(mockOnSendInput).toHaveBeenCalledWith('agent-1', 'run tests\r')
  })

  it('clears input after sending', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    const input = screen.getByTestId('inline-input-field') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'something' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('')
  })

  it('does not send empty input', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    const input = screen.getByTestId('inline-input-field')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSendInput).not.toHaveBeenCalled()
  })

  it('does not send whitespace-only input', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    const input = screen.getByTestId('inline-input-field')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSendInput).not.toHaveBeenCalled()
  })

  it('applies agent color to the color dot', () => {
    render(
      <InlineTaskInput
        agent={createMockAgent({ color: '#EF4444' })}
        onSendInput={mockOnSendInput}
      />
    )
    const container = screen.getByTestId('inline-task-input')
    const dot = container.querySelector('span.rounded-full')
    expect(dot).toHaveStyle({ backgroundColor: '#EF4444' })
  })

  it('applies agent color to the send button', () => {
    render(
      <InlineTaskInput
        agent={createMockAgent({ status: 'idle', color: '#10B981' })}
        onSendInput={mockOnSendInput}
      />
    )
    expect(screen.getByTestId('inline-send-button')).toHaveStyle({ backgroundColor: '#10B981' })
  })

  it('shows correct placeholder for locked status', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'locked' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).toHaveAttribute('placeholder', 'Respond to agent...')
  })

  it('shows correct placeholder for busy status', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'busy' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-input-field')).toHaveAttribute('placeholder', 'Agent working...')
  })

  it('does not render an Enter hint text next to the send button', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    expect(screen.queryByText('Enter')).not.toBeInTheDocument()
  })

  it('send button has type=button to prevent implicit form submission', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    expect(screen.getByTestId('inline-send-button')).toHaveAttribute('type', 'button')
  })

  it('send button fires onSendInput exactly once per click', () => {
    render(<InlineTaskInput agent={createMockAgent({ status: 'idle' })} onSendInput={mockOnSendInput} />)
    const input = screen.getByTestId('inline-input-field')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.click(screen.getByTestId('inline-send-button'))
    expect(mockOnSendInput).toHaveBeenCalledTimes(1)
  })

  describe('ended session (PTY gone)', () => {
    it('disables the input even though status is completed', () => {
      render(
        <InlineTaskInput
          agent={createMockAgent({ status: 'completed' })}
          onSendInput={mockOnSendInput}
          sessionEnded
        />
      )
      expect(screen.getByTestId('inline-input-field')).toBeDisabled()
    })

    it('tells the user the session ended instead of inviting a prompt', () => {
      render(
        <InlineTaskInput
          agent={createMockAgent({ status: 'completed' })}
          onSendInput={mockOnSendInput}
          sessionEnded
        />
      )
      expect(screen.getByTestId('inline-input-field')).toHaveAttribute(
        'placeholder',
        'Session ended \u2014 respawn to continue'
      )
    })

    it('replaces Send with Respawn', () => {
      render(
        <InlineTaskInput
          agent={createMockAgent({ status: 'completed' })}
          onSendInput={mockOnSendInput}
          sessionEnded
          onRespawn={vi.fn()}
        />
      )
      expect(screen.getByTestId('inline-respawn-button')).toBeInTheDocument()
      expect(screen.queryByTestId('inline-send-button')).not.toBeInTheDocument()
    })

    it('calls onRespawn with the agent id', () => {
      const onRespawn = vi.fn()
      render(
        <InlineTaskInput
          agent={createMockAgent({ status: 'completed' })}
          onSendInput={mockOnSendInput}
          sessionEnded
          onRespawn={onRespawn}
        />
      )
      fireEvent.click(screen.getByTestId('inline-respawn-button'))
      expect(onRespawn).toHaveBeenCalledWith('agent-1')
    })

    it('never forwards input to a dead PTY', () => {
      render(
        <InlineTaskInput
          agent={createMockAgent({ status: 'completed' })}
          onSendInput={mockOnSendInput}
          sessionEnded
        />
      )
      const input = screen.getByTestId('inline-input-field')
      fireEvent.change(input, { target: { value: 'still typing' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(mockOnSendInput).not.toHaveBeenCalled()
    })

    it('keeps the input usable while the session is alive', () => {
      render(
        <InlineTaskInput
          agent={createMockAgent({ status: 'completed' })}
          onSendInput={mockOnSendInput}
          sessionEnded={false}
        />
      )
      expect(screen.getByTestId('inline-input-field')).not.toBeDisabled()
      expect(screen.getByTestId('inline-send-button')).toBeInTheDocument()
    })
  })
})
