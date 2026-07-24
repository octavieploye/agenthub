import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentTts } from './useAgentTts'
import type { AgentState } from '@shared/types/agent.types'

// ─── Mock view-store (soundEnabled + voiceEnabled gate) ──────────────────────

const mockViewState = { soundEnabled: true, voiceEnabled: true, ttsVolume: 0.7, ttsRate: 1.0, piperVoiceId: '' }

vi.mock('@renderer/stores/view-store', () => ({
  useViewStore: Object.assign(
    vi.fn(),
    { getState: () => mockViewState }
  )
}))

// ─── Minimal window.agentHub stub ────────────────────────────────────────────

type ResponseReadyCb = (agentId: string, text: string) => void

function makeAgentHub() {
  const responseListeners: ResponseReadyCb[] = []
  const approvalListeners: ((agentId: string) => void)[] = []
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
      onApprovalNeeded: vi.fn((cb: (agentId: string) => void) => {
        approvalListeners.push(cb)
        return () => approvalListeners.splice(approvalListeners.indexOf(cb), 1)
      }),
    },
    _emit: {
      responseReady: (agentId: string, text: string) =>
        responseListeners.forEach((l) => l(agentId, text)),
      approvalNeeded: (agentId: string) =>
        approvalListeners.forEach((l) => l(agentId)),
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
  mockViewState.soundEnabled = true
  mockViewState.voiceEnabled = true
  const hub = makeAgentHub()
  ;(window as unknown as Record<string, unknown>).agentHub = hub
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAgentTts — onResponseReady', () => {
  it('speaks announcement only on responseReady (always_on) — never reads content', async () => {
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    const text = 'First paragraph.\n\nFinal response paragraph here.'

    await act(async () => {
      hub._emit.responseReady('agent-1', text)
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe('Sam has responded.')
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

  it('readFullResponse with null agentId logs a warning', async () => {
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    const { result } = renderHook(() => useAgentTts(agents))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await act(async () => {
      result.current.readFullResponse(null)
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useAgentTts]'),
      expect.stringContaining('no agent')
    )
    warnSpy.mockRestore()
  })

  it('readFullResponse with valid agent but no stored text logs a warning', async () => {
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    const { result } = renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Don't emit any responseReady — lastResponseText is empty
    await act(async () => {
      result.current.readFullResponse('agent-1')
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useAgentTts]'),
      expect.stringContaining('no stored text')
    )
    expect(hub.tts.speak).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('useAgentTts — readFullResponse stores text regardless of voice state', () => {
  it('stores response text even when voiceMode is off — Cmd+Shift+I still works', async () => {
    const agent = makeAgent({ voiceMode: 'off' })
    const agents = new Map([['agent-1', agent]])
    const { result } = renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    // Response arrives while voice is off — text must still be stored for later replay
    await act(async () => {
      hub._emit.responseReady('agent-1', 'Important response that should be replayable.')
    })
    hub.tts.speak.mockClear()

    // Now replay via Cmd+Shift+I — should work even though voice was off at time of response
    await act(async () => {
      result.current.readFullResponse('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toContain('Important response that should be replayable.')
  })

  it('stores response text even when voiceEnabled is false globally', async () => {
    mockViewState.voiceEnabled = false
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    const { result } = renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Response while voice globally off.')
    })
    hub.tts.speak.mockClear()

    // Replay should still work
    await act(async () => {
      result.current.readFullResponse('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toContain('Response while voice globally off.')
  })

  it('stores text even when soundEnabled is false — manual replay is independent of sound toggle', async () => {
    mockViewState.soundEnabled = false
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    const { result } = renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Silent mode response.')
    })
    hub.tts.speak.mockClear()

    await act(async () => {
      result.current.readFullResponse('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toContain('Silent mode response.')
  })
})

describe('useAgentTts — approval announcement', () => {
  it('speaks approval announcement when agent enters awaiting_approval (always_on)', async () => {
    const agent = makeAgent({ voiceMode: 'always_on', name: 'Sam' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe("Sam is waiting for your approval.")
  })

  it('speaks approval announcement in speak_up mode', async () => {
    const agent = makeAgent({ voiceMode: 'speak_up', name: 'Sam' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe("Sam is waiting for your approval.")
  })

  it('deduplicates rapid approval events via 30s cooldown', async () => {
    const agent = makeAgent({ voiceMode: 'always_on', name: 'Sam' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    // Same agent fires approval 3 times rapidly (3 tool calls needing approval)
    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
      hub._emit.approvalNeeded('agent-1')
      hub._emit.approvalNeeded('agent-1')
    })

    // Should only announce once — cooldown blocks re-announcement within 30s
    expect(hub.tts.speak).toHaveBeenCalledTimes(1)
    expect(hub.tts.speak.mock.calls[0][0].text).toBe("Sam is waiting for your approval.")
  })

  it('announces different agents separately even in rapid succession', async () => {
    const agent1 = makeAgent({ id: 'agent-1', voiceMode: 'always_on', name: 'Sam' })
    const agent2 = makeAgent({ id: 'agent-2', voiceMode: 'always_on', name: 'BuildBot' })
    const agents = new Map([['agent-1', agent1], ['agent-2', agent2]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
      hub._emit.approvalNeeded('agent-2')
    })

    expect(hub.tts.speak).toHaveBeenCalledTimes(2)
  })

  it('does NOT speak approval when voiceMode is off', async () => {
    const agent = makeAgent({ voiceMode: 'off' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })
})

describe('useAgentTts — master mute (soundEnabled gate)', () => {
  it('skips TTS when soundEnabled is false', async () => {
    mockViewState.soundEnabled = false
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Some response text.')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })

  it('skips approval announcement when soundEnabled is false', async () => {
    mockViewState.soundEnabled = false
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })
})

describe('useAgentTts — voiceEnabled gate', () => {
  it('skips TTS when voiceEnabled is false', async () => {
    mockViewState.voiceEnabled = false
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.responseReady('agent-1', 'Some response text.')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })

  it('skips approval TTS when voiceEnabled is false', async () => {
    mockViewState.voiceEnabled = false
    const agent = makeAgent({ voiceMode: 'always_on' })
    const agents = new Map([['agent-1', agent]])
    renderHook(() => useAgentTts(agents))
    const hub = (window as unknown as { agentHub: ReturnType<typeof makeAgentHub> }).agentHub

    await act(async () => {
      hub._emit.approvalNeeded('agent-1')
    })

    expect(hub.tts.speak).not.toHaveBeenCalled()
  })
})
