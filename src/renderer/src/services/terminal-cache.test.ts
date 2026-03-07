import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/* ---------- Mock xterm ---------- */
const mockElement = document.createElement('div')
const mockTerminalInstance = {
  open: vi.fn(),
  loadAddon: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  focus: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
  element: mockElement,
  options: {} as Record<string, unknown>
}

vi.mock('@xterm/xterm', () => {
  const MockTerminal = vi.fn(function (this: unknown, opts: Record<string, unknown>) {
    mockTerminalInstance.options = { ...opts }
    Object.assign(this as Record<string, unknown>, mockTerminalInstance)
    return mockTerminalInstance
  })
  return { Terminal: MockTerminal }
})

vi.mock('@xterm/addon-webgl', () => {
  const MockWebglAddon = vi.fn(function () {
    return { dispose: vi.fn(), onContextLoss: vi.fn() }
  })
  return { WebglAddon: MockWebglAddon }
})

/* ---------- Mock theme bridge ---------- */
vi.mock('../widgets/full-terminal/theme-bridge', () => ({
  getXtermTheme: vi.fn(() => ({
    background: '#1a1a2e',
    foreground: '#e0e0e0',
    cursor: '#6478ee'
  }))
}))

/* ---------- Mock IPC ---------- */
const outputCallbacks: ((id: string, data: string) => void)[] = []
const mockUnsubOutput = vi.fn()
const mockOn = {
  agentOutput: vi.fn((cb: (id: string, data: string) => void) => {
    outputCallbacks.push(cb)
    return mockUnsubOutput
  })
}
const mockAgents = {
  sendInput: vi.fn(),
  resize: vi.fn()
}

Object.defineProperty(window, 'agentHub', {
  value: { on: mockOn, agents: mockAgents },
  writable: true
})

/* ---------- Mock getComputedStyle for theme bridge ---------- */
const originalGetComputedStyle = window.getComputedStyle
vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
  const real = originalGetComputedStyle(el)
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'getPropertyValue') {
        return (): string => 'rgb(0, 0, 0)'
      }
      if (prop === 'color') {
        return 'rgb(0, 0, 0)'
      }
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
})

describe('TerminalCache', () => {
  let terminalCache: typeof import('./terminal-cache').terminalCache

  beforeEach(async () => {
    vi.clearAllMocks()
    outputCallbacks.length = 0
    // Fresh import to get a clean singleton each test
    vi.resetModules()
    const mod = await import('./terminal-cache')
    terminalCache = mod.terminalCache
  })

  afterEach(() => {
    terminalCache.disposeAll()
  })

  it('creates a terminal on first getOrCreate call', () => {
    const term = terminalCache.getOrCreate('agent-1')
    expect(term).toBeDefined()
    expect(mockTerminalInstance.open).toHaveBeenCalled()
  })

  it('returns the same terminal on repeated getOrCreate calls', () => {
    const term1 = terminalCache.getOrCreate('agent-1')
    const term2 = terminalCache.getOrCreate('agent-1')
    expect(term1).toBe(term2)
  })

  it('subscribes to agent output on creation', () => {
    terminalCache.getOrCreate('agent-1')
    expect(mockOn.agentOutput).toHaveBeenCalledTimes(1)
  })

  it('has() reports cached agents', () => {
    expect(terminalCache.has('agent-1')).toBe(false)
    terminalCache.getOrCreate('agent-1')
    expect(terminalCache.has('agent-1')).toBe(true)
  })

  it('get() returns null for uncached agents', () => {
    expect(terminalCache.get('agent-1')).toBeNull()
  })

  it('dispose() cleans up terminal and removes from cache', () => {
    terminalCache.getOrCreate('agent-1')
    expect(terminalCache.has('agent-1')).toBe(true)

    terminalCache.dispose('agent-1')

    expect(mockTerminalInstance.dispose).toHaveBeenCalled()
    expect(mockUnsubOutput).toHaveBeenCalled()
    expect(terminalCache.has('agent-1')).toBe(false)
  })

  it('disposeAll() cleans up all cached terminals', () => {
    terminalCache.getOrCreate('agent-1')
    terminalCache.getOrCreate('agent-2')

    terminalCache.disposeAll()

    expect(terminalCache.has('agent-1')).toBe(false)
    expect(terminalCache.has('agent-2')).toBe(false)
  })

  it('attach() moves terminal element to target container', () => {
    terminalCache.getOrCreate('agent-1')
    const container = document.createElement('div')

    terminalCache.attach('agent-1', container)

    expect(container.contains(mockElement)).toBe(true)
  })

  it('detach() moves terminal element back to offscreen', () => {
    terminalCache.getOrCreate('agent-1')
    const container = document.createElement('div')

    terminalCache.attach('agent-1', container)
    expect(container.contains(mockElement)).toBe(true)

    terminalCache.detach('agent-1')
    expect(container.contains(mockElement)).toBe(false)
  })
})
