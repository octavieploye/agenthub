import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BreakoutLayout from './BreakoutLayout'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'

// Mock FullTerminal
vi.mock('../full-terminal/FullTerminal', () => ({
  default: ({ agentId, visible }: { agentId: string; visible: boolean }) => (
    <div data-testid="full-terminal" data-agent-id={agentId} data-visible={String(visible)} />
  )
}))

// Mock theme store
vi.mock('../../stores/theme-store', () => ({
  useThemeStore: vi.fn((selector) =>
    selector({ theme: 'mocha', setTheme: vi.fn() })
  )
}))

// Mock VoiceInputButton (requires VoiceInputProvider context)
vi.mock('../voice-input-button/VoiceInputButton', () => ({
  VoiceInputButton: () => <div data-testid="voice-input-button" />
}))

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

describe('BreakoutLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup agentHub mock
    window.agentHub = {
      agents: {
        getState: vi.fn().mockResolvedValue({ success: true, data: createMockAgent() }),
        sendInput: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        spawn: vi.fn(),
        kill: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        list: vi.fn(),
        resize: vi.fn()
      },
      on: {
        agentStatusChange: vi.fn(() => vi.fn()),
        agentOutput: vi.fn(() => vi.fn()),
        agentExit: vi.fn(() => vi.fn())
      }
    } as any
  })

  it('renders loading state then agent info', async () => {
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByText('test-agent')).toBeInTheDocument()
    })
  })

  it('renders the full terminal component', async () => {
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('full-terminal')).toBeInTheDocument()
    })
    expect(screen.getByTestId('full-terminal')).toHaveAttribute('data-agent-id', 'agent-1')
  })

  it('renders the input bar', async () => {
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('breakout-input')).toBeInTheDocument()
    })
  })

  it('input is always enabled regardless of agent status', async () => {
    // Default mock returns status: 'busy'
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('breakout-input')).not.toBeDisabled()
    })
  })

  it('voice transcript injected while agent is busy updates inputValue', async () => {
    // Agent is busy — input must be enabled so React processes onChange
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('breakout-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('breakout-input') as HTMLInputElement

    // Simulate what useVoiceInput does: set DOM value then dispatch input event
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    nativeSetter?.call(input, 'transcribed text')
    fireEvent(input, new Event('input', { bubbles: true }))

    expect(input.value).toBe('transcribed text')
  })

  it('Enter key while agent is busy does not send even with text in input', async () => {
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('breakout-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('breakout-input')
    fireEvent.change(input, { target: { value: 'queued message' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Agent is busy — send must be blocked
    expect(window.agentHub.agents.sendInput).not.toHaveBeenCalled()
  })

  it('enables input when agent is locked', async () => {
    window.agentHub.agents.getState = vi.fn().mockResolvedValue({
      success: true,
      data: createMockAgent({ status: 'locked' })
    })
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('breakout-input')).not.toBeDisabled()
    })
  })

  it('sends input on Enter key', async () => {
    window.agentHub.agents.getState = vi.fn().mockResolvedValue({
      success: true,
      data: createMockAgent({ status: 'locked' })
    })
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('breakout-input')).not.toBeDisabled()
    })
    const input = screen.getByTestId('breakout-input')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.agentHub.agents.sendInput).toHaveBeenCalledWith('agent-1', 'hello\r')
  })

  it('sends input on Send button click', async () => {
    window.agentHub.agents.getState = vi.fn().mockResolvedValue({
      success: true,
      data: createMockAgent({ status: 'idle' })
    })
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByTestId('breakout-send')).toBeInTheDocument()
    })
    const input = screen.getByTestId('breakout-input')
    fireEvent.change(input, { target: { value: 'test task' } })
    fireEvent.click(screen.getByTestId('breakout-send'))
    expect(window.agentHub.agents.sendInput).toHaveBeenCalledWith('agent-1', 'test task\r')
  })

  it('shows agent status', async () => {
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByText('busy')).toBeInTheDocument()
    })
  })

  it('shows repo name from cwd', async () => {
    render(<BreakoutLayout agentId="agent-1" />)
    await waitFor(() => {
      expect(screen.getByText('project')).toBeInTheDocument()
    })
  })

  it('subscribes to status changes', () => {
    render(<BreakoutLayout agentId="agent-1" />)
    expect(window.agentHub.on.agentStatusChange).toHaveBeenCalled()
  })
})
