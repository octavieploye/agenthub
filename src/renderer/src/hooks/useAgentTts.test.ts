import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentTts } from './useAgentTts'
import type { AgentState } from '@shared/types/agent.types'

// ─── Minimal window.agentHub stub ────────────────────────────────────────────

type ResponseReadyCb = (agentId: string, text: string) => void

function makeAgentHub() {
  const responseListeners: ResponseReadyCb[] = []
  const ttsSpeak = vi.fn().mockResolvedValue({})
  return {
    on: {
      agentStatusChange: vi.fn(() => vi.fn()),
    },
    tts: {
      speak: ttsSpeak,
      onResponseReady: vi.fn((cb: ResponseReadyCb) => {
        responseListeners.push(cb)
        return () => responseListeners.splice(responseListeners.indexOf(cb), 1)
      }),
    },
    _emit: {
      responseReady: (agentId: string, text: string) =>
        responseListeners.forEach((l) => l(agentId, text)),
    },
  }
}

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    name: 'Sam',
    status: 'idle',
    confidence: 'inferred',
    cwd: '/repo',
    color: '#3B82F6',
    voiceMode: 'always_on',
    model: null,
    taskDescription: null,
    repoId: null,
    pid: null,
    createdAt: '',
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  const hub = makeAgentHub()
  ;(window as unknown as Record<string, unknown>).agentHub = hub
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAgentTts — onResponseReady', () => {
  it('speaks announcement + last paragraph on responseReady (always_on)', async () => {
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    const text = 'First paragraph.\n\nFinal response paragraph here.'

    await act(async () => {
      hub._emit.responseReady('agent-1', text)
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(2)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe('Sam has responded.')
    expect(hub.tts.speak.mock.calls[1][0].text).toBe('Final response paragraph here.')
  })

  it('speaks only announcement on responseReady (speak_up)', async () => {
    const agent = makeAgent({ voiceMode: 'speak_up' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Some response.')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe('Sam has responded.')
  })

  it('does not speak when voiceMode is off', async () => {
    const agent = makeAgent({ voiceMode: 'off' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Some response.')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })

  it('calls onNotificationSound when voiceMode is off and response arrives', async () => {
    const agent = makeAgent({ voiceMode: 'off' })
    const agents = new Map([['agent-1', agent]])
    const onNotificationSound = vi.fn()
    renderHook(() => useAgentTts(agents, { onNotificationSound }))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Some response.')
    })

    expect(onNotificationSound).toHaveBeenCalledOnce()
    expect(hub.tts.speak).not.toHaveBeenCalled()
  })

  it('does NOT call onNotificationSound when voiceMode is always_on', async () => {
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    const onNotificationSound = vi.fn()
    renderHook(() => useAgentTts(agents, { onNotificationSound }))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Some response text here that is long enough.')
    })

    expect(onNotificationSound).not.toHaveBeenCalled()
    expect(hub.tts.speak).toHaveBeenCalled()
  })

  it('does NOT call onNotificationSound when voiceMode is speak_up', async () => {
    const agent = makeAgent({ voiceMode: 'speak_up' })
    const agents = new Map([['agent-1', agent]])
    const onNotificationSound = vi.fn()
    renderHook(() => useAgentTts(agents, { onNotificationSound }))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Some response.')
    })

    expect(onNotificationSound).not.toHaveBeenCalled()
    expect(hub.tts.speak).toHaveBeenCalled()
  })

  it('does not speak for unknown agentId', async () => {
    const agent = makeAgent()
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-unknown', 'Some response.')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })

  it('readFullResponse speaks the last stored text', async () => {
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    const { result } = renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    // Fire first response to store text
    await act(async () => {
      hub._emit.responseReady('agent-1', 'Stored response text.')
    })
    hub.tts.speak.mockClear()

    // Replay via readFullResponse
    await act(async () => {
      result.current.readFullResponse('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toContain('Stored response text.')
  })

  it('speaks announcement even when cleanText is empty (tool-only response)', async () => {
    const agent = makeAgent({ voiceMode: 'speak_up' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', '')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe('Sam has responded.')
  })

  it('fires exactly once even when responseReady fires in rapid succession', async () => {
    const agent = makeAgent({ voiceMode: 'speak_up' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Response one.')
    })
    await act(async () => {
      hub._emit.responseReady('agent-1', 'Response two.')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(2)
  })
})
