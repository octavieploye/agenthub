import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKanbanHydration } from './useKanbanHydration'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'a1',
    name: 'Scout',
    status: 'idle',
    confidence: 'confirmed',
    color: '#3B82F6',
    repoId: 'r1',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic' as ModelProvider,
    effortLevel: 'medium',
    taskDescription: '',
    pid: null,
    ptyFd: null,
    cwd: '/tmp',
    createdAt: '2026-06-21T00:00:00Z',
    updatedAt: '2026-06-21T00:00:00Z',
    progress: 0,
    executionMode: 'native',
    voiceMode: 'off',
    ...overrides
  }
}

function makeAgentHub() {
  return {
    agents: {
      list: vi.fn().mockResolvedValue({ success: true, data: [createMockAgent()] })
    },
    projects: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] })
    },
    on: {
      agentStatusChange: vi.fn(() => vi.fn()),
      agentSpawned: vi.fn(() => vi.fn())
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useKanbanHydration', () => {
  beforeEach(() => {
    ;(window as unknown as Record<string, unknown>).agentHub = makeAgentHub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls agents.list on mount', async () => {
    await act(async () => {
      renderHook(() => useKanbanHydration())
    })
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
    expect(hub.agents.list).toHaveBeenCalledOnce()
  })

  it('calls projects.list on mount (via fetchProjects)', async () => {
    await act(async () => {
      renderHook(() => useKanbanHydration())
    })
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
    expect(hub.projects.list).toHaveBeenCalledOnce()
  })

  it('registers agentStatusChange listener on mount', async () => {
    await act(async () => {
      renderHook(() => useKanbanHydration())
    })
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
    expect(hub.on.agentStatusChange).toHaveBeenCalledOnce()
  })

  it('calls the unsubs returned by agentStatusChange and agentSpawned on unmount', async () => {
    const unsubStatus = vi.fn()
    const unsubSpawned = vi.fn()
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
    hub.on.agentStatusChange = vi.fn(() => unsubStatus)
    hub.on.agentSpawned = vi.fn(() => unsubSpawned)

    let unmount!: () => void
    await act(async () => {
      const result = renderHook(() => useKanbanHydration())
      unmount = result.unmount
    })

    expect(unsubStatus).not.toHaveBeenCalled()
    expect(unsubSpawned).not.toHaveBeenCalled()
    unmount()
    expect(unsubStatus).toHaveBeenCalledOnce()
    expect(unsubSpawned).toHaveBeenCalledOnce()
  })
})
