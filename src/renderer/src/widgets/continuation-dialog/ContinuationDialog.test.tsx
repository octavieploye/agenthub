import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ModelProvider } from '@shared/types/agent.types'
import { ContinuationDialog } from './ContinuationDialog'

// Minimal AgentState-compatible mock that includes claudeSessionId (optional field added by fix-backend)
function createMockAgent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'Test Agent',
    status: 'completed',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic' as ModelProvider,
    effortLevel: 'medium',
    taskDescription: 'Build the login flow',
    pid: null,
    ptyFd: null,
    cwd: '/tmp/test',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T01:00:00Z',
    progress: 1,
    color: '#3B82F6',
    executionMode: 'native',
    voiceMode: 'off',
    telegramNotify: false,
    claudeSessionId: null,
    ...overrides,
  }
}

describe('ContinuationDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnSpawn = vi.fn().mockResolvedValue(null)

  beforeEach(() => {
    vi.clearAllMocks()

    window.agentHub = {
      recovery: {
        getSbar: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
      history: {
        get: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
    } as any
  })

  describe('True Resume toggle visibility', () => {
    it('shows "True Resume" toggle when agent has a claudeSessionId', async () => {
      const agent = createMockAgent({ claudeSessionId: 'abc-uuid' })
      render(
        <ContinuationDialog
          agent={agent as any}
          onClose={mockOnClose}
          onSpawn={mockOnSpawn}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading session context…')).not.toBeInTheDocument()
      })

      expect(screen.getByText('True Resume')).toBeInTheDocument()
    })

    it('does NOT show "True Resume" toggle when agent claudeSessionId is null', async () => {
      const agent = createMockAgent({ claudeSessionId: null })
      render(
        <ContinuationDialog
          agent={agent as any}
          onClose={mockOnClose}
          onSpawn={mockOnSpawn}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading session context…')).not.toBeInTheDocument()
      })

      expect(screen.queryByText('True Resume')).not.toBeInTheDocument()
    })

    it('does NOT show "True Resume" toggle when agent claudeSessionId is undefined', async () => {
      const agent = createMockAgent({ claudeSessionId: undefined })
      render(
        <ContinuationDialog
          agent={agent as any}
          onClose={mockOnClose}
          onSpawn={mockOnSpawn}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading session context…')).not.toBeInTheDocument()
      })

      expect(screen.queryByText('True Resume')).not.toBeInTheDocument()
    })
  })

  describe('True Resume spawn behavior', () => {
    it('calls onSpawn with resumeSessionId when True Resume is selected and Spawn is clicked', async () => {
      const agent = createMockAgent({ claudeSessionId: 'abc-uuid' })
      render(
        <ContinuationDialog
          agent={agent as any}
          onClose={mockOnClose}
          onSpawn={mockOnSpawn}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading session context…')).not.toBeInTheDocument()
      })

      // Select True Resume
      fireEvent.click(screen.getByText('True Resume'))

      // Click spawn
      fireEvent.click(screen.getByText('Spawn Agent'))

      await waitFor(() => {
        expect(mockOnSpawn).toHaveBeenCalledWith(
          '/tmp/test',
          'Test Agent (cont.)',
          'repo-1',
          expect.any(String),
          expect.any(String),
          'abc-uuid'
        )
      })
    })

    it('calls onSpawn WITHOUT resumeSessionId when Context Summary is selected (default)', async () => {
      const agent = createMockAgent({ claudeSessionId: 'abc-uuid' })
      render(
        <ContinuationDialog
          agent={agent as any}
          onClose={mockOnClose}
          onSpawn={mockOnSpawn}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading session context…')).not.toBeInTheDocument()
      })

      // Do NOT select True Resume — default is Context Summary
      fireEvent.click(screen.getByText('Spawn Agent'))

      await waitFor(() => {
        expect(mockOnSpawn).toHaveBeenCalledWith(
          '/tmp/test',
          'Test Agent (cont.)',
          'repo-1',
          expect.any(String),
          expect.any(String),
          undefined
        )
      })
    })
  })
})
