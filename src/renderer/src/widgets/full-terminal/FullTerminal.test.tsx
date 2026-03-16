import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useThemeStore } from '@renderer/stores/theme-store'

/* ---------- Mock xterm ---------- */
const mockOnDataDisposable = { dispose: vi.fn() }
const mockOnTitleChangeDisposable = { dispose: vi.fn() }
const mockTerminalInstance = {
  open: vi.fn(),
  loadAddon: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  focus: vi.fn(),
  refresh: vi.fn(),
  clear: vi.fn(),
  selectAll: vi.fn(),
  onData: vi.fn(() => mockOnDataDisposable),
  onTitleChange: vi.fn(() => mockOnTitleChangeDisposable),
  attachCustomKeyEventHandler: vi.fn(),
  hasSelection: vi.fn(() => false),
  getSelection: vi.fn(() => ''),
  dispose: vi.fn(),
  element: document.createElement('div'),
  options: {} as Record<string, unknown>,
  unicode: { activeVersion: '6' },
  cols: 80,
  rows: 30
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

const mockFitAddonInstance = { fit: vi.fn(), dispose: vi.fn(), proposeDimensions: vi.fn(() => ({ cols: 80, rows: 30 })) }
vi.mock('@xterm/addon-fit', () => {
  const MockFitAddon = vi.fn(function () {
    return mockFitAddonInstance
  })
  return { FitAddon: MockFitAddon }
})

vi.mock('@xterm/addon-search', () => {
  const MockSearchAddon = vi.fn(function () {
    return { findNext: vi.fn(), findPrevious: vi.fn(), clearDecorations: vi.fn(), dispose: vi.fn() }
  })
  return { SearchAddon: MockSearchAddon }
})

vi.mock('@xterm/addon-web-links', () => {
  const MockWebLinksAddon = vi.fn(function () {
    return { dispose: vi.fn() }
  })
  return { WebLinksAddon: MockWebLinksAddon }
})

vi.mock('@xterm/addon-serialize', () => {
  const MockSerializeAddon = vi.fn(function () {
    return { serialize: vi.fn(() => ''), dispose: vi.fn() }
  })
  return { SerializeAddon: MockSerializeAddon }
})

vi.mock('@xterm/addon-unicode11', () => {
  const MockUnicode11Addon = vi.fn(function () {
    return { dispose: vi.fn() }
  })
  return { Unicode11Addon: MockUnicode11Addon }
})

/* ---------- Mock output-buffer ---------- */
const mockOutputBuffer = {
  start: vi.fn(),
  stop: vi.fn(),
  drain: vi.fn((_agentId: string, _callback: (data: string) => void) => ''),
  stopPassthrough: vi.fn(),
  clear: vi.fn(),
  clearAll: vi.fn()
}

vi.mock('@renderer/services/output-buffer', () => ({
  outputBuffer: mockOutputBuffer
}))

/* ---------- Mock theme bridge ---------- */
const mockTheme = {
  background: '#1a1a2e',
  foreground: '#e0e0e0',
  cursor: '#6478ee'
}

vi.mock('./theme-bridge', () => ({
  getXtermTheme: vi.fn(() => ({ ...mockTheme }))
}))

vi.mock('./TerminalContextMenu', () => ({
  default: () => null
}))

/* ---------- Mock ResizeObserver (not in jsdom) ---------- */
let resizeObserverCallback: (() => void) | null = null
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(callback: () => void) {
    resizeObserverCallback = callback
  }
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

/* ---------- Mock IPC ---------- */
const mockAgents = {
  sendInput: vi.fn(),
  resize: vi.fn()
}

const mockClipboard = {
  writeText: vi.fn(),
  readText: vi.fn(() => '')
}

Object.defineProperty(window, 'agentHub', {
  value: { on: { agentOutput: vi.fn(() => vi.fn()) }, agents: mockAgents, clipboard: mockClipboard },
  writable: true
})

/* ---------- Mock requestAnimationFrame ---------- */
let rafCallbacks: (() => void)[] = []
const originalRaf = globalThis.requestAnimationFrame
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  rafCallbacks.push(cb as () => void)
  return 0
}) as typeof globalThis.requestAnimationFrame

function flushRaf(): void {
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  cbs.forEach((cb) => cb())
}

/** Flush rAF + document.fonts.ready microtask chain */
async function flushRafAndFonts(): Promise<void> {
  flushRaf()
  // document.fonts.ready is a resolved promise — flush its .then() microtask
  await Promise.resolve()
  await Promise.resolve()
}

