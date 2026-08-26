import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RateLimitPrompt } from './RateLimitPrompt'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import type { AgentState } from '@shared/types/agent.types'

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'test-agent-id',
    name: 'test-agent',
    status: 'busy',
    cwd: '/tmp/test',
    model: 'claude-sonnet-4-6',
    pid: 1234,
    provider: 'anthropic',
    effortLevel: 'medium',
    color: '#3B82F6',
    startedAt: Date.now(),
    repoId: 'repo-1',
    voiceMode: 'off',
    telegramNotify: false,
    ...overrides
  }
}

describe('RateLimitPrompt', () => {
  let capturedCallback: ((agentId: string, detail: { provider: string; codexAvailable: boolean }) => void) | null
  let unsubFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    capturedCallback = null
    unsubFn = vi.fn()

    // Set up window.agentHub mock
    const mockAgentHub = {
      on: {
        agentRateLimited: vi.fn((cb: (agentId: string, detail: { provider: string; codexAvailable: boolean }) => void) => {
          capturedCallback = cb
          return unsubFn
        })
      },
      agents: {
        fallbackRespawn: vi.fn().mockResolvedValue({ success: true, data: createMockAgent() })
      }
    }
    ;(window as unknown as Record<string, unknown>).agentHub = mockAgentHub

    // Seed agent store with a test agent
    useAgentStore.getState().upsertAgent(createMockAgent())

    // Clear notification store
    useNotificationStore.getState().clearAll()
  })

  afterEach(() => {
    cleanup()
  })

  it('subscribes to agentRateLimited on mount', () => {
    render(<RateLimitPrompt />)
    expect(window.agentHub.on.agentRateLimited).toHaveBeenCalledOnce()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<RateLimitPrompt />)
    unmount()
    expect(unsubFn).toHaveBeenCalledOnce()
  })

  it('renders null (no visible DOM)', () => {
    const { container } = render(<RateLimitPrompt />)
    expect(container.innerHTML).toBe('')
  })

  it('shows warning toast with Switch to Codex action when codexAvailable=true', () => {
    render(<RateLimitPrompt />)
    capturedCallback!('test-agent-id', { provider: 'anthropic', codexAvailable: true })

    const toasts = useNotificationStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].severity).toBe('warning')
    expect(toasts[0].title).toBe('Rate limit hit')
    expect(toasts[0].message).toContain('test-agent')
    expect(toasts[0].message).toContain('anthropic')
    expect(toasts[0].actions).toHaveLength(2)
    expect(toasts[0].actions![0].label).toBe('Switch to Codex')
    expect(toasts[0].actions![1].label).toBe('Dismiss')
  })

  it('shows error toast without actions when codexAvailable=false', () => {
    render(<RateLimitPrompt />)
    capturedCallback!('test-agent-id', { provider: 'anthropic', codexAvailable: false })

    const toasts = useNotificationStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].severity).toBe('error')
    expect(toasts[0].title).toBe('Rate limit hit')
    expect(toasts[0].message).toContain('No fallback')
    expect(toasts[0].actions).toBeUndefined()
  })

  it('Switch to Codex action calls fallbackRespawn', () => {
    render(<RateLimitPrompt />)
    capturedCallback!('test-agent-id', { provider: 'anthropic', codexAvailable: true })

    const toasts = useNotificationStore.getState().toasts
    toasts[0].actions![0].onClick()

    expect(window.agentHub.agents.fallbackRespawn).toHaveBeenCalledWith(
      'test-agent-id',
      'openai-codex'
    )
  })

  it('Dismiss action removes the toast', () => {
    render(<RateLimitPrompt />)
    capturedCallback!('test-agent-id', { provider: 'anthropic', codexAvailable: true })

    expect(useNotificationStore.getState().toasts).toHaveLength(1)

    const toasts = useNotificationStore.getState().toasts
    toasts[0].actions![1].onClick()

    expect(useNotificationStore.getState().toasts).toHaveLength(0)
  })

  it('uses agent name from store when available', () => {
    useAgentStore.getState().upsertAgent(createMockAgent({ id: 'named-agent', name: 'my-fancy-agent' }))
    render(<RateLimitPrompt />)
    capturedCallback!('named-agent', { provider: 'anthropic', codexAvailable: true })

    const toasts = useNotificationStore.getState().toasts
    expect(toasts[0].message).toContain('my-fancy-agent')
  })

  it('falls back to truncated agentId when agent not in store', () => {
    render(<RateLimitPrompt />)
    capturedCallback!('unknown-agent-12345', { provider: 'anthropic', codexAvailable: false })

    const toasts = useNotificationStore.getState().toasts
    expect(toasts[0].message).toContain('unknown-')
  })
})
