import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, AgentLifecycleStatus, ModelProvider } from '@shared/types/agent.types'
import SABar from './SABar'

// Mock the view store
const mockSetViewMode = vi.fn()
const mockSetStatusFilter = vi.fn()
const mockToggleSound = vi.fn()

vi.mock('@renderer/stores/view-store', () => ({
  useViewStore: vi.fn((selector) => {
    const state = {
      viewMode: 'raid' as const,
      setViewMode: mockSetViewMode,
      statusFilter: null,
      setStatusFilter: mockSetStatusFilter,
      soundEnabled: true,
      toggleSound: mockToggleSound
    }
    return typeof selector === 'function' ? selector(state) : state
  })
}))

// Mock child components that have their own dependencies
vi.mock('../theme-switcher/ThemeSwitcher', () => ({
  default: () => <div data-testid="theme-switcher" />
}))
vi.mock('../skills-dropdown/SkillsDropdown', () => ({
  default: () => <div data-testid="skills-dropdown" />
}))
vi.mock('../repo-switcher/RepoSwitcher', () => ({
  default: vi.fn().mockReturnValue(<div data-testid="repo-switcher" />)
}))
vi.mock('../help-popover/HelpPopover', () => ({
  default: () => <div data-testid="help-popover" />
}))
vi.mock('../code-blue/CodeBlueButton', () => ({
  default: ({ onActivate }: { onActivate: () => void }) => <button data-testid="code-blue" onClick={onActivate} />
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

describe('SABar', () => {
  const mockAgents: AgentState[] = [
    createMockAgent({ id: 'a1', status: 'busy' }),
    createMockAgent({ id: 'a2', status: 'busy' }),
    createMockAgent({ id: 'a3', status: 'locked' }),
    createMockAgent({ id: 'a4', status: 'paused' }),
    createMockAgent({ id: 'a5', status: 'completed' }),
    createMockAgent({ id: 'a6', status: 'completed' })
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    window.agentHub = {
      docker: {
        status: vi.fn().mockResolvedValue({ success: true, data: { available: true, version: '24.0', imageReady: true, imageTag: 'agenthub-cli:latest', activeContainerCount: 0 } })
      },
      system: {
        getAppVersion: vi.fn().mockResolvedValue('1.0.0-test')
      }
    } as any
  })

  describe('view mode toggle', () => {
    it('renders view mode toggle with two buttons', () => {
      render(<SABar agents={mockAgents} />)
      expect(screen.getByTestId('view-mode-raid')).toBeInTheDocument()
      expect(screen.queryByTestId('view-mode-channel')).not.toBeInTheDocument()
      expect(screen.getByTestId('view-mode-terminal')).toBeInTheDocument()
    })

    it('clicking raid view mode button calls setViewMode with raid', () => {
      render(<SABar agents={mockAgents} />)
      fireEvent.click(screen.getByTestId('view-mode-raid'))
      expect(mockSetViewMode).toHaveBeenCalledWith('raid')
    })

    it('clicking terminal view mode button calls setViewMode with terminal', () => {
      render(<SABar agents={mockAgents} />)
      fireEvent.click(screen.getByTestId('view-mode-terminal'))
      expect(mockSetViewMode).toHaveBeenCalledWith('terminal')
    })
  })

  describe('sound toggle', () => {
    it('renders sound toggle button', () => {
      render(<SABar agents={mockAgents} />)
      expect(screen.getByTestId('sound-toggle')).toBeInTheDocument()
    })

    it('clicking sound toggle calls toggleSound', () => {
      render(<SABar agents={mockAgents} />)
      fireEvent.click(screen.getByTestId('sound-toggle'))
      expect(mockToggleSound).toHaveBeenCalled()
    })
  })

  describe('layout', () => {
    it('has fixed 56px height', () => {
      render(<SABar agents={mockAgents} />)
      const bar = screen.getByTestId('sa-bar')
      expect(bar.className).toMatch(/h-14/)
    })
  })
})
