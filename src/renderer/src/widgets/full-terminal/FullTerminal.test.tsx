import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useThemeStore } from '@renderer/stores/theme-store'

/* ---------- Mock terminal-manager ---------- */
// terminal-manager depends on xterm (requires real DOM/canvas) — mock at this boundary.
const mockTitleDisposable = { dispose: vi.fn() }
const mockTerm = {
  attachCustomKeyEventHandler: vi.fn(),
  onTitleChange: vi.fn(() => mockTitleDisposable),
  hasSelection: vi.fn(() => false),
  getSelection: vi.fn(() => ''),
  focus: vi.fn(),
  clear: vi.fn(),
  selectAll: vi.fn(),
  element: document.createElement('div'),
  cols: 80,
  rows: 24,
}

const mockManagedTerminal = {
  term: mockTerm,
  fitAddon: { fit: vi.fn() },
  searchAddon: { findNext: vi.fn(), findPrevious: vi.fn(), clearDecorations: vi.fn() },
  serializeAddon: { serialize: vi.fn(() => '') },
  webglAddon: null,
  opened: false,
  container: null,
  pendingWrites: [],
}

const mockGetOrCreateTerminal = vi.fn(() => mockManagedTerminal)
const mockAttachToContainer = vi.fn()
const mockDetachFromContainer = vi.fn()
const mockSetVisible = vi.fn()
const mockFitTerminal = vi.fn()
const mockUpdateTheme = vi.fn()
const mockDestroyTerminal = vi.fn()
const mockGetTerminal = vi.fn(() => mockTerm)
const mockGetSearchAddon = vi.fn(() => mockManagedTerminal.searchAddon)
const mockGetSerializeAddon = vi.fn(() => mockManagedTerminal.serializeAddon)
const mockHasReceivedData = vi.fn(() => false)
const mockOnClaudeReady = vi.fn(() => vi.fn())
const mockRefreshTerminal = vi.fn()

vi.mock('./terminal-manager', () => ({
  getOrCreateTerminal: (...args: unknown[]) => mockGetOrCreateTerminal(...args),
  attachToContainer: (...args: unknown[]) => mockAttachToContainer(...args),
  detachFromContainer: (...args: unknown[]) => mockDetachFromContainer(...args),
  setVisible: (...args: unknown[]) => mockSetVisible(...args),
  fitTerminal: (...args: unknown[]) => mockFitTerminal(...args),
  updateTheme: (...args: unknown[]) => mockUpdateTheme(...args),
  destroyTerminal: (...args: unknown[]) => mockDestroyTerminal(...args),
  getTerminal: (...args: unknown[]) => mockGetTerminal(...args),
  getSearchAddon: (...args: unknown[]) => mockGetSearchAddon(...args),
  getSerializeAddon: (...args: unknown[]) => mockGetSerializeAddon(...args),
  hasReceivedData: (...args: unknown[]) => mockHasReceivedData(...args),
  onClaudeReady: (...args: unknown[]) => mockOnClaudeReady(...args),
  refreshTerminal: (...args: unknown[]) => mockRefreshTerminal(...args),
  searchAllTerminals: vi.fn(() => []),
  startIpcListener: vi.fn(),
}))

vi.mock('./TerminalContextMenu', () => ({
  default: () => null,
}))

/* ---------- Mock ResizeObserver (not in jsdom) ---------- */
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(_callback: () => void) {}
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

/* ---------- Mock IPC ---------- */
const mockAgents = {
  sendInput: vi.fn(),
  resize: vi.fn(),
}

const mockClipboard = {
  writeText: vi.fn(),
  readText: vi.fn(() => ''),
}

Object.defineProperty(window, 'agentHub', {
  value: { on: { agentOutput: vi.fn(() => vi.fn()) }, agents: mockAgents, clipboard: mockClipboard },
  writable: true,
})

/* ---------- Mock requestAnimationFrame ---------- */
let rafCallbacks: (() => void)[] = []
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  rafCallbacks.push(cb as () => void)
  return 0
}) as typeof globalThis.requestAnimationFrame

