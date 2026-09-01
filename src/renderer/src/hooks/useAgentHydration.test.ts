import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentHydration } from './useAgentHydration'
import { useAgentStore } from '../stores/agent-store'
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
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useAgentHydration', () => {
  beforeEach(() => {
    ;(window as unknown as Record<string, unknown>).agentHub = makeAgentHub()
    useAgentStore.setState({ agents: new Map(), activeAgentId: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls agents.list on mount', async () => {
    await act(async () => {
      renderHook(() => useAgentHydration())
    })
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
    expect(hub.agents.list).toHaveBeenCalledOnce()
  })

  it('hydrates the agent store from the list response', async () => {
    await act(async () => {
      renderHook(() => useAgentHydration())
    })
    expect(useAgentStore.getState().agents.size).toBe(1)
    expect(useAgentStore.getState().agents.get('a1')?.name).toBe('Scout')
  })

  it('does not hydrate when the list response is unsuccessful', async () => {
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
    hub.agents.list = vi.fn().mockResolvedValue({ success: false, error: { message: 'boom' } })

    await act(async () => {
      renderHook(() => useAgentHydration())
    })
    expect(useAgentStore.getState().agents.size).toBe(0)
  })
})
