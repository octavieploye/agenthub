import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import AgentContextMenu from './AgentContextMenu'

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

describe('AgentContextMenu', () => {
  const defaultProps = {
    agent: createMockAgent(),
    position: { x: 100, y: 200 },
    onClose: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onKill: vi.fn(),
    onViewOutput: vi.fn(),
    onCopyId: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('menu rendering', () => {
    it('renders the context menu container', () => {
      render(<AgentContextMenu {...defaultProps} />)
      expect(screen.getByTestId('context-menu')).toBeInTheDocument()
    })

    it('positions menu at the provided coordinates', () => {
      render(<AgentContextMenu {...defaultProps} position={{ x: 150, y: 300 }} />)
      const menu = screen.getByTestId('context-menu')
      expect(menu.style.left).toBe('150px')
      expect(menu.style.top).toBe('300px')
    })

    it('applies panel-glass styling with no hard borders', () => {
      render(<AgentContextMenu {...defaultProps} />)
      const menu = screen.getByTestId('context-menu')
      expect(menu.className).toMatch(/panel-glass/)
      expect(menu.className).not.toMatch(/border-solid/)
    })
  })

  describe('menu items for busy agent', () => {
    it('shows Pause option for busy agent', () => {
      render(<AgentContextMenu {...defaultProps} agent={createMockAgent({ status: 'busy' })} />)
      expect(screen.getByTestId('context-menu-pause')).toBeInTheDocument()
    })

    it('does not show Resume for busy agent', () => {
      render(<AgentContextMenu {...defaultProps} agent={createMockAgent({ status: 'busy' })} />)
      expect(screen.queryByTestId('context-menu-resume')).not.toBeInTheDocument()
    })

    it('shows View Output option', () => {
      render(<AgentContextMenu {...defaultProps} />)
      expect(screen.getByTestId('context-menu-view-output')).toBeInTheDocument()
    })

    it('shows Copy Agent ID option', () => {
      render(<AgentContextMenu {...defaultProps} />)
      expect(screen.getByTestId('context-menu-copy-id')).toBeInTheDocument()
    })
  })

  describe('menu items for paused agent', () => {
    it('shows Resume option for paused agent', () => {
      render(
        <AgentContextMenu {...defaultProps} agent={createMockAgent({ status: 'paused' })} />
      )
      expect(screen.getByTestId('context-menu-resume')).toBeInTheDocument()
    })

    it('does not show Pause for paused agent', () => {
      render(
        <AgentContextMenu {...defaultProps} agent={createMockAgent({ status: 'paused' })} />
      )
      expect(screen.queryByTestId('context-menu-pause')).not.toBeInTheDocument()
    })
  })

  describe('destructive action placement', () => {
    it('shows Kill option', () => {
      render(<AgentContextMenu {...defaultProps} />)
      expect(screen.getByTestId('context-menu-kill')).toBeInTheDocument()
    })

    it('renders divider before Kill action', () => {
      render(<AgentContextMenu {...defaultProps} />)
      expect(screen.getByTestId('context-menu-divider')).toBeInTheDocument()
    })

    it('applies red/error text to Kill action', () => {
      render(<AgentContextMenu {...defaultProps} />)
      const killItem = screen.getByTestId('context-menu-kill')
      expect(killItem.className).toMatch(/text-error|text-red/)
    })
  })

  describe('callbacks', () => {
    it('fires onPause with agent id when Pause clicked', () => {
      render(<AgentContextMenu {...defaultProps} />)
      fireEvent.click(screen.getByTestId('context-menu-pause'))
      expect(defaultProps.onPause).toHaveBeenCalledWith('agent-1')
    })

    it('fires onKill with agent id when Kill clicked', () => {
      render(<AgentContextMenu {...defaultProps} />)
      fireEvent.click(screen.getByTestId('context-menu-kill'))
      expect(defaultProps.onKill).toHaveBeenCalledWith('agent-1')
    })

    it('fires onViewOutput with agent id when View Output clicked', () => {
      render(<AgentContextMenu {...defaultProps} />)
      fireEvent.click(screen.getByTestId('context-menu-view-output'))
      expect(defaultProps.onViewOutput).toHaveBeenCalledWith('agent-1')
    })

    it('fires onCopyId with agent id when Copy Agent ID clicked', () => {
      render(<AgentContextMenu {...defaultProps} />)
      fireEvent.click(screen.getByTestId('context-menu-copy-id'))
      expect(defaultProps.onCopyId).toHaveBeenCalledWith('agent-1')
    })

    it('fires onClose when menu item is clicked', () => {
      render(<AgentContextMenu {...defaultProps} />)
      fireEvent.click(screen.getByTestId('context-menu-view-output'))
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('breakout terminal menu item', () => {
    it('renders Breakout Terminal item when onBreakout prop is provided', () => {
      const onBreakout = vi.fn()
      render(<AgentContextMenu {...defaultProps} onBreakout={onBreakout} />)
      expect(screen.getByTestId('context-menu-breakout')).toBeInTheDocument()
    })

    it('does not render Breakout Terminal item when onBreakout prop is not provided', () => {
      render(<AgentContextMenu {...defaultProps} />)
      expect(screen.queryByTestId('context-menu-breakout')).not.toBeInTheDocument()
    })

    it('fires onBreakout with agent id and closes menu when Breakout Terminal clicked', () => {
      const onBreakout = vi.fn()
      render(<AgentContextMenu {...defaultProps} onBreakout={onBreakout} />)
      fireEvent.click(screen.getByTestId('context-menu-breakout'))
      expect(onBreakout).toHaveBeenCalledWith('agent-1')
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })
})
