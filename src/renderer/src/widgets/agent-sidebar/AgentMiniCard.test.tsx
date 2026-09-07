import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import AgentMiniCard from './AgentMiniCard'

// Mock hooks that rely on internal stores / IPC
vi.mock('@renderer/hooks/use-settled-status', () => ({
  useSettledStatus: (status: string) => status,
}))

vi.mock('@renderer/utils/model-utils', () => ({
  getShortModelName: (model: string) => model,
}))

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'Test Agent',
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
    executionMode: 'native',
    voiceMode: 'off',
    telegramNotify: false,
    ...overrides,
  }
}

const defaultProps = {
  agent: createMockAgent(),
  isActive: false,
  isRead: false,
  onSelectAgent: vi.fn(),
}

describe('AgentMiniCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Continue and View buttons — completed status', () => {
    it('shows "Continue" button when status is completed', () => {
      render(
        <AgentMiniCard
          {...defaultProps}
          agent={createMockAgent({ status: 'completed' })}
        />
      )
      expect(screen.getByText('Continue')).toBeInTheDocument()
    })

    it('shows "View" button when status is completed', () => {
      render(
        <AgentMiniCard
          {...defaultProps}
          agent={createMockAgent({ status: 'completed' })}
        />
      )
      expect(screen.getByText('View')).toBeInTheDocument()
    })

    it('shows "Continue" and "View" buttons when status is interrupted', () => {
      render(
        <AgentMiniCard
          {...defaultProps}
          agent={createMockAgent({ status: 'interrupted' })}
        />
      )
      expect(screen.getByText('Continue')).toBeInTheDocument()
      expect(screen.getByText('View')).toBeInTheDocument()
    })
  })

  describe('Continue and View buttons — active statuses', () => {
    it('does NOT show Continue or View when status is running (busy)', () => {
      render(
        <AgentMiniCard
          {...defaultProps}
          agent={createMockAgent({ status: 'busy' })}
        />
      )
      expect(screen.queryByText('Continue')).not.toBeInTheDocument()
      expect(screen.queryByText('View')).not.toBeInTheDocument()
    })

    it('does NOT show Continue or View when status is idle', () => {
      render(
        <AgentMiniCard
          {...defaultProps}
          agent={createMockAgent({ status: 'idle' })}
        />
      )
      expect(screen.queryByText('Continue')).not.toBeInTheDocument()
      expect(screen.queryByText('View')).not.toBeInTheDocument()
    })
  })

  describe('callback behavior', () => {
    it('calls onContinue with agent.id when Continue is clicked', () => {
      const onContinue = vi.fn()
      render(
        <AgentMiniCard
          {...defaultProps}
          agent={createMockAgent({ status: 'completed' })}
          onContinue={onContinue}
        />
      )
      fireEvent.click(screen.getByText('Continue'))
      expect(onContinue).toHaveBeenCalledWith('agent-1')
    })

    it('calls onView with agent.id when View is clicked', () => {
      const onView = vi.fn()
      render(
        <AgentMiniCard
          {...defaultProps}
          agent={createMockAgent({ status: 'completed' })}
          onView={onView}
        />
      )
      fireEvent.click(screen.getByText('View'))
      expect(onView).toHaveBeenCalledWith('agent-1')
    })
  })
})
