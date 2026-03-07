import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useThemeStore } from '@renderer/stores/theme-store'

/* ---------- Mock xterm ---------- */
const mockTerminalInstance = {
  open: vi.fn(),
  loadAddon: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  focus: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
  element: document.createElement('div'),
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

/* ---------- Mock terminal-cache ---------- */
const mockCache = {
  getOrCreate: vi.fn(() => mockTerminalInstance),
  attach: vi.fn(),
  detach: vi.fn(),
  get: vi.fn(() => mockTerminalInstance),
  has: vi.fn(() => true),
  updateTheme: vi.fn(),
  dispose: vi.fn(),
  disposeAll: vi.fn()
}

vi.mock('@renderer/services/terminal-cache', () => ({
  terminalCache: mockCache
}))

/* ---------- Mock ResizeObserver (not in jsdom) ---------- */
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

/* ---------- Mock IPC ---------- */
const mockOn = {
  agentOutput: vi.fn(() => vi.fn())
}
const mockAgents = {
  sendInput: vi.fn(),
  resize: vi.fn()
}

Object.defineProperty(window, 'agentHub', {
  value: { on: mockOn, agents: mockAgents },
  writable: true
})

/* ---------- Mock getComputedStyle for CSS custom properties ---------- */
const CSS_VARS: Record<string, string> = {
  '--color-base-100': 'rgb(26, 26, 46)',
  '--color-base-200': 'rgb(20, 20, 36)',
  '--color-base-300': 'rgb(14, 14, 26)',
  '--color-base-content': 'rgb(224, 224, 224)',
  '--color-primary': 'rgb(100, 120, 238)',
  '--color-secondary': 'rgb(6, 182, 212)',
  '--color-accent': 'rgb(168, 85, 247)',
  '--color-error': 'rgb(239, 68, 68)',
  '--color-success': 'rgb(16, 185, 129)',
  '--color-warning': 'rgb(245, 158, 11)',
  '--color-info': 'rgb(59, 130, 246)'
}

const EMBER_VARS: Record<string, string> = {
  '--color-base-100': 'rgb(30, 16, 12)',
  '--color-base-200': 'rgb(24, 12, 8)',
  '--color-base-300': 'rgb(18, 8, 4)',
  '--color-base-content': 'rgb(224, 200, 190)',
  '--color-primary': 'rgb(220, 80, 40)',
  '--color-secondary': 'rgb(200, 140, 60)',
  '--color-accent': 'rgb(240, 180, 60)',
  '--color-error': 'rgb(239, 68, 68)',
  '--color-success': 'rgb(16, 185, 129)',
  '--color-warning': 'rgb(245, 158, 11)',
  '--color-info': 'rgb(59, 130, 246)'
}

let activeCssVars = CSS_VARS
const originalGetComputedStyle = window.getComputedStyle

function setupComputedStyleMock(): void {
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
    const real = originalGetComputedStyle(el)
    return new Proxy(real, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (name: string): string => {
            if (name in activeCssVars) return activeCssVars[name]
            return target.getPropertyValue(name)
          }
        }
        if (prop === 'color') {
          const color = (el as HTMLElement).style?.color
          if (color && color.startsWith('rgb')) return color
          return color || target.color
        }
        const value = Reflect.get(target, prop)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
  })
}

describe('FullTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeCssVars = CSS_VARS
    setupComputedStyleMock()
    useThemeStore.setState({ theme: 'deep-space' })
    document.documentElement.setAttribute('data-theme', 'deep-space')
    mockTerminalInstance.options = {}
  })

  it('uses terminal cache to get or create terminal instance', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(mockCache.getOrCreate).toHaveBeenCalledWith('agent-1')
    expect(mockCache.attach).toHaveBeenCalledWith('agent-1', expect.any(HTMLElement))
  })

  it('detaches terminal on unmount instead of disposing', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { unmount } = render(<FullTerminal agentId="agent-1" visible={true} />)

    unmount()

    expect(mockCache.detach).toHaveBeenCalledWith('agent-1')
    // Should NOT dispose — terminal stays alive in cache
    expect(mockCache.dispose).not.toHaveBeenCalled()
  })

  it('calls updateTheme on all cached terminals when theme changes', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    activeCssVars = EMBER_VARS
    act(() => {
      useThemeStore.getState().setTheme('ember')
    })

    expect(mockCache.updateTheme).toHaveBeenCalled()
  })

  it('detaches old agent and attaches new agent on agentId change', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    const { rerender } = render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(mockCache.getOrCreate).toHaveBeenCalledWith('agent-1')
    expect(mockCache.attach).toHaveBeenCalledWith('agent-1', expect.any(HTMLElement))

    rerender(<FullTerminal agentId="agent-2" visible={true} />)

    expect(mockCache.detach).toHaveBeenCalledWith('agent-1')
    expect(mockCache.getOrCreate).toHaveBeenCalledWith('agent-2')
    expect(mockCache.attach).toHaveBeenCalledWith('agent-2', expect.any(HTMLElement))
  })
})
