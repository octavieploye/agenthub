import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import SABar from './widgets/sa-bar/SABar'
import AgentDetailPanel from './widgets/agent-detail/AgentDetailPanel'

// --- Mocks for SABar ---
vi.mock('@renderer/stores/view-store', () => ({
  useViewStore: vi.fn((selector) => {
    const state = {
      viewMode: 'raid' as const,
      setViewMode: vi.fn(),
      statusFilter: null,
      setStatusFilter: vi.fn(),
      soundEnabled: true,
      toggleSound: vi.fn(),
      focusedAgentId: null,
      setFocusedAgent: vi.fn()
    }
    return typeof selector === 'function' ? selector(state) : state
  })
}))

// --- Mocks for AgentDetailPanel sub-tabs ---
vi.mock('./widgets/agent-detail/GeneralTab', () => ({
  default: () => <div data-testid="mock-general-tab">General</div>
}))
vi.mock('./widgets/agent-detail/TerminalTab', () => ({
  default: () => <div data-testid="mock-terminal-tab">Terminal</div>
}))
vi.mock('./widgets/agent-detail/NotesTab', () => ({
  default: () => <div data-testid="mock-notes-tab">Notes</div>
}))
vi.mock('./widgets/agent-detail/HistoryTab', () => ({
  default: () => <div data-testid="mock-history-tab">History</div>
}))
vi.mock('./widgets/agent-detail/TodoTab', () => ({
  default: () => <div data-testid="mock-todo-tab">Todo</div>
}))
vi.mock('./widgets/agent-detail/BugsTab', () => ({
  default: () => <div data-testid="mock-bugs-tab">Bugs</div>
}))
vi.mock('./widgets/agent-detail/GitTab', () => ({
  default: () => <div data-testid="mock-git-tab">Git</div>
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

describe('Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('SABar aria-labels', () => {
    const mockAgents: AgentState[] = [
      createMockAgent({ id: 'a1', status: 'busy' }),
      createMockAgent({ id: 'a2', status: 'locked' }),
      createMockAgent({ id: 'a3', status: 'paused' }),
      createMockAgent({ id: 'a4', status: 'completed' })
    ]

    it('status counter buttons have aria-labels', () => {
      render(<SABar agents={mockAgents} />)
      const busyBtn = screen.getByTestId('status-counter-busy')
      expect(busyBtn).toHaveAttribute('aria-label')
      expect(busyBtn.getAttribute('aria-label')).toMatch(/filter/i)
    })

    it('view mode buttons have aria-labels', () => {
      render(<SABar agents={mockAgents} />)
      const raidBtn = screen.getByTestId('view-mode-raid')
      expect(raidBtn).toHaveAttribute('aria-label', 'Switch to Raid view')
      const channelBtn = screen.getByTestId('view-mode-channel')
      expect(channelBtn).toHaveAttribute('aria-label', 'Switch to Channel view')
      const terminalBtn = screen.getByTestId('view-mode-terminal')
      expect(terminalBtn).toHaveAttribute('aria-label', 'Switch to Terminal view')
    })
  })

  describe('AgentDetailPanel tab roles', () => {
    const defaultProps = {
      agent: createMockAgent(),
      onPause: vi.fn(),
      onResume: vi.fn(),
      onKill: vi.fn(),
      onSendInput: vi.fn(),
      onSpawnWithTask: vi.fn()
    }

    it('tab container has role="tablist"', () => {
      render(<AgentDetailPanel {...defaultProps} />)
      const tablist = screen.getByRole('tablist')
      expect(tablist).toBeInTheDocument()
    })

    it('each tab button has role="tab"', () => {
      render(<AgentDetailPanel {...defaultProps} />)
      const tabs = screen.getAllByRole('tab')
      expect(tabs.length).toBe(7) // general, terminal, notes, history, todo, bugs, git
    })

    it('active tab has aria-selected="true"', () => {
      render(<AgentDetailPanel {...defaultProps} initialTab="general" />)
      const generalTab = screen.getByTestId('tab-general')
      expect(generalTab).toHaveAttribute('aria-selected', 'true')
      const terminalTab = screen.getByTestId('tab-terminal')
      expect(terminalTab).toHaveAttribute('aria-selected', 'false')
    })

    it('tab content area has role="tabpanel"', () => {
      render(<AgentDetailPanel {...defaultProps} />)
      const tabpanel = screen.getByRole('tabpanel')
      expect(tabpanel).toBeInTheDocument()
    })
  })
})
