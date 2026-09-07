import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import AgentSidebar from './AgentSidebar'

// Mock stores used internally by AgentSidebar / AgentMiniCard / AgentCard
vi.mock('@renderer/stores/agent-store', () => ({
  useAgentStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      readAgentIds: new Set<string>(),
      updateColor: vi.fn(),
      updateTaskDescription: vi.fn(),
      renameAgent: vi.fn(),
    })
  ),
}))

vi.mock('@renderer/stores/skills-store', () => ({
  useSkillsStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      skills: [],
      fetchSkills: vi.fn(),
    })
  ),
}))

vi.mock('@renderer/stores/view-store', () => ({
  useViewStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ selectedRepoId: 'repo-1' })
  ),
}))

// Mock hooks that depend on IPC/system calls
vi.mock('@renderer/hooks/useBranchName', () => ({
  useBranchName: () => null,
}))

vi.mock('@renderer/hooks/use-settled-status', () => ({
  useSettledStatus: (status: string) => status,
}))

vi.mock('@renderer/utils/model-utils', () => ({
  getShortModelName: (model: string) => model,
}))

// Mock child components with internal dependencies to isolate AgentSidebar logic
vi.mock('./IntentInput', () => ({
  default: () => <div data-testid="intent-input" />,
}))

vi.mock('./ChipSurface', () => ({
  default: () => <div data-testid="chip-surface" />,
}))

vi.mock('./ChipOverflowRow', () => ({
  default: () => <div data-testid="chip-overflow-row" />,
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
  agents: [],
  activeAgentId: null,
  onSelectAgent: vi.fn(),
  onKillAgent: vi.fn(),
  onPauseAgent: vi.fn(),
  onResumeAgent: vi.fn(),
  onSpawnAgent: vi.fn(),
}

describe('AgentSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: listAll returns empty (no past sessions)
    window.electron = {
      ipcRenderer: {
        invoke: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
    } as any
  })

  describe('Past Sessions section', () => {
    it('shows a completed agent under "Past Sessions" heading when listAll returns completed agents', async () => {
      const completedAgent = createMockAgent({
        id: 'past-agent-1',
        name: 'Past Task Agent',
        status: 'completed',
      })

      window.electron = {
        ipcRenderer: {
          invoke: vi.fn().mockResolvedValue({
            success: true,
            data: [completedAgent],
          }),
        },
      } as any

      const activeAgent = createMockAgent({ id: 'active-1', status: 'busy', name: 'Active Agent' })

      render(
        <AgentSidebar
          {...defaultProps}
          agents={[activeAgent]}
        />
      )

      // Wait for the async IPC call to resolve and re-render
      const pastSessionsHeading = await screen.findByText(/Past Sessions/i)
      expect(pastSessionsHeading).toBeInTheDocument()

      // Completed agent name appears in the past sessions zone
      expect(screen.getByText('Past Task Agent')).toBeInTheDocument()
    })

    it('does NOT render "Past Sessions" section when no completed or interrupted agents exist', async () => {
      window.electron = {
        ipcRenderer: {
          invoke: vi.fn().mockResolvedValue({ success: true, data: [] }),
        },
      } as any

      render(
        <AgentSidebar
          {...defaultProps}
          agents={[createMockAgent({ id: 'active-1', status: 'busy' })]}
        />
      )

      // Give time for effect to settle
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(screen.queryByText(/Past Sessions/i)).not.toBeInTheDocument()
    })
  })
})
