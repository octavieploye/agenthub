import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import RaidFrame from './RaidFrame'

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
    taskDescription: 'Fix the login bug in the auth module',
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

// Mock HeartbeatWaveform to isolate RaidFrame tests
vi.mock('@renderer/widgets/heartbeat-waveform/HeartbeatWaveform', () => ({
  default: ({ status }: { status: string }) => (
    <canvas data-testid="heartbeat-waveform" data-status={status} />
  )
}))

describe('RaidFrame', () => {
  const mockOnSelect = vi.fn()
  const mockOnContextMenu = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('agent information display', () => {
    it('renders agent name', () => {
      const agent = createMockAgent({ name: 'my-coding-agent' })
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      expect(screen.getByText('my-coding-agent')).toBeInTheDocument()
    })

    it('shows a compact model name and exposes the raw model ID accessibly', () => {
      const agent = createMockAgent({ model: 'claude-sonnet-4-6' })
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      expect(screen.getByTestId('model-badge')).toHaveTextContent('Sonnet 4.6')
      expect(screen.getByLabelText('Model: Sonnet 4.6 (claude-sonnet-4-6)')).toBeInTheDocument()
    })

    it('renders repo label from cwd (last path segment)', () => {
      const agent = createMockAgent({ cwd: '/Users/dev/workspace/my-repo' })
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      expect(screen.getByTestId('repo-label')).toHaveTextContent('my-repo')
    })

    it('renders truncated task description', () => {
      const longTask =
        'This is a very long task description that should be truncated when displayed in the raid frame widget'
      const agent = createMockAgent({ taskDescription: longTask })
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      const taskEl = screen.getByTestId('task-description')
      expect(taskEl).toBeInTheDocument()
      expect(taskEl.className).toMatch(/truncate|line-clamp/)
    })
  })

  describe('status dot', () => {
    it('announces that a locked agent needs user input', () => {
      const agent = createMockAgent({ status: 'locked' })
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      expect(screen.getByRole('status', { name: 'Status: Needs your input' })).toHaveAttribute(
        'title',
        'Needs your input'
      )
    })
  })

  describe('confidence indicator', () => {
    it('renders pulsing confidence indicator for inferred', () => {
      const agent = createMockAgent({ confidence: 'inferred' })
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator.className).toMatch(/animate-pulse|pulsing/)
    })

    it('renders solid confidence indicator for confirmed', () => {
      const agent = createMockAgent({ confidence: 'confirmed' })
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator.className).not.toMatch(/animate-pulse|pulsing/)
    })
  })

  describe('interactions', () => {
    it('fires onSelect callback when clicked', () => {
      const agent = createMockAgent()
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      const frame = screen.getByTestId('raid-frame')
      fireEvent.click(frame)
      expect(mockOnSelect).toHaveBeenCalledWith(agent.id)
    })

    it('fires onContextMenu callback on right-click with agent id and position', () => {
      const agent = createMockAgent()
      render(<RaidFrame agent={agent} onSelect={mockOnSelect} onContextMenu={mockOnContextMenu} />)
      const frame = screen.getByTestId('raid-frame')
      fireEvent.contextMenu(frame, { clientX: 200, clientY: 300 })
      expect(mockOnContextMenu).toHaveBeenCalledWith(agent.id, { x: 200, y: 300 })
    })
  })
})