function flushRaf(): void {
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  cbs.forEach((cb) => cb())
}

async function flushRafAndFonts(): Promise<void> {
  flushRaf()
  await Promise.resolve()
  await Promise.resolve()
}

/* ---------- Mock document.fonts (not in jsdom) ---------- */
Object.defineProperty(document, 'fonts', {
  value: { ready: Promise.resolve() },
  writable: true,
})

describe('FullTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rafCallbacks = []
    useThemeStore.setState({ theme: 'mocha' })
    document.documentElement.setAttribute('data-theme', 'mocha')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls getOrCreateTerminal and attachToContainer on mount', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(mockGetOrCreateTerminal).toHaveBeenCalledWith('agent-1')
    expect(mockAttachToContainer).toHaveBeenCalledWith('agent-1', expect.any(HTMLElement))
  })

  it('calls detachFromContainer on unmount (does NOT destroy terminal)', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { unmount } = render(<FullTerminal agentId="agent-1" visible={true} />)
    unmount()

    expect(mockDetachFromContainer).toHaveBeenCalledWith('agent-1')
    expect(mockDestroyTerminal).not.toHaveBeenCalled()
  })

  it('wires keyboard handler on mount', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(mockTerm.attachCustomKeyEventHandler).toHaveBeenCalledWith(expect.any(Function))
  })

  it('wires onTitleChange and disposes it on unmount', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { unmount } = render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(mockTerm.onTitleChange).toHaveBeenCalledWith(expect.any(Function))

    unmount()

    expect(mockTitleDisposable.dispose).toHaveBeenCalled()
  })

  it('calls setVisible when visible changes to true', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { rerender } = render(<FullTerminal agentId="agent-1" visible={false} />)
    await act(() => flushRafAndFonts())

    vi.clearAllMocks()
    rerender(<FullTerminal agentId="agent-1" visible={true} />)
    await act(() => flushRafAndFonts())

    expect(mockSetVisible).toHaveBeenCalledWith('agent-1', true)
  })

  it('calls updateTheme when DaisyUI theme changes', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    vi.clearAllMocks()
    act(() => {
      useThemeStore.getState().setTheme('neon-noir')
    })

    expect(mockUpdateTheme).toHaveBeenCalled()
  })

  it('detaches old agent and attaches new one when agentId changes', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { rerender } = render(<FullTerminal agentId="agent-1" visible={true} />)
    await act(() => flushRafAndFonts())

    vi.clearAllMocks()
    rerender(<FullTerminal agentId="agent-2" visible={true} />)
    await act(() => flushRafAndFonts())

    expect(mockDetachFromContainer).toHaveBeenCalledWith('agent-1')
    expect(mockGetOrCreateTerminal).toHaveBeenCalledWith('agent-2')
    expect(mockAttachToContainer).toHaveBeenCalledWith('agent-2', expect.any(HTMLElement))
  })

  it('exposes serialize callback via onSerialize prop', async () => {
    const onSerialize = vi.fn()
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} onSerialize={onSerialize} />)

    expect(onSerialize).toHaveBeenCalledWith('agent-1', expect.any(Function))
  })

  it('calls onReady on mount', async () => {
    const onReady = vi.fn()
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} onReady={onReady} />)

    expect(onReady).toHaveBeenCalled()
  })

  it('Cmd+C copies selection via clipboard IPC', async () => {
    mockTerm.hasSelection.mockReturnValue(true)
    mockTerm.getSelection.mockReturnValue('selected text')
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    const keyHandler = mockTerm.attachCustomKeyEventHandler.mock.calls[0][0]
    const result = keyHandler({ type: 'keydown', metaKey: true, ctrlKey: false, key: 'c', altKey: false, shiftKey: false })

    expect(result).toBe(false)
    expect(mockClipboard.writeText).toHaveBeenCalledWith('selected text')
  })
})
