import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import GeneralTab from './GeneralTab'
import { AGENT_COLOR_PALETTE } from '@shared/constants/defaults'

// Mock the useNow hook to return a stable timestamp
vi.mock('@renderer/hooks/useNow', () => ({
  useNow: () => new Date('2026-03-06T01:00:00Z').getTime()
}))

// Mock agent store
const mockUpdateColor = vi.fn()
vi.mock('@renderer/stores/agent-store', () => ({
  useAgentStore: vi.fn((selector) =>
    selector({ updateColor: mockUpdateColor })
  )
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

describe('GeneralTab', () => {
  const defaultProps = {
    agent: createMockAgent(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onKill: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.agentHub = {
      agents: {
        updateColor: vi.fn().mockResolvedValue({ success: true, data: undefined })
      }
    } as any
  })

  describe('color picker', () => {
    it('renders the color picker section', () => {
      render(<GeneralTab {...defaultProps} />)
      expect(screen.getByTestId('color-picker-section')).toBeInTheDocument()
    })

    it('renders all 10 palette swatches', () => {
      render(<GeneralTab {...defaultProps} />)
      for (const color of AGENT_COLOR_PALETTE) {
        expect(screen.getByTestId(`color-swatch-${color}`)).toBeInTheDocument()
      }
    })

    it('highlights the currently selected color with border-white', () => {
      render(<GeneralTab {...defaultProps} />)
      const activeSwatch = screen.getByTestId(`color-swatch-#3B82F6`)
      expect(activeSwatch.className).toMatch(/border-white/)
    })

    it('calls updateColor on store and IPC when a swatch is clicked', () => {
      render(<GeneralTab {...defaultProps} />)
      const newColor = '#EF4444'
      fireEvent.click(screen.getByTestId(`color-swatch-${newColor}`))
      expect(mockUpdateColor).toHaveBeenCalledWith('agent-1', newColor)
      expect(window.agentHub.agents.updateColor).toHaveBeenCalledWith('agent-1', newColor)
    })

    it('updates visual highlight when a different swatch is clicked', () => {
      render(<GeneralTab {...defaultProps} />)
      const newColor = '#10B981'
      fireEvent.click(screen.getByTestId(`color-swatch-${newColor}`))
      const newSwatch = screen.getByTestId(`color-swatch-${newColor}`)
      expect(newSwatch.className).toMatch(/border-white/)
    })
  })

  describe('agent identity rendering', () => {
    it('renders the agent name', () => {
      render(<GeneralTab {...defaultProps} />)
      expect(screen.getByTestId('general-agent-name')).toHaveTextContent('test-agent')
    })

    it('renders the status badge', () => {
      render(<GeneralTab {...defaultProps} />)
      expect(screen.getByTestId('general-status-badge')).toHaveTextContent('busy')
    })

    it('renders model info', () => {
      render(<GeneralTab {...defaultProps} />)
      expect(screen.getByTestId('general-model')).toHaveTextContent('claude-sonnet-4-6')
    })
  })

  describe('action buttons', () => {
    it('shows Pause button for busy agent', () => {
      render(<GeneralTab {...defaultProps} />)
      expect(screen.getByTestId('general-pause-button')).toBeInTheDocument()
    })

    it('shows Resume button for paused agent', () => {
      render(<GeneralTab {...defaultProps} agent={createMockAgent({ status: 'paused' })} />)
      expect(screen.getByTestId('general-resume-button')).toBeInTheDocument()
    })

    it('shows Kill button for non-terminal agents', () => {
      render(<GeneralTab {...defaultProps} />)
      expect(screen.getByTestId('general-kill-button')).toBeInTheDocument()
    })

    it('hides Kill button for completed agents', () => {
      render(<GeneralTab {...defaultProps} agent={createMockAgent({ status: 'completed' })} />)
      expect(screen.queryByTestId('general-kill-button')).not.toBeInTheDocument()
    })
  })
})
