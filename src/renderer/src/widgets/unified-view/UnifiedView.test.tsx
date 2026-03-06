import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import UnifiedView from './UnifiedView'

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic' as ModelProvider,
    taskDescription: 'Fix the login bug in the auth module',
    pid: 1234,
    ptyFd: null,
    cwd: '/Users/dev/project',
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    progress: 0.5,
    ...overrides
  }
}

// Mock child components to isolate UnifiedView
vi.mock('@renderer/widgets/raid-frame/RaidFrameGrid', () => ({
  default: ({ agents }: { agents: AgentState[] }) => (
    <div data-testid="raid-frame-grid">RaidFrameGrid ({agents.length} agents)</div>
  )
}))

vi.mock('@renderer/widgets/full-terminal/FullTerminal', () => ({
  default: ({ agentId }: { agentId: string }) => (
    <div data-testid="full-terminal">FullTerminal for {agentId}</div>
  )
}))

// Mock view store - default viewMode will be overridden per test
let mockViewMode: 'raid' | 'channel' | 'terminal' = 'raid'

vi.mock('@renderer/stores/view-store', () => ({
  useViewStore: vi.fn((selector) => {
    const state = {
      viewMode: mockViewMode,
      focusedAgentId: 'agent-1' as string | null
    }
    return typeof selector === 'function' ? selector(state) : state
  })
}))

// Mock matchMedia for prefers-reduced-motion
const mockMatchMedia = vi.fn()

describe('UnifiedView', () => {
  const mockAgents: AgentState[] = [
    createMockAgent({ id: 'a1', name: 'agent-alpha' }),
    createMockAgent({ id: 'a2', name: 'agent-beta' })
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockViewMode = 'raid'
    // Default: motion allowed
    window.matchMedia = mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  describe('view mode switching', () => {
    it('renders RaidFrameGrid when viewMode is raid', () => {
      mockViewMode = 'raid'
      render(<UnifiedView agents={mockAgents} />)
      expect(screen.getByTestId('raid-frame-grid')).toBeInTheDocument()
    })

    it('renders channel strip layout when viewMode is channel', () => {
      mockViewMode = 'channel'
      render(<UnifiedView agents={mockAgents} />)
      expect(screen.getByTestId('channel-strip-layout')).toBeInTheDocument()
    })

    it('renders FullTerminal when viewMode is terminal', () => {
      mockViewMode = 'terminal'
      render(<UnifiedView agents={mockAgents} />)
      expect(screen.getByTestId('full-terminal')).toBeInTheDocument()
    })
  })

  describe('transitions', () => {
    it('applies spatial-zoom animation class on view change', () => {
      mockViewMode = 'raid'
      render(<UnifiedView agents={mockAgents} />)
      const container = screen.getByTestId('unified-view')
      expect(container.className).toMatch(/spatial-zoom|animate-zoom/)
    })

    it('respects prefers-reduced-motion by not applying animation class', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
      mockViewMode = 'raid'
      render(<UnifiedView agents={mockAgents} />)
      const container = screen.getByTestId('unified-view')
      expect(container.className).not.toMatch(/spatial-zoom|animate-zoom/)
    })
  })
})
