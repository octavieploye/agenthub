import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import TerminalToolbar from './TerminalToolbar'

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

describe('TerminalToolbar', () => {
  const defaultProps = {
    agent: createMockAgent(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onForceKill: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders the toolbar container', () => {
      render(<TerminalToolbar {...defaultProps} />)
      expect(screen.getByTestId('terminal-toolbar')).toBeInTheDocument()
    })

    it('renders Pause button', () => {
      render(<TerminalToolbar {...defaultProps} />)
      expect(screen.getByTestId('toolbar-pause')).toBeInTheDocument()
    })

    it('renders Stop button', () => {
      render(<TerminalToolbar {...defaultProps} />)
      expect(screen.getByTestId('toolbar-stop')).toBeInTheDocument()
    })

    it('renders Force Kill button', () => {
      render(<TerminalToolbar {...defaultProps} />)
      expect(screen.getByTestId('toolbar-force-kill')).toBeInTheDocument()
    })
  })

  describe('callbacks', () => {
    it('fires onPause with agent id when Pause clicked', () => {
      render(<TerminalToolbar {...defaultProps} />)
      fireEvent.click(screen.getByTestId('toolbar-pause'))
      expect(defaultProps.onPause).toHaveBeenCalledWith('agent-1')
    })

    it('fires onStop with agent id when Stop clicked', () => {
      render(<TerminalToolbar {...defaultProps} />)
      fireEvent.click(screen.getByTestId('toolbar-stop'))
      expect(defaultProps.onStop).toHaveBeenCalledWith('agent-1')
    })

    it('fires onForceKill only after 2-second long-press on Force Kill button', () => {
      render(<TerminalToolbar {...defaultProps} />)
      const btn = screen.getByTestId('toolbar-force-kill')

      fireEvent.mouseDown(btn)
      // Before 2 seconds, should NOT fire
      vi.advanceTimersByTime(1500)
      expect(defaultProps.onForceKill).not.toHaveBeenCalled()

      // After 2 seconds total, should fire
      vi.advanceTimersByTime(500)
      expect(defaultProps.onForceKill).toHaveBeenCalledWith('agent-1')
    })

    it('cancels force kill if mouse released before 2 seconds', () => {
      render(<TerminalToolbar {...defaultProps} />)
      const btn = screen.getByTestId('toolbar-force-kill')

      fireEvent.mouseDown(btn)
      vi.advanceTimersByTime(1000)
      fireEvent.mouseUp(btn)
      vi.advanceTimersByTime(2000)

      expect(defaultProps.onForceKill).not.toHaveBeenCalled()
    })
  })

  describe('conditional rendering', () => {
    it('shows Resume instead of Pause when agent is paused', () => {
      render(
        <TerminalToolbar {...defaultProps} agent={createMockAgent({ status: 'paused' })} />
      )
      expect(screen.queryByTestId('toolbar-pause')).not.toBeInTheDocument()
      expect(screen.getByTestId('toolbar-resume')).toBeInTheDocument()
    })

    it('disables Stop and Force Kill for completed agents', () => {
      render(
        <TerminalToolbar {...defaultProps} agent={createMockAgent({ status: 'completed' })} />
      )
      expect(screen.getByTestId('toolbar-stop')).toBeDisabled()
      expect(screen.getByTestId('toolbar-force-kill')).toBeDisabled()
    })
  })

  describe('breakout button', () => {
    it('renders Breakout button when onBreakout prop is provided', () => {
      const onBreakout = vi.fn()
      render(<TerminalToolbar {...defaultProps} onBreakout={onBreakout} />)
      expect(screen.getByTestId('toolbar-breakout')).toBeInTheDocument()
    })

    it('does not render Breakout button when onBreakout prop is not provided', () => {
      render(<TerminalToolbar {...defaultProps} />)
      expect(screen.queryByTestId('toolbar-breakout')).not.toBeInTheDocument()
    })

    it('fires onBreakout with agent id when Breakout clicked', () => {
      const onBreakout = vi.fn()
      render(<TerminalToolbar {...defaultProps} onBreakout={onBreakout} />)
      fireEvent.click(screen.getByTestId('toolbar-breakout'))
      expect(onBreakout).toHaveBeenCalledWith('agent-1')
    })
  })
})