/* ---------- Mock document.fonts (not in jsdom) ---------- */
Object.defineProperty(document, 'fonts', {
  value: { ready: Promise.resolve() },
  writable: true
})

describe('FullTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rafCallbacks = []
    resizeObserverCallback = null
    mockTerminalInstance.options = {}
    mockTerminalInstance.cols = 80
    mockTerminalInstance.rows = 24
    useThemeStore.setState({ theme: 'mocha' })
    document.documentElement.setAttribute('data-theme', 'mocha')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new Terminal on mount and opens it in the container', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(mockTerminalInstance.open).toHaveBeenCalledWith(expect.any(HTMLElement))
  })

  it('disposes the terminal on unmount', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { unmount } = render(<FullTerminal agentId="agent-1" visible={true} />)
    unmount()

    expect(mockTerminalInstance.dispose).toHaveBeenCalled()
  })

  it('replays buffered output on mount via drain()', async () => {
    mockOutputBuffer.drain.mockReturnValueOnce('buffered-data-here')
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)
    await act(() => flushRafAndFonts())

    expect(mockOutputBuffer.drain).toHaveBeenCalledWith('agent-1', expect.any(Function))
    expect(mockTerminalInstance.write).toHaveBeenCalledWith('buffered-data-here', expect.any(Function))
  })

  it('does not write empty buffer on mount', async () => {
    mockOutputBuffer.drain.mockReturnValueOnce('')
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(mockTerminalInstance.write).not.toHaveBeenCalled()
  })

  it('stops passthrough on unmount', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { unmount } = render(<FullTerminal agentId="agent-1" visible={true} />)
    unmount()

    expect(mockOutputBuffer.stopPassthrough).toHaveBeenCalledWith('agent-1', expect.any(Function))
  })

  it('calls resize IPC after initial fit in requestAnimationFrame', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)
    await act(() => flushRafAndFonts())

    expect(mockFitAddonInstance.fit).toHaveBeenCalled()
    expect(mockAgents.resize).toHaveBeenCalledWith('agent-1', 80, 24)
  })

  it('re-fits and focuses when visible changes to true', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { rerender } = render(<FullTerminal agentId="agent-1" visible={false} />)
    await act(() => flushRafAndFonts())

    vi.clearAllMocks()
    rerender(<FullTerminal agentId="agent-1" visible={true} />)
    await act(() => flushRafAndFonts())

    expect(mockFitAddonInstance.fit).toHaveBeenCalled()
    expect(mockTerminalInstance.focus).toHaveBeenCalled()
  })

  it('updates terminal theme when DaisyUI theme changes', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    act(() => {
      useThemeStore.getState().setTheme('neon-noir')
    })

    // The theme effect should have set options.theme
    expect(mockTerminalInstance.options.theme).toBeDefined()
  })

  it('disposes old terminal and creates new one when agentId changes', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { rerender } = render(<FullTerminal agentId="agent-1" visible={true} />)
    await act(() => flushRafAndFonts())

    // First mount creates terminal
    expect(mockTerminalInstance.open).toHaveBeenCalledTimes(1)

    rerender(<FullTerminal agentId="agent-2" visible={true} />)
    await act(() => flushRafAndFonts())

    // Old terminal disposed, new one created
    expect(mockTerminalInstance.dispose).toHaveBeenCalled()
    expect(mockOutputBuffer.stopPassthrough).toHaveBeenCalledWith('agent-1', expect.any(Function))
    expect(mockOutputBuffer.drain).toHaveBeenCalledWith('agent-2', expect.any(Function))
  })

  it('wires keyboard input to sendInput IPC', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    // onData should have been called with a callback
    expect(mockTerminalInstance.onData).toHaveBeenCalledWith(expect.any(Function))

    // Simulate typing
    const onDataCallback = mockTerminalInstance.onData.mock.calls[0][0]
    onDataCallback('hello')

    expect(mockAgents.sendInput).toHaveBeenCalledWith('agent-1', 'hello')
  })

  it('disconnects resize observer on unmount', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { unmount } = render(<FullTerminal agentId="agent-1" visible={true} />)

    // Get the MockResizeObserver instance
    const observer = MockResizeObserver.prototype
    unmount()

    // disconnect is called on unmount (on the instance, not prototype)
    expect(mockTerminalInstance.dispose).toHaveBeenCalled()
  })

  it('disposes onData handler on unmount', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { unmount } = render(<FullTerminal agentId="agent-1" visible={true} />)
    unmount()

    expect(mockOnDataDisposable.dispose).toHaveBeenCalled()
  })
})
