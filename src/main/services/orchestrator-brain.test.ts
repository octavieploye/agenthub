import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OrchestratorBrain } from './orchestrator-brain'
import type { BrainConfig, BrainContext, BrainTask } from './orchestrator-brain'

// Mock electron-log so log.warn is spy-able in vitest (electron-log is not
// available in the Node test environment without Electron).
vi.mock('electron-log/main', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
}))
import log from 'electron-log/main'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<BrainConfig> = {}): BrainConfig {
  return {
    provider: 'ollama-local',
    model: 'qwen3:8b',
    endpoint: 'http://localhost:11434/api/chat',
    timeoutMs: 30_000,
    ...overrides
  }
}

function makeTask(overrides: Partial<BrainTask> = {}): BrainTask {
  return {
    id: 'task-1',
    description: 'Fix the login bug',
    category: 'bug',
    priority: 1,
    repo: 'agenthub',
    skill: 'team-dev-loop',
    blockedBy: [],
    ...overrides
  }
}

function makeContext(overrides: Partial<BrainContext> = {}): BrainContext {
  return {
    readyTasks: [makeTask()],
    activeAgentCount: 0,
    recentOutcomes: [],
    ...overrides
  }
}

/** Builds a minimal Ollama-style chat response wrapping the given text. */
function ollamaResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      message: { role: 'assistant', content }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

/** Builds an OpenAI-compatible chat response wrapping the given text. */
function openaiResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', content } }]
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrchestratorBrain', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Happy path — Ollama response shape
  // -------------------------------------------------------------------------

  it('returns BrainDecision on valid JSON from Ollama message.content', async () => {
    const decision = { taskId: 'task-1', reason: 'Highest priority' }
    vi.mocked(fetch).mockResolvedValueOnce(ollamaResponse(JSON.stringify(decision)))

    const brain = new OrchestratorBrain(makeConfig())
    const result = await brain.decide(makeContext())

    expect(result).not.toBeNull()
    expect(result?.taskId).toBe('task-1')
    expect(result).not.toHaveProperty('skill')
    expect(result).not.toHaveProperty('model')
    expect(result?.reason).toBe('Highest priority')
  })

  // -------------------------------------------------------------------------
  // Happy path — OpenAI-compatible response shape
  // -------------------------------------------------------------------------

  it('returns BrainDecision on valid JSON from OpenAI choices[0].message.content', async () => {
    const decision = { taskId: 'task-1', reason: 'Only ready task' }
    const config = makeConfig({ provider: 'codex', model: 'o4-mini', endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: 'sk-test' })
    vi.mocked(fetch).mockResolvedValueOnce(openaiResponse(JSON.stringify(decision)))

    const brain = new OrchestratorBrain(config)
    const result = await brain.decide(makeContext())

    expect(result).not.toBeNull()
    expect(result?.taskId).toBe('task-1')
    expect(result).not.toHaveProperty('model')
    expect(result).not.toHaveProperty('skill')
  })

  // -------------------------------------------------------------------------
  // Invalid JSON from LLM
  // -------------------------------------------------------------------------

  it('falls back to deterministic selection on invalid JSON from LLM', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ollamaResponse('not valid json at all'))

    const brain = new OrchestratorBrain(makeConfig())
    vi.mocked(log.warn).mockClear()

    const result = await brain.decide(makeContext())

    expect(result).not.toBeNull()
    expect(result?.taskId).toBe('task-1')
    expect(result?.reason).toBe('deterministic fallback — LLM unavailable')
    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(expect.stringContaining('[orchestrator-brain]'), expect.stringContaining('invalid JSON'))
  })

  // -------------------------------------------------------------------------
  // Unknown taskId
  // -------------------------------------------------------------------------

  it('falls back to deterministic selection if taskId from LLM is not in readyTasks', async () => {
    const decision = { taskId: 'ghost-999', reason: 'Hallucinated task' }
    vi.mocked(fetch).mockResolvedValueOnce(ollamaResponse(JSON.stringify(decision)))

    const brain = new OrchestratorBrain(makeConfig())
    vi.mocked(log.warn).mockClear()

    const result = await brain.decide(makeContext())

    expect(result).not.toBeNull()
    expect(result?.taskId).toBe('task-1')
    expect(result?.reason).toBe('deterministic fallback — LLM unavailable')
    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(expect.stringContaining('[orchestrator-brain]'), expect.stringContaining('ghost-999'))
  })

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  it('falls back to deterministic selection on timeout', async () => {
    vi.useFakeTimers()

    // fetch that never resolves
    vi.mocked(fetch).mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          // Wire into the AbortSignal supplied by the brain
          const signal = (init as RequestInit & { signal?: AbortSignal })?.signal
          if (signal) {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }
        })
    )

    const brain = new OrchestratorBrain(makeConfig({ timeoutMs: 5_000 }))
    vi.mocked(log.warn).mockClear()

    const resultPromise = brain.decide(makeContext())

    // Advance fake clock past the timeout
    await vi.advanceTimersByTimeAsync(6_000)

    const result = await resultPromise

    expect(result).not.toBeNull()
    expect(result?.taskId).toBe('task-1')
    expect(result?.reason).toBe('deterministic fallback — LLM unavailable')
    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(expect.stringContaining('[orchestrator-brain]'), expect.stringContaining('timeout'))
  })

  // -------------------------------------------------------------------------
  // HTTP error from endpoint
  // -------------------------------------------------------------------------

  it('falls back to deterministic selection on non-OK HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )

    const brain = new OrchestratorBrain(makeConfig())
    vi.mocked(log.warn).mockClear()

    const result = await brain.decide(makeContext())

    expect(result).not.toBeNull()
    expect(result?.taskId).toBe('task-1')
    expect(result?.reason).toBe('deterministic fallback — LLM unavailable')
    expect(vi.mocked(log.warn)).toHaveBeenCalledWith(expect.stringContaining('[orchestrator-brain]'), expect.stringContaining('500'))
  })

  // -------------------------------------------------------------------------
  // Empty readyTasks — brain should short-circuit before calling LLM
  // -------------------------------------------------------------------------

  it('returns null immediately when readyTasks is empty (no fetch call)', async () => {
    const brain = new OrchestratorBrain(makeConfig())
    const context = makeContext({ readyTasks: [] })

    const result = await brain.decide(context)

    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Multiple ready tasks — LLM picks the second one
  // -------------------------------------------------------------------------

  it('deterministic fallback selects lowest priority number (highest urgency) when LLM fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Service Unavailable', { status: 503 })
    )

    const tasks = [
      makeTask({ id: 'task-low', priority: 3 }),
      makeTask({ id: 'task-high', priority: 1 }),
      makeTask({ id: 'task-mid', priority: 2 }),
    ]
    const brain = new OrchestratorBrain(makeConfig())
    const result = await brain.decide(makeContext({ readyTasks: tasks }))

    expect(result?.taskId).toBe('task-high')
    expect(result?.reason).toBe('deterministic fallback — LLM unavailable')
  })

  it('accepts any valid taskId from the readyTasks list', async () => {
    const tasks = [
      makeTask({ id: 'task-alpha' }),
      makeTask({ id: 'task-beta', priority: 2 })
    ]
    const decision = { taskId: 'task-beta', reason: 'Higher priority' }
    vi.mocked(fetch).mockResolvedValueOnce(ollamaResponse(JSON.stringify(decision)))

    const brain = new OrchestratorBrain(makeConfig())
    const result = await brain.decide(makeContext({ readyTasks: tasks }))

    expect(result?.taskId).toBe('task-beta')
  })
})
