import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import RaidFrameGrid from './RaidFrameGrid'

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

// Mock RaidFrame to isolate grid tests
vi.mock('./RaidFrame', () => ({
  default: ({ agent }: { agent: AgentState }) => (
    <div data-testid={`raid-frame-${agent.id}`}>{agent.name}</div>
  )
}))

// Mock view store
vi.mock('@renderer/stores/view-store', () => ({
  useViewStore: vi.fn((selector) => {
    const state = {
      statusFilter: null as string | null,
      focusedAgentId: null as string | null
    }
    return typeof selector === 'function' ? selector(state) : state
  })
}))

describe('RaidFrameGrid', () => {
  const mockAgents: AgentState[] = [
    createMockAgent({ id: 'a1', name: 'agent-alpha', status: 'busy' }),
    createMockAgent({ id: 'a2', name: 'agent-beta', status: 'locked' }),
    createMockAgent({ id: 'a3', name: 'agent-gamma', status: 'completed' }),
    createMockAgent({ id: 'a4', name: 'agent-delta', status: 'paused' })
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correct number of RaidFrame items for given agents', () => {
    render(<RaidFrameGrid agents={mockAgents} />)
    expect(screen.getByTestId('raid-frame-a1')).toBeInTheDocument()
    expect(screen.getByTestId('raid-frame-a2')).toBeInTheDocument()
    expect(screen.getByTestId('raid-frame-a3')).toBeInTheDocument()
    expect(screen.getByTestId('raid-frame-a4')).toBeInTheDocument()
  })

  it('applies CSS grid layout class', () => {
    render(<RaidFrameGrid agents={mockAgents} />)
    const grid = screen.getByTestId('raid-frame-grid')
    expect(grid.className).toMatch(/grid/)
  })

  it('filters agents when statusFilter is set', async () => {
    // Re-mock with a status filter
    const { useViewStore } = await import('@renderer/stores/view-store')
    vi.mocked(useViewStore).mockImplementation((selector) => {
      const state = {
        statusFilter: 'busy' as string | null,
        focusedAgentId: null as string | null
      }
      return typeof selector === 'function' ? selector(state) : state
    })

    render(<RaidFrameGrid agents={mockAgents} />)
    expect(screen.getByTestId('raid-frame-a1')).toBeInTheDocument()
    expect(screen.queryByTestId('raid-frame-a2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('raid-frame-a3')).not.toBeInTheDocument()
    expect(screen.queryByTestId('raid-frame-a4')).not.toBeInTheDocument()
  })

  it('shows empty state when no agents match filter', async () => {
    const { useViewStore } = await import('@renderer/stores/view-store')
    vi.mocked(useViewStore).mockImplementation((selector) => {
      const state = {
        statusFilter: 'spawning' as string | null,
        focusedAgentId: null as string | null
      }
      return typeof selector === 'function' ? selector(state) : state
    })

    render(<RaidFrameGrid agents={mockAgents} />)
    expect(screen.getByTestId('raid-frame-grid-empty')).toBeInTheDocument()
  })
})
