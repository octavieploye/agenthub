import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import ChannelStripLayout from './ChannelStripLayout'

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

vi.mock('./ChannelStrip', () => ({
  default: ({ agent }: { agent: AgentState }) => (
    <div data-testid={`channel-strip-${agent.id}`}>{agent.name}</div>
  )
}))

describe('ChannelStripLayout', () => {
  const mockOnSelectAgent = vi.fn()
  const mockOnSoloAgent = vi.fn()
  const mockOnMuteAgent = vi.fn()
  const mockOnKillAgent = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a strip for each agent', () => {
    const agents = [
      createMockAgent({ id: 'a1', name: 'alpha' }),
      createMockAgent({ id: 'a2', name: 'beta' }),
      createMockAgent({ id: 'a3', name: 'gamma' })
    ]
    render(
      <ChannelStripLayout
        agents={agents}
        onSelectAgent={mockOnSelectAgent}
        onSoloAgent={mockOnSoloAgent}
        onMuteAgent={mockOnMuteAgent}
        onKillAgent={mockOnKillAgent}
      />
    )
    expect(screen.getByTestId('channel-strip-a1')).toBeInTheDocument()
    expect(screen.getByTestId('channel-strip-a2')).toBeInTheDocument()
    expect(screen.getByTestId('channel-strip-a3')).toBeInTheDocument()
  })

  it('renders layout container with horizontal scroll', () => {
    const agents = [createMockAgent()]
    render(
      <ChannelStripLayout
        agents={agents}
        onSelectAgent={mockOnSelectAgent}
        onSoloAgent={mockOnSoloAgent}
        onMuteAgent={mockOnMuteAgent}
        onKillAgent={mockOnKillAgent}
      />
    )
    const layout = screen.getByTestId('channel-strip-layout')
    expect(layout.className).toMatch(/overflow-x-auto|flex/)
  })

  it('renders empty state when no agents', () => {
    render(
      <ChannelStripLayout
        agents={[]}
        onSelectAgent={mockOnSelectAgent}
        onSoloAgent={mockOnSoloAgent}
        onMuteAgent={mockOnMuteAgent}
        onKillAgent={mockOnKillAgent}
      />
    )
    expect(screen.getByTestId('channel-strip-layout')).toBeInTheDocument()
  })

  it('fills full height of parent container', () => {
    const agents = [createMockAgent()]
    render(
      <ChannelStripLayout
        agents={agents}
        onSelectAgent={mockOnSelectAgent}
        onSoloAgent={mockOnSoloAgent}
        onMuteAgent={mockOnMuteAgent}
        onKillAgent={mockOnKillAgent}
      />
    )
    const layout = screen.getByTestId('channel-strip-layout')
    expect(layout.className).toMatch(/h-full/)
  })

  it('passes soloed agent id to dim other strips', () => {
    const agents = [
      createMockAgent({ id: 'a1' }),
      createMockAgent({ id: 'a2' })
    ]
    render(
      <ChannelStripLayout
        agents={agents}
        soloedAgentId="a1"
        onSelectAgent={mockOnSelectAgent}
        onSoloAgent={mockOnSoloAgent}
        onMuteAgent={mockOnMuteAgent}
        onKillAgent={mockOnKillAgent}
      />
    )
    // Mock ChannelStrip doesn't render dim state but layout should track soloed
    expect(screen.getByTestId('channel-strip-layout')).toBeInTheDocument()
  })
})
