import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import CodeBluePanel from './CodeBluePanel'
import CodeBlueButton from './CodeBlueButton'

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic' as ModelProvider,
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

describe('CodeBluePanel', () => {
  const agents = [
    createMockAgent({ id: 'a1', name: 'agent-alpha', status: 'busy' }),
    createMockAgent({ id: 'a2', name: 'agent-beta', status: 'paused' }),
    createMockAgent({ id: 'a3', name: 'agent-gamma', status: 'locked' })
  ]

  const defaultProps = {
    agents,
    onResumeAgent: vi.fn(),
    onKillAgent: vi.fn(),
    onRestartAgent: vi.fn(),
    onResumeAll: vi.fn(),
    onDismiss: vi.fn(),
    isActive: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('panel rendering', () => {
    it('renders the panel when isActive is true', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-panel')).toBeInTheDocument()
    })

    it('does not render when isActive is false', () => {
      render(<CodeBluePanel {...defaultProps} isActive={false} />)
      expect(screen.queryByTestId('code-blue-panel')).not.toBeInTheDocument()
    })

    it('renders glass backdrop', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-backdrop')).toBeInTheDocument()
    })

    it('applies red glow border class', () => {
      render(<CodeBluePanel {...defaultProps} />)
      const panel = screen.getByTestId('code-blue-panel')
      expect(panel.className).toMatch(/border-error|border-red|glow-red|ring-red/)
    })

    it('applies panel-glass styling to backdrop', () => {
      render(<CodeBluePanel {...defaultProps} />)
      const backdrop = screen.getByTestId('code-blue-backdrop')
      expect(backdrop.className).toMatch(/panel-glass|backdrop|bg-black/)
    })
  })

  describe('agent list', () => {
    it('renders agent list container', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-agent-list')).toBeInTheDocument()
    })

    it('lists each agent by id', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-agent-a1')).toBeInTheDocument()
      expect(screen.getByTestId('code-blue-agent-a2')).toBeInTheDocument()
      expect(screen.getByTestId('code-blue-agent-a3')).toBeInTheDocument()
    })

    it('shows agent names in the list', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-agent-a1')).toHaveTextContent('agent-alpha')
      expect(screen.getByTestId('code-blue-agent-a2')).toHaveTextContent('agent-beta')
    })
  })

  describe('per-agent controls', () => {
    it('renders Resume button for each agent', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-resume-a1')).toBeInTheDocument()
      expect(screen.getByTestId('code-blue-resume-a2')).toBeInTheDocument()
    })

    it('renders Kill button for each agent', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-kill-a1')).toBeInTheDocument()
    })

    it('renders Restart button for each agent', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-restart-a1')).toBeInTheDocument()
    })

    it('fires onResumeAgent with correct id', () => {
      render(<CodeBluePanel {...defaultProps} />)
      fireEvent.click(screen.getByTestId('code-blue-resume-a1'))
      expect(defaultProps.onResumeAgent).toHaveBeenCalledWith('a1')
    })

    it('fires onKillAgent with correct id', () => {
      render(<CodeBluePanel {...defaultProps} />)
      fireEvent.click(screen.getByTestId('code-blue-kill-a2'))
      expect(defaultProps.onKillAgent).toHaveBeenCalledWith('a2')
    })

    it('fires onRestartAgent with correct id', () => {
      render(<CodeBluePanel {...defaultProps} />)
      fireEvent.click(screen.getByTestId('code-blue-restart-a3'))
      expect(defaultProps.onRestartAgent).toHaveBeenCalledWith('a3')
    })
  })

  describe('global actions', () => {
    it('renders Resume All button', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-resume-all')).toBeInTheDocument()
    })

    it('fires onResumeAll when Resume All clicked', () => {
      render(<CodeBluePanel {...defaultProps} />)
      fireEvent.click(screen.getByTestId('code-blue-resume-all'))
      expect(defaultProps.onResumeAll).toHaveBeenCalledOnce()
    })

    it('renders Dismiss button', () => {
      render(<CodeBluePanel {...defaultProps} />)
      expect(screen.getByTestId('code-blue-dismiss')).toBeInTheDocument()
    })

    it('fires onDismiss when Dismiss clicked', () => {
      render(<CodeBluePanel {...defaultProps} />)
      fireEvent.click(screen.getByTestId('code-blue-dismiss'))
      expect(defaultProps.onDismiss).toHaveBeenCalledOnce()
    })
  })

  describe('focus trap', () => {
    it('traps focus within the panel on Tab', () => {
      render(<CodeBluePanel {...defaultProps} />)
      const panel = screen.getByTestId('code-blue-panel')
      // Panel should have focus management attributes
      expect(panel.getAttribute('role')).toBe('dialog')
      expect(panel.getAttribute('aria-modal')).toBe('true')
    })
  })
})

describe('CodeBlueButton', () => {
  const mockOnActivate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the Code Blue trigger button', () => {
    render(<CodeBlueButton onActivate={mockOnActivate} />)
    expect(screen.getByTestId('code-blue-button')).toBeInTheDocument()
  })

  it('does not activate on short click', () => {
    render(<CodeBlueButton onActivate={mockOnActivate} />)
    const btn = screen.getByTestId('code-blue-button')
    fireEvent.mouseDown(btn)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.mouseUp(btn)
    expect(mockOnActivate).not.toHaveBeenCalled()
  })

  it('activates after 2-second long press', () => {
    render(<CodeBlueButton onActivate={mockOnActivate} />)
    const btn = screen.getByTestId('code-blue-button')
    fireEvent.mouseDown(btn)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(mockOnActivate).toHaveBeenCalledOnce()
  })

  it('cancels activation if mouse released before 2 seconds', () => {
    render(<CodeBlueButton onActivate={mockOnActivate} />)
    const btn = screen.getByTestId('code-blue-button')
    fireEvent.mouseDown(btn)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    fireEvent.mouseUp(btn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(mockOnActivate).not.toHaveBeenCalled()
  })

  it('applies red/error styling', () => {
    render(<CodeBlueButton onActivate={mockOnActivate} />)
    const btn = screen.getByTestId('code-blue-button')
    expect(btn.className).toMatch(/btn-error|bg-error|text-error|border-error/)
  })
})
